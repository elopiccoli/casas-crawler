import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { extractListingsFromPage, extractDetailListing } from '../src/crawler.js';
import { publicJsonFields, publicJsonUrl } from '../src/public-json.js';
import { finalizeListing } from '../src/listing.js';
import { crawlSources } from '../src/crawler.js';
import { createServer } from 'node:http';

test('discovery supports a link selected both as card and link, plus nested cards',()=>{
  const $=cheerio.load('<a class="card" href="/propiedad/123">Casa</a><div class="card"><a href="/propiedad/456">Departamento</a></div><a class="card" href="https://other.test/propiedad/789">Otra</a>');
  const rows=extractListingsFromPage($,'https://agency.test/',{listingSelector:'.card',linkSelector:'a[href]',publicationUrlRegex:'/propiedad/'});
  assert.deepEqual(rows.map(x=>x.url),['https://agency.test/propiedad/123','https://agency.test/propiedad/456']);
});

test('property JSON-LD supplies its city without using the agency location',()=>{
  const html='<script type="application/ld+json">[{"@type":"RealEstateAgent","address":{"addressLocality":"Mar del Plata"}},{"@type":"Apartment","name":"Departamento","address":{"streetAddress":"Mitre 10","addressLocality":"Miramar"}}]</script>';
  const fields=extractDetailListing(html,{},'https://agency.test/property/1');
  assert.equal(fields.city,'Miramar');
});

test('a property location comment preserves a different city despite an MDP agency footer',()=>{
  const html='<div class="property-heading"><h2>Departamento</h2><!-- <h4>Costa Atlantica | Miramar | Centro</h4> --></div><footer>Mar del Plata</footer>';
  const fields=extractDetailListing(html,{locationCommentSelector:'.property-heading'});
  assert.equal(fields.city,'Miramar');assert.equal(fields.neighborhood,'Centro');
});

test('public catalogs preserve ambientes and explicit zero parking, with safe property URLs',()=>{
  const source={website:'https://agency.test',propertyPath:'/propiedad/{id}',jsonFields:{id:'id',title:'titulo',city:'ubicacion',propertyType:'categoria',operation:'tipo',priceAmount:'precio',currency:'moneda',rooms:'ambientes',areaM2:'superficie',parking:'cochera'}};
  const item={id:'1/2',titulo:'Departamento',ubicacion:'Centro, Mar del Plata',categoria:'departamento',tipo:'alquiler',precio:500000,moneda:'ARS/mes',ambientes:2,dormitorios:1,superficie:30,cochera:0};
  const row=finalizeListing('Agency',publicJsonUrl(item,source),publicJsonFields(item,source));
  assert.equal(row.rooms,2);assert.equal(row.parking,'No');assert.equal(row.priceAmount,500000);assert.equal(row.currency,'ARS');assert.equal(row.areaM2,30);
  assert.equal(row.url,'https://agency.test/propiedad/1%2F2');
  delete item.ambientes;delete item.cochera;
  const unknown=finalizeListing('Agency',publicJsonUrl(item,source),publicJsonFields(item,source));
  assert.equal(unknown.rooms,null);assert.equal(unknown.parking,'No informado');
});

test('public JSON crawling applies geography/type filters and rejects records without identity',async()=>{
  const server=createServer((request,response)=>{
    response.setHeader('content-type','application/json');
    response.end(JSON.stringify([
      {id:1,title:'Departamento',type:'Departamento',city:'Mar del Plata',ambientes:2,dormitorios:1},
      {id:2,title:'Departamento',type:'Departamento',city:'Miramar'},
      {id:3,title:'Oficina',type:'Oficina',city:'Mar del Plata'},
      {title:'Sin identificador',type:'Departamento',city:'Mar del Plata'}
    ]));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const website=`http://127.0.0.1:${server.address().port}`;
    const source={name:'Public',format:'publicJsonCatalog',website,catalogUrl:website+'/catalog',propertyPath:'/propiedad/{id}',jsonFields:{id:'id',title:'title',propertyType:'type',city:'city',rooms:'ambientes'}};
    const rows=await crawlSources({sources:[source],filters:{city:'Mar del Plata',propertyTypes:['Departamento']}});
    assert.equal(rows.length,1);assert.equal(rows[0].rooms,2);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('split property locations and labeled area retain their meaning beside a previous price',()=>{
  const fields=extractDetailListing('<h1>Chalet de 4 ambientes</h1><p class="detail-location">Colinas de Peralta Ramos · Mar del Plata</p><div class="detail-price"><del>USD 120000</del><strong>USD 100000</strong></div><dl><div><dt>Superficie cubierta</dt><dd>100 m²</dd></div></dl>',{preferConfiguredFields:true,locationSeparator:'·',detailFields:{city:'.detail-location',price:'.detail-price strong',area:'dl div:has(dt:contains(Superficie cubierta))'}});
  const row=finalizeListing('Vigo','https://agency.test/propiedades/chalet',fields);
  assert.equal(row.neighborhood,'Colinas de Peralta Ramos');assert.equal(row.city,'Mar del Plata');assert.equal(row.priceAmount,100000);assert.equal(row.areaKind,'cubierta');assert.equal(row.areaM2,100);
});

test('AJAX pagination advances both a zero-based page and its offset',async()=>{
  const calls=[];
  const server=createServer(async(request,response)=>{
    if(request.method==='POST'){
      let body='';for await(const chunk of request)body+=chunk;
      const form=new URLSearchParams(body),page=Number(form.get('pagina'));
      calls.push([page,Number(form.get('desde'))]);
      response.setHeader('content-type','application/json');response.end(JSON.stringify({html:`<a href="/propiedad/${page+1}">Ficha</a>`}));
    }else response.end('<h1>Departamento 2 ambientes</h1>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const website=`http://127.0.0.1:${server.address().port}`;
    const source={name:'AJAX',startUrls:[website+'/catalog'],listingSelector:'a[href]',publicationUrlRegex:'/propiedad/',detailFields:{title:'h1'},listingRequest:{method:'POST',responseHtmlField:'html',form:{pagina:0,desde:0,hasta:12}},pagination:{pageParam:'pagina',firstPage:1,offsetParam:'desde',pageSize:12,maxPages:3}};
    const rows=await crawlSources({sources:[source],request:{delayMs:1}});
    assert.deepEqual(calls,[[0,0],[1,12],[2,24]]);assert.equal(rows.length,3);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('a detail rate limit stops that agency while retaining previously extracted properties',async()=>{
  const seen=[],messages=[];
  const server=createServer((request,response)=>{
    seen.push(request.url);
    if(request.url==='/catalog')response.end('<a href="/propiedad/1">Uno</a><a href="/propiedad/2">Dos</a><a href="/propiedad/3">Tres</a>');
    else if(request.url==='/propiedad/2'){response.statusCode=429;response.end('Too many requests');}
    else response.end('<h1>Departamento 2 ambientes</h1>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const website=`http://127.0.0.1:${server.address().port}`;
    const rows=await crawlSources({sources:[{name:'Rate limited',startUrls:[website+'/catalog'],listingSelector:'a[href]',publicationUrlRegex:'/propiedad/',detailFields:{title:'h1'},request:{delayMs:1}}]},{logger:message=>messages.push(message)});
    assert.equal(rows.length,1);assert.ok(!seen.includes('/propiedad/3'));assert.ok(messages.some(message=>message.includes('límite temporal')));
  }finally{await new Promise(resolve=>server.close(resolve));}
});
