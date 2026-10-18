import { readFile, writeFile, mkdir } from "node:fs/promises";
import yaml from "js-yaml";
import * as cheerio from "cheerio";

const requested = [
  ["Gustavo Teruel", "https://gustavoteruel.com"],
  ["Coste y Freuler", "https://www.costeyfreuler.com"],
  ["Matías Sosa Broker Inmobiliario", "https://www.matiassosa.com.ar"],
  ["Gonnet Propiedades", "https://www.gonnet.com.ar"],
  ["Nizzi Propiedades", "https://www.nizzipropiedades.com"],
  ["Arbini Propiedades", "https://www.arbinipropiedades.com.ar"],
  ["Redondo Inmobiliaria", "https://redondo.com.ar"],
  ["Selecto Propiedades", "https://selectopropiedades.com"],
  ["Visciarelli Abad Propiedades", "https://vapropiedades.com.ar"],
  ["Introcaso Propiedades", "https://www.introcasopropiedades.com.ar"],
  ["Del Rosso & Asociados", "https://delrossopropiedades.com.ar"],
  ["Zicarelli Real Estate", "https://zicarelli.com.ar"],
  ["Estudio Uno Propiedades", "https://www.estudiounopropiedades.com"],
  ["Sanz y Ordoqui Propiedades", "https://www.sanzyordoqui.com.ar"],
  ["Napolitano Inmobiliaria", "https://www.napolitanoinmobiliaria.com.ar"],
  ["Cecilia Martini Inmobiliaria", "https://www.ceciliamartini.com"],
  ["Abdala Propiedades", "https://abdalapropiedades.com"],
  ["Marino Pérez Propiedades", "https://www.marinoperez.com.ar"],
  ["Torres Inmobiliaria", "https://torresmardelplata.com"]
];
const host = value => new URL(value).hostname.replace(/^www\./, "");
const config = yaml.load(await readFile("config.yml", "utf8"));
const directory = "outputs/new-sources";
await mkdir(directory, { recursive: true });
const results = new Array(requested.length);
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < requested.length) {
    const index = cursor++;
    const [name, url] = requested[index];
    const existing = config.sources.find(source => source.startUrls.some(start => host(start) === host(url)));
    if (existing) {
      results[index] = { name, url, existing: existing.name };
    } else {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        const html = await response.text();
        const file = `${directory}/${index}-home.html`;
        await writeFile(file, html);
        const $ = cheerio.load(html);
        const base = new URL($("base[href]").attr("href") || response.url, response.url).href;
        const links = [...new Set($("a[href]").map((i, e) => {
          try { return new URL($(e).attr("href"), base).href; } catch { return ""; }
        }).get())].filter(link => link && host(link) === host(response.url));
        results[index] = { name, url, finalUrl: response.url, status: response.status, file, links };
      } catch (error) { results[index] = { name, url, error: error.message }; }
    }
    const item = results[index];
    console.log(JSON.stringify({ ...item, links: item.links?.filter(link => /venta|alquil|comprar|propiedad|properties|\/p\//i.test(link)).slice(0,18) }));
  }
}));
await writeFile(`${directory}/manifest.json`, JSON.stringify(results, null, 2) + "\n");
