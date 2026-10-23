import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { loadConfig } from '../src/config.js';
import { extractListingsFromPage, extractDetailListing, crawlSources } from '../src/crawler.js';
import { finalizeListing } from '../src/listing.js';
import { matchesFilters, sleep } from '../src/utils.js';
import { parseOperation, urlPath } from '../web/property-fields.js';

const args = process.argv.slice(2);
const option = (name, fallback) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const root = option('output', 'outputs/source-audit');
const config = await loadConfig(option('config', 'config.yml'));
const exclusions = JSON.parse(await readFile(option('exclude', `${root}/exclude.json`), 'utf8').catch(error => {
  if (error.code === 'ENOENT' && !args.some(arg=>arg.startsWith('--exclude='))) return '[]';
  throw error;
}));
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const excluded = new Set(exclusions.map(normalize));
const selected = config.sources.map((source, index) => ({ source, index })).filter(({source}) => !excluded.has(normalize(source.name)) && (!option('only', '') || source.name.includes(option('only', ''))));
const sampleCount = Number(option('samples', '3'));
const concurrency = Number(option('concurrency', '4'));
if(!Number.isInteger(sampleCount)||sampleCount<1||sampleCount>50)throw Error('--samples debe estar entre 1 y 50');
if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8)throw Error('--concurrency debe estar entre 1 y 8');
await mkdir(`${root}/pages`, { recursive: true });
const results = []; let cursor = 0;
const pacing = new Map();

async function download(url, source, listing = false) {
  const hash = createHash('sha256').update(url + (listing ? JSON.stringify(source.listingRequest || {}) : '')).digest('hex');
  const file = `${root}/pages/${hash}`;
  if (!args.includes('--refresh')) {
    const saved = JSON.parse(await readFile(`${file}.json`, 'utf8').catch(() => 'null'));
    if (saved) return {...saved, html: await readFile(`${file}.html`, 'utf8').catch(() => '')};
  }
  const request = listing ? source.listingRequest : null;
  let result;
  try {
    const host=new URL(url).host;
    const permit=(pacing.get(host)||Promise.resolve()).then(()=>sleep(source.request?.delayMs ?? config.request?.delayMs ?? 1000));
    pacing.set(host,permit);await permit;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(config.request?.timeoutMs || 20000),
      headers: {'user-agent': config.request?.userAgent || 'Mozilla/5.0', accept: 'text/html,application/xhtml+xml'},
      ...(request?.method === 'POST' ? {method:'POST', body:new URLSearchParams({...request.form, ...Object.fromEntries(new URL(url).searchParams)})} : {})
    });
    const html = request?.responseHtmlField && response.ok ? (await response.json())[request.responseHtmlField] : await response.text();
    result = {url, finalUrl: response.url, status:response.status, checkedAt:new Date().toISOString(), html:typeof html === 'string' ? html : '', error:response.ok ? '' : `HTTP ${response.status}`};
  } catch (error) { result = {url, status:null, checkedAt:new Date().toISOString(), html:'', error:error.message + (error.cause?.code ? ` (${error.cause.code})` : '')}; }
  await writeFile(`${file}.html`, result.html);
  const {html, ...metadata} = result;
  await writeFile(`${file}.json`, JSON.stringify(metadata));
  return result;
}

await Promise.all(Array.from({length:concurrency}, async () => {
  while (cursor < selected.length) {
    const {source, index} = selected[cursor++];
    console.log(`Revisando ${source.name}...`);
    const report = {name:source.name,index,enabled:source.enabled!==false,checkedAt:new Date().toISOString(),lists:[],samples:[],valid:0,matching:0,errors:[]};
    try {
      const homeUrl = source.website || new URL(source.startUrls[0]).origin + '/';
      const home = await download(homeUrl, source);
      report.home={url:homeUrl,status:home.status,finalUrl:home.finalUrl,checkedAt:home.checkedAt,title:cheerio.load(home.html)('title').text().trim(),error:home.error};
      if (source.format && ['adincoCatalog','mardelCatalog','publicJsonCatalog','potenteCatalog'].includes(source.format)) {
        // These adapters validate each record's structured identity and location.
        report.adapter=true;
        const saved = !args.includes('--refresh') ? JSON.parse(await readFile(`${root}/source-${index}.json`, 'utf8').catch(() => 'null')) : null;
        report.samples=saved?.adapter ? saved.samples : await crawlSources({...config,sources:[{...source,enabled:true,pagination:{...source.pagination,maxPages:1}}]}, {logger:m=>console.log(m)});
        report.catalogCheckedAt=saved?.catalogCheckedAt || saved?.checkedAt || new Date().toISOString();
        report.valid=report.samples.length;report.matching=report.valid;
      } else {
        const candidates = new Map();
        for (const start of source.startUrls || []) {
          const page=await download(start,source,true);
          const cards=page.error ? [] : extractListingsFromPage(cheerio.load(page.html),page.finalUrl || start,source);
          const operation=parseOperation(urlPath(start)) || parseOperation(new URL(start).searchParams.get('operacion'));
          report.lists.push({url:start,status:page.status,checkedAt:page.checkedAt,error:page.error,discovered:cards.length,operation});
          for(const card of cards) candidates.set(`${card.url}|${operation}`, {...card,requestedOperation:operation});
        }
        report.discovered=candidates.size;
        // Sample each operation, including a valid sample beyond missing/redirected pages.
        const operations=[...new Set([...candidates.values()].map(x=>x.requestedOperation))];
        for(const operation of operations) {
          const cards=[...candidates.values()].filter(x=>x.requestedOperation===operation);
          let examined=0, matchingOperation=0;
          for(const card of cards) {
            if(examined >= sampleCount && (matchingOperation || examined >= Math.max(sampleCount,12))) break;
            examined++;
            const page=await download(card.url,source);
            const fields=page.error ? {error:page.error} : extractDetailListing(page.html,source,card.url,operation);
            const own=finalizeListing(source.name,card.url,fields);
            const listing=finalizeListing(source.name,card.url,{...card,...Object.fromEntries(Object.entries(fields).filter(([,v])=>v!=null && v!==''))});
            const valid=!page.error && !!own.title && !!own.propertyType && !!(own.address || own.priceAmount || own.areaM2 || own.rooms);
            const matching=valid && matchesFilters(listing,{...config.filters,...source.filters});
            report.samples.push({url:card.url,status:page.status,checkedAt:page.checkedAt,error:page.error,valid,matching,listing});
            if(valid) report.valid++;
            if(matching) { report.matching++;matchingOperation++; }
          }
        }
      }
      report.status=report.matching ? 'extracción verificada con muestra' : report.valid ? 'extrae fichas; revisar filtros' : report.lists.some(x=>x.discovered) ? 'fallo de extracción de ficha' : report.lists.some(x=>!x.error) ? 'sin fichas descubiertas' : 'sitio/listados inaccesibles';
    } catch (error) { report.errors.push(error.message);report.status='error de auditoría'; }
    const sampled=report.adapter ? report.samples : report.samples.map(sample=>sample.listing).filter(Boolean);
    report.fieldCoverage=Object.fromEntries(['address','operation','priceAmount','areaM2','rooms'].map(field=>[field,{present:sampled.filter(listing=>listing[field]!=null && listing[field]!=='').length,examined:sampled.length}]));
    results.push(report);
    await writeFile(`${root}/source-${index}.json`, JSON.stringify(report,null,2));
    console.log(`${source.name}: ${report.status}; ${report.matching} válidas para filtros / ${report.discovered??report.valid} descubiertas`);
  }
}));
results.sort((a,b)=>a.index-b.index);
const report={checkedAt:new Date().toISOString(),excluded:config.sources.filter(s=>excluded.has(normalize(s.name))).map(s=>s.name),examined:results.length,sources:results};
await writeFile(`${root}/${option('only','') ? 'selected-report' : 'report'}.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({examined:results.length,excluded:report.excluded.length,verified:results.filter(x=>x.matching).length}));
