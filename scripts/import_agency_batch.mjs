import { readFile, writeFile, mkdir } from "node:fs/promises";
import yaml from "js-yaml";
import * as cheerio from "cheerio";

const requested = [
  ["Abel Carranza Propiedades", "carranzapropiedades.com.ar"],
  ["Aboglio Propiedades", "inmobiliariaaboglio.com"],
  ["Acámpora y Asociados", "acamporayasoc.com"],
  ["Ademar Ocaranza", "ademarocaranza.com"],
  ["C. A. Di Bártolo e Hijos", "cadibartoloehijos.com.ar"],
  ["Administración Julián Santillán", "juliansantillan.com"],
  ["Aguilera Propiedades", "aguilerapropiedades.com.ar"],
  ["Aguirre Propiedades", "aguirreprop.com"],
  ["Aiello Propiedades", "aiellopropiedades.com.ar"],
  ["Alejandro Aiello", "alejandroaiello.com"],
  ["Alan Propiedades", "alanpropiedades.com.ar"],
  ["Alba Propiedades", "albapropiedades.com"],
  ["Alberto B. Rossi Propiedades", "rossipropiedadesmdp.com.ar"],
  ["Alberto Turlán", "turlaninmobiliaria.com.ar"],
  ["Zamboni Propiedades", "zambonipropiedades.com"],
  ["De Santis Propiedades", "desantispropiedades.com.ar"],
  ["Burga Propiedades", "walterburga.com"],
  ["Bartolini Propiedades", "bartolinipropiedades.com"],
  ["Marta Moghames", "moghames.com.ar"],
  ["Iza Inmobiliaria", "iza.com.ar"],
  ["La Pérgola Propiedades", "lapergolapropiedades.com"],
  ["Oreste Gonnet Inmobiliaria", "orestegonnet.com.ar"],
  ["GMC Propiedades", "gmcpropiedades.com"],
  ["La Plata Propiedades", "laplatapropiedades.com"],
  ["Mar del Plata Propiedades", "mardelplatapropiedades.net"],
  ["Breccia Inmuebles y Negocios", "breccianegocios.com.ar"],
  ["Zulma Castillo Propiedades", "zcastillopropiedades.com"],
  ["Scutella Propiedades", "scutellapropiedades.com.ar"],
  ["Santia Propiedades", "santiapropiedades.com.ar"],
  ["Galán Broker Inmobiliario", "galanbroker.com"],
  ["Allende Propiedades", "allendepropiedades.com.ar"],
  ["Canicoba Propiedades", "canicoba.com.ar"],
  ["Berto Propiedades", "bertopropiedades.com.ar"],
  ["Urbana Propiedades", "urbanapropiedades.com"],
  ["M y F Propiedades", "myfpropiedades.com"],
  ["Vigo Consultores Inmobiliarios", "vigo.com.ar"],
  ["Nesca Propiedades", "nescapropiedades.com"],
  ["Inmobiliaria Castillo", "inmobiliariacastillo.com.ar"],
  ["Quintiero Propiedades", "quintieroprop.com.ar"],
  ["Duque Williams Propiedades", "duquewilliams.com"],
  ["Bocian Propiedades", "bocianpropiedades.com"],
  ["Spano Propiedades", "spanopropiedades.com.ar"],
  ["DePaoli Propiedades", "depaolipropiedades.com.ar"],
  ["Salerno Propiedades", "salerno-propiedades.com.ar"],
  ["Pezzati Propiedades", "pezzatipropiedades.inmobiliatica.com"],
  ["DAR Propiedades", "darpropiedades.com.ar"],
  ["Potente Propiedades", "potentepropiedades.com"],
  ["Messina Propiedades", "messinapropiedadesmdp.com.ar"],
  ["RP Bienes Raíces", "rpbienesraices.com"],
  ["Alejandra Dal Molin", "alejandradalmolin.com.ar"],
  ["Patricio Propiedades", "patriciopropiedades.com.ar"],
  ["Palma Propiedades", "palmapropiedades.com.ar"],
  ["Crespo Inmobiliaria", "inmobiliariacrespo.com"],
  ["Finca Inmobiliaria", "inmobiliariafinca.com.ar"],
  ["Inmobiliaria Mihocevich", "inmobiliariamihocevich.com.ar"],
  ["Alías Propiedades", "aliaspropiedades.com.ar"]
];
const directory = "outputs/agency-batch";
await mkdir(directory, { recursive: true });
const config = yaml.load(await readFile("config.yml", "utf8"));
const host = url => new URL(url).hostname.replace(/^www\./, "");
const normalizedName = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const findExisting = (name, url, finalUrl = url) => config.sources.find(s =>
  normalizedName(s.name) === normalizedName(name) || [s.website, ...(s.startUrls || [])].filter(Boolean).some(value => [host(url), host(finalUrl)].includes(host(value))));
const manifestPath = `${directory}/manifest.json`;
let manifest;
if (process.argv.includes("--inspect")) {
  manifest = new Array(requested.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (cursor < requested.length) {
      const index = cursor++;
      const [name, domain] = requested[index];
      const url = `https://${domain}`;
      const existing = findExisting(name, url);
      const item = { name, url, index };
      if (existing) item.existing = existing.name;
      else {
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
          item.status = response.status;
          item.finalUrl = response.url;
          const html = await response.text();
          item.file = `${directory}/${index}-home.html`;
          await writeFile(item.file, html);
          const $ = cheerio.load(html);
          item.title = $("title").text().trim().slice(0,180);
          const base = new URL($("base[href]").attr("href") || response.url, response.url).href;
          item.links = [...new Set($("a[href]").map((i, e) => {
            try { return new URL($(e).attr("href"), base).href; } catch { return ""; }
          }).get())].filter(value => value && host(value) === host(response.url));
        } catch (error) { item.error = error.cause?.code || error.message; }
      }
      manifest[index] = item;
      console.log(JSON.stringify({ name, existing: item.existing, status: item.status, error: item.error, links: item.links?.filter(value => /alquil|venta|properties|propiedades|\/p\//i.test(value)).slice(0,3) }));
    }
  }));
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
} else manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (!process.argv.includes("--register")) process.exit(0);
const clone = name => structuredClone(config.sources.find(source => source.name === name));
const report = [];
for (const item of manifest) {
  const existing = findExisting(item.name, item.url, item.finalUrl);
  if (existing) {
    existing.websites = [...new Set([...(existing.websites || []), ...(existing.website ? [existing.website] : []), item.url])];
    report.push({ name: existing.name, website: item.url, status: "already included" });
    continue;
  }
  const origin = new URL(item.finalUrl || item.url).origin;
  const unrelatedRedirect = item.finalUrl && host(item.finalUrl) !== host(item.url) && !/\.(?:inmo\.co|inmobiliatica\.com|tuinmobiliaria\.com\.ar)$/.test(host(item.finalUrl));
  const links = unrelatedRedirect ? [] : item.links || [];
  const html = item.file ? await readFile(item.file, "utf8") : "";
  let source;
  let adapter = "pending";
  if (item.status === 200 && links.some(url => /^\/(Venta|Alquiler|Propiedades)$/.test(new URL(url).pathname))) {
    adapter = "Tokko";
    source = clone("Gisela D’Alessandro");
    const rental = links.find(url => new URL(url).pathname === "/Alquiler");
    const sale = links.find(url => new URL(url).pathname === "/Venta");
    source.startUrls = rental && sale ? [rental, sale] : links.filter(url => new URL(url).pathname === "/Propiedades");
    if (!source.startUrls.length) source.startUrls = rental ? [rental] : [item.finalUrl || item.url];
  } else if (item.status === 200 && links.some(url => /(?:propiedad-inmobiliaria|(?:departamento|casa-chalet)-en-(?:venta|alquiler)\.html)/.test(url))) {
    adapter = "Mardelplata";
    source = clone("Coste y Freuler");
    source.startUrls = links.filter(url => /^\/(?:departamento|casa-chalet)-en-(?:alquiler|venta)\.html$/.test(new URL(url).pathname));
    if (!source.startUrls.length) source.startUrls = links.filter(url => /^\/propiedad-en-(?:alquiler|venta)\.html$/.test(new URL(url).pathname));
  } else if (item.status === 200 && links.some(url => /\/s\/.*[?&]business_type/.test(url))) {
    adapter = "Wasi";
    source = clone("Latorre Negocios Inmobiliarios");
    source.startUrls = links.filter(url => /\/s\/(?:casa|chalet|departamento)\/(?:ventas?|alquiler(?:es)?)\?/.test(url));
    if (!source.startUrls.length) source.startUrls = links.filter(url => /\/s\/(?:ventas?|alquiler(?:es)?)$/.test(new URL(url).pathname));
  } else if (!unrelatedRedirect && item.status === 200 && (links.some(url => /\/property\//.test(url)) || /class=["'][^"']*item-listing-wrap/i.test(html))) {
    adapter = "Houzez";
    source = clone("VA Propiedades");
    source.startUrls = links.filter(url => /^\/(?:comprar|alquilar|propiedades|properties|venta|alquiler)\/?$/.test(new URL(url).pathname));
  } else {
    source = { startUrls: [item.url], pagination: { maxPages: 1 }, listingSelector: "a[href]", publicationUrlRegex: "/(?:p/\\d|propiedad(?:es)?/|property/|inmueble/|ad/)", detailFields: { title: "h1", city: "meta[property='og:title']::attr(content)" } };
    const catalogs = links.filter(url => /^\/(?:propiedades|properties|buscar|venta|alquiler|alquileres|ventas)\/?$/i.test(new URL(url).pathname));
    if (catalogs.length) source.startUrls = catalogs;
  }
  source.name = item.name;
  source.website = item.url;
  delete source.websites;
  source.enabled = adapter !== "pending";
  if (!source.startUrls.length) source.startUrls = [item.finalUrl || item.url];
  source.notes = adapter === "pending"
    ? `URL registrada. ${unrelatedRedirect ? `Redirige a ${item.finalUrl}; no se atribuyen al agente los avisos del directorio de destino.` : item.error ? `Consulta fallida: ${item.error}.` : `HTTP ${item.status}; no se identifico un adaptador de catalogo compatible.`} Extraccion pendiente de verificacion/adaptacion.`
    : `Catalogo identificado como ${adapter}; URLs descubiertas en el sitio publico, ventas y alquileres donde estan disponibles. Campos por verificar en la proxima extraccion.`;
  config.sources.push(source);
  report.push({ name: source.name, website: item.url, status: "added", adapter, httpStatus: item.status, error: item.error, startUrls: source.startUrls });
}
await writeFile("config.yml", yaml.dump(config, { lineWidth: -1, noRefs: true }));
await writeFile(`${directory}/registration.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ requested: requested.length, added: report.filter(row => row.status === "added").length, existing: report.filter(row => row.status === "already included").length, total: config.sources.length, active: config.sources.filter(row => row.enabled !== false).length, pending: report.filter(row => row.adapter === "pending").length }));
