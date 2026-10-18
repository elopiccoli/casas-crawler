import { readFile, writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";
const manifest = JSON.parse(await readFile("outputs/new-sources/manifest.json", "utf8"));
const routes = {
  "Gustavo Teruel": "/propiedades/", "Coste y Freuler": "/departamento-en-alquiler.html",
  "Matías Sosa Broker Inmobiliario": "/comprar-alquilar", "Nizzi Propiedades": "/propiedades?operacion=2",
  "Arbini Propiedades": "/Propiedades", "Redondo Inmobiliaria": "/site/properties/rental",
  "Selecto Propiedades": "/buscar", "Introcaso Propiedades": "/Alquiler",
  "Napolitano Inmobiliaria": "/Alquiler", "Cecilia Martini Inmobiliaria": "/Alquiler",
  "Abdala Propiedades": "/departamento-en-alquiler.html", "Torres Inmobiliaria": "/s/alquileres"
};
const output = [];
let cursor = 0;
const items = manifest.filter(item => !item.existing);
await Promise.all(Array.from({length:4}, async () => {
  while (cursor < items.length) {
    const item = items[cursor++];
    const index = manifest.indexOf(item);
    const url = new URL(routes[item.name] || "/", item.finalUrl || item.url).href;
    const record = { name: item.name, url, index };
    try {
      const response = await fetch(url, {signal:AbortSignal.timeout(15000)});
      const html = await response.text();
      record.status = response.status;
      record.file = `outputs/new-sources/${index}-list.html`;
      await writeFile(record.file, html);
      const $ = cheerio.load(html);
      const origin = new URL(response.url).origin;
      record.links = [...new Set($("a[href]").map((i,e) => {
        try { return new URL($(e).attr("href"), response.url).href; } catch { return ""; }
      }).get())].filter(link => link.startsWith(origin));
      const detail = record.links.find(link => /\/p\/\d|propiedad-inmobiliaria|\/property\/|ficha-|\/ad\/|\/site\/properties\/\d|(?:casa|chalet|departamento)-(?:venta|alquiler).*\/\d/.test(link));
      record.detailUrl = detail;
      if (detail && response.ok) {
        const detailResponse = await fetch(detail, {signal:AbortSignal.timeout(15000)});
        record.detailStatus = detailResponse.status;
        record.detailFile = `outputs/new-sources/${index}-detail.html`;
        await writeFile(record.detailFile, await detailResponse.text());
      }
      console.log(JSON.stringify({...record, links:record.links.filter(link=>/inmueble|ficha|property|propiedad|\/p\//.test(link)).slice(0,5)}));
    } catch(error) { record.error = error.message; console.log(item.name, error.message); }
    output.push(record);
  }
}));
await writeFile("outputs/new-sources/listings.json", JSON.stringify(output,null,2)+"\n");
