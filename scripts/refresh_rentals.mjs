import { readFile, writeFile, mkdir } from "node:fs/promises";
import yaml from "js-yaml";
import { crawlSources } from "../src/crawler.js";
import { writeListingsJson } from "../src/json.js";
import { writeListingsWorkbook } from "../src/excel.js";

const config = yaml.load(await readFile("config.yml", "utf8"));
const previous = JSON.parse(await readFile("web/publicaciones.json", "utf8"));
const supplement = process.argv.includes("--reuse-supplement")
  ? JSON.parse(await readFile("outputs/operations/rental-supplement.json", "utf8"))
  : { sources: [], listings: [] };
const excluded = new Set((process.argv.find(arg => arg.startsWith("--exclude="))?.slice(10) || "").split("|"));
const reused = new Set(supplement.sources.map(s => s.name));
const sources = config.sources.filter(s => s.enabled !== false && !excluded.has(s.name) && !reused.has(s.name) && (!process.argv.includes("--native-only") || s.publicationUrlRegex?.includes("propiedad-inmobiliaria"))).map(s => ({
  ...s, startUrls: s.startUrls.filter(url => /alquil|24meses/i.test(url))
})).filter(s => s.startUrls.length);
const results = supplement.listings.map(item => ({ ...item, scrapedAt: new Date(item.scrapedAt) }));
const status = [...supplement.sources, ...[...excluded].filter(Boolean).map(name => ({ name, rentals: 0, warnings: ["HTTP 429 observed during this refresh; no immediate retry"] }))];
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < sources.length) {
    const source = sources[cursor++];
    console.log(`Consultando alquileres: ${source.name}`);
    const warnings = [];
    const listings = await crawlSources({ ...config, sources: [source] }, {
      logger: message => { if (/error|listado .*:/.test(message)) warnings.push(message); }
    });
    const rentals = listings.filter(item => /^Alquiler/.test(item.operation));
    results.push(...rentals);
    status.push({ name: source.name, rentals: rentals.length, warnings });
    await writeFile(`outputs/operations/rental-checkpoint-${sources.indexOf(source)}.json`, JSON.stringify({ source: status.at(-1), listings: rentals }, null, 2) + "\n");
    console.log(JSON.stringify(status.at(-1)));
  }
}));
if (process.argv.includes("--collect-only")) {
  await writeFile("outputs/operations/rental-supplement.json", JSON.stringify({ sources: status, listings: results }, null, 2) + "\n");
  console.log(JSON.stringify({ collectedRentals: results.length }));
  process.exit(0);
}
const active = new Set(config.sources.filter(s => s.enabled !== false).map(s => s.name));
const old = previous.listings.filter(item => active.has(item.inmobiliaria)).map(item => ({
  sourceName: item.inmobiliaria, url: item.link, address: item.direccion,
  neighborhood: item.barrio, operation: item.operacion, propertyType: item.tipo,
  rooms: item.ambientes ?? null, areaM2: item.metros, areaKind: item.superficieTipo,
  parking: item.cochera || "No informado",
  priceAmount: item.precio, currency: item.moneda, title: item.titulo,
  summary: item.resumen, issues: item.revision || [], evidence: item.evidencia || {},
  scrapedAt: new Date(item.fechaExtraccion)
}));
const merged = new Map(old.map(item => [`${item.url}|${item.operation}`, item]));
for (const item of results) merged.set(`${item.url}|${item.operation}`, item);
const listings = [...merged.values()];
await mkdir("outputs/operations", { recursive: true });
await writeFile("outputs/operations/rental-refresh.json", JSON.stringify({
  checkedAt: new Date().toISOString(), sources: status,
  rentals: results.length, rentalApartments: results.filter(item => item.propertyType === "Departamento").length,
  total: listings.length
}, null, 2) + "\n");
await writeListingsWorkbook(listings, "outputs/publicaciones.xlsx", config.excel);
await writeListingsJson(listings, "web/publicaciones.json", config);
console.log(JSON.stringify({ refreshedRentals: results.length, total: listings.length }));
