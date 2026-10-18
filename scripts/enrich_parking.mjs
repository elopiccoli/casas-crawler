import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import yaml from "js-yaml";
import { extractDetailListing } from "../src/crawler.js";
import { finalizeListing } from "../src/listing.js";
import { writeListingsWorkbook } from "../src/excel.js";

// Enrich the saved report without re-fetching every agency or changing the
// extraction dates and other fields of the existing publications.
const config = yaml.load(await readFile("config.yml", "utf8"));
const data = JSON.parse(await readFile("web/publicaciones.json", "utf8"));
for (const item of data.listings) {
  const source = config.sources.find(s => s.name === item.inmobiliaria) || {};
  const fields = { title: item.titulo, summary: item.resumen };
  const file = `outputs/pages/${createHash("sha256").update(item.link).digest("hex")}.html`;
  const html = await readFile(file, "utf8").catch(() => "");
  if (html) {
    const extracted = extractDetailListing(html, source, item.link, item.operacion);
    if (extracted.parkingRaw) {
      fields.parkingRaw = extracted.parkingRaw;
      fields.evidence = { parkingRaw: extracted.evidence.parkingRaw };
    }
  }
  const result = finalizeListing(item.inmobiliaria, item.link, fields);
  item.cochera = result.parking;
  if (result.evidence.parkingRaw) item.evidencia = { ...item.evidencia, parkingRaw: result.evidence.parkingRaw };
}
await writeListingsWorkbook(data.listings.map(item => ({
  sourceName: item.inmobiliaria, url: item.link, address: item.direccion,
  neighborhood: item.barrio, operation: item.operacion, propertyType: item.tipo,
  rooms: item.ambientes, parking: item.cochera, areaM2: item.metros,
  areaKind: item.superficieTipo, priceAmount: item.precio, currency: item.moneda,
  scrapedAt: new Date(item.fechaExtraccion)
})), "outputs/publicaciones.xlsx", config.excel);
data.generatedAt = new Date().toISOString();
await writeFile("web/publicaciones.json", JSON.stringify(data, null, 2) + "\n");
const count = items => items.reduce((counts, item) => {
  counts[item.cochera] = (counts[item.cochera] || 0) + 1;
  return counts;
}, {});
console.log(JSON.stringify({ total: data.count, cochera: count(data.listings), alquileres: count(data.listings.filter(item => /^Alquiler/.test(item.operacion))) }));
