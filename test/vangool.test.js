import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {loadConfig} from '../src/config.js';
import {planSources} from '../src/incremental.js';
import {crawlSources,extractDetailListing} from '../src/crawler.js';
import {finalizeListing} from '../src/listing.js';

test('unknown homepages discover their own rental/sale catalogs and avoid unrelated menus',async()=>{
  const requests=[];
  const server=createServer((request,response)=>{
    requests.push(request.url);
    response.setHeader('content-type','text/html');
    if(request.url==='/')response.end('<a href="/Propiedades">Todo</a><a href="/Alquiler">Alquiler</a><a href="/Venta">Venta</a><a href="/Contacto">Contacto</a><a href="https://other.example/Venta">Otro sitio</a>');
    else if(request.url==='/Alquiler')response.end('<a href="/p/1">Departamento</a>');
    else if(request.url==='/Venta')response.end('<a href="/p/2">Departamento</a>');
    else response.end(`<h1>Departamento en ${request.url==='/p/1'?'Alquiler':'Venta'}</h1><ul class="list-info-1a"><li>Ciudad: Mar del Plata</li></ul>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const url=`http://127.0.0.1:${server.address().port}/`;
    const sources=planSources({sources:[]},[url]);
    const rows=await crawlSources({sources,request:{delayMs:1},filters:{city:'Mar del Plata',propertyTypes:['Departamento']}});
    assert.equal(rows.length,2);assert.deepEqual(rows.map(row=>row.operation).sort(),['Alquiler','Venta']);
    assert.deepEqual(requests,['/','/Alquiler','/Venta','/p/1','/p/2']);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('Van Gool reads explicit rooms, garage and total constructed area from its own property',async()=>{
  const config=await loadConfig(fileURLToPath(new URL('../config.yml',import.meta.url)));
  const source=config.sources.find(source=>source.name==='Van Gool Bienes Raíces');
  assert.ok(source);assert.deepEqual(source.startUrls,['https://www.vangool.com.ar/Alquiler','https://www.vangool.com.ar/Venta']);
  const html='<meta property="og:title" content="Casa en Alquiler en Mar Del Plata - Almafuerte 1508"><img class="slider-thumb" alt="Foto Casa en Alquiler en Mar Del Plata, Costa Atlantica"><div class="title-address">Almafuerte 1508</div><div class="operations-box"><div class="operation-div"><span class="operation-type-div">Alquiler</span><span class="operation-val">$ 2.250.000</span></div></div><div class="ficha_detalle_item"><b>Tipo de Propiedad</b><br>Casa</div><div class="ficha_detalle_item"><b>Total construido</b><br>140 m²</div><ul id="lista_informacion_basica"><li>Ambientes : 4</li><li>Dormitorios : 3</li><li>Cocheras : 1</li></ul><div class="related-properties"><h1>Departamento 1 ambiente</h1></div>';
  const url='https://www.vangool.com.ar/p/9491803-Casa-en-Alquiler-en-Mar-Del-Plata-Almafuerte-1508';
  const row=finalizeListing(source.name,url,extractDetailListing(html,source,url));
  assert.equal(row.rooms,4);assert.equal(row.parking,'Sí');assert.equal(row.areaM2,140);assert.equal(row.areaKind,'total');assert.equal(row.priceAmount,2250000);assert.equal(row.operation,'Alquiler');
});
