import * as cheerio from 'cheerio';
import { finalizeListing } from './listing.js';
import { matchesFilters, normalizeText } from './utils.js';

export function potenteFields(item) {
  const dollars=Number(item.precioUSD)>0, pesos=Number(item.precioARS)>0;
  const fields={title:item.titulo,address:item.direccion,city:[item.zona,item.provincia].filter(Boolean).join(', '),
    neighborhood:item.zona?.replace(/,\s*Mar del Plata\s*$/i,''),propertyType:item.categoria,operation:item.operacion,
    roomsRaw:item.ambientes>0?String(item.ambientes):'',parkingRaw:item.cocheras!=null?String(item.cocheras):'',
    areaRaw:item.m2cubiertos>0?`${item.m2cubiertos} m2 cubierta`:item.m2totales>0?`${item.m2totales} m2 total`:'',
    totalAreaRaw:item.m2totales>0?`${item.m2totales} m2 total`:'',
    priceRaw:dollars!==pesos?`${dollars?'USD':'ARS'} ${dollars?item.precioUSD:item.precioARS}`:'',priceAmbiguous:dollars&&pesos,
    summary:normalizeText(item.descripcion),evidence:{}};
  const columns={title:'titulo',address:'direccion',city:'zona + provincia',neighborhood:'zona',propertyType:'categoria',operation:'operacion',roomsRaw:'ambientes',parkingRaw:'cocheras',areaRaw:'m2cubiertos / m2totales',totalAreaRaw:'m2totales',priceRaw:'precioUSD / precioARS'};
  for(const [field,column]of Object.entries(columns))if(fields[field])fields.evidence[field]={selector:`public catalog: ${column}`,value:fields[field]};
  return fields;
}

export function publicPotenteConnection(script) {
  const endpoint=script.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
  const key=[...script.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map(match=>match[0]).find(value=>{
    try{return JSON.parse(Buffer.from(value.split('.')[1],'base64url')).role==='anon';}catch{return false;}
  }) || script.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
  if(!endpoint||!key)throw Error('La web no publicó su conexión anónima de catálogo');
  return {endpoint,key};
}

export async function crawlPotente(source, requestConfig, globalFilters) {
  const get=async(url,headers={})=>{
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(requestConfig.timeoutMs||20000)});
    if(!response.ok)throw Error(`HTTP ${response.status} al descargar ${new URL(url).origin}`);
    return response;
  };
  const home=await get(source.website),$=cheerio.load(await home.text());
  const script=$('script[type="module"][src*="/assets/index-"]').first().attr('src');
  if(!script)throw Error('No se encontró el módulo público del catálogo de Potente');
  const {endpoint,key}=publicPotenteConnection(await(await get(new URL(script,source.website))).text());
  const columns='id,categoria,titulo,operacion,precioUSD,precioARS,zona,provincia,direccion,estado,ambientes,cocheras,m2cubiertos,m2totales,descripcion';
  const listings=[];
  for(let offset=0;offset<10000;offset+=1000){
    const url=new URL('/rest/v1/potente_propiedades_web',endpoint);
    url.searchParams.set('select',columns);url.searchParams.set('limit','1000');url.searchParams.set('offset',String(offset));url.searchParams.set('order','id.asc');
    const items=await(await get(url,{apikey:key})).json();
    if(!Array.isArray(items))throw Error('El catálogo público de Potente no devolvió una lista válida');
    for(const item of items){
      if(!item.id||!['activa','reservada'].includes(item.estado))continue;
      const listing=finalizeListing(source.name,new URL(`/propiedad/${encodeURIComponent(item.id)}`,source.website).href,potenteFields(item));
      if(matchesFilters(listing,{...globalFilters,...source.filters}))listings.push(listing);
    }
    if(items.length<1000)return listings;
  }
  throw Error('El catálogo superó el límite de paginación; no se publica una descarga truncada');
}
