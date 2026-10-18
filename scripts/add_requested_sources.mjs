import { readFile, writeFile } from "node:fs/promises";
import yaml from "js-yaml";
import * as cheerio from "cheerio";
import { extractDetailListing } from "../src/crawler.js";
import { finalizeListing } from "../src/listing.js";

const config = yaml.load(await readFile("config.yml", "utf8"));
const manifest = JSON.parse(await readFile("outputs/new-sources/manifest.json", "utf8"));
const samples = JSON.parse(await readFile("outputs/new-sources/listings.json", "utf8"));
const host = url => new URL(url).hostname.replace(/^www\./, "");
const template = name => structuredClone(config.sources.find(s => s.name === name));
const updates = [];
for (const item of manifest) {
  const canonical = item.finalUrl || item.url;
  const existing = config.sources.find(s => s.startUrls.some(url => [host(item.url), host(canonical)].includes(host(url))));
  if (existing) {
    existing.website = item.url;
    updates.push({ name: existing.name, status: "already included" });
    continue;
  }
  const origin = new URL(canonical).origin;
  const sample = samples.find(s => s.name === item.name);
  const home = cheerio.load(await readFile(item.file, "utf8"));
  const known = [...new Set([...(item.links || []), ...(sample?.links || [])])];
  let source;
  if (["Arbini Propiedades", "Introcaso Propiedades", "Napolitano Inmobiliaria", "Cecilia Martini Inmobiliaria"].includes(item.name)) {
    source = template("Gisela D’Alessandro");
    const rentals = known.find(url => new URL(url).pathname === "/Alquiler");
    const sales = known.find(url => new URL(url).pathname === "/Venta");
    source.startUrls = rentals && sales ? [rentals, sales] : [origin + "/Propiedades"];
  } else if (["Coste y Freuler", "Abdala Propiedades"].includes(item.name)) {
    source = template("Dante Propiedades");
    source.startUrls = known.filter(url => /^\/(?:departamento|casa-chalet)-en-(?:alquiler|venta)\.html$/.test(new URL(url).pathname));
    source.preferConfiguredFields = true;
    source.detailFields.propertyType = ".caracteristicasDeFicha li:has(strong:contains('Tipo:')) span, h1";
    source.detailFields.area = ".caracteristicasDeFicha li:has(strong:contains('Superficie Cubierta')) span, .caracteristicasDeFicha li:has(strong:contains('Superficie Total')) span";
  } else if (item.name === "Torres Inmobiliaria") {
    source = template("Latorre Negocios Inmobiliarios");
    source.startUrls = known.filter(url => /\/s\/(?:casa|chalet|departamento)\/(?:ventas|alquileres)\?/.test(url));
    source.notes = "El dominio solicitado redirige al catalogo oficial en torresmardelplata.inmo.co.";
  } else if (item.name === "Gustavo Teruel") {
    source = template("VA Propiedades");
    source.startUrls = [origin + "/propiedades/"];
    source.fields.city = ".item-address";
    source.detailFields.propertyType = "#property-detail-wrap li:contains('Tipo'), #property-detail-wrap li:contains('Property Type')";
  } else {
    source = { startUrls: [sample?.url || canonical], pagination: { maxPages: 1 }, listingSelector: "a[href]", preferConfiguredFields: true, detailFields: {} };
    if (item.name === "Matías Sosa Broker Inmobiliario") {
      source.publicationUrlRegex = "/propiedad/\\d+";
      source.detailFields = { title: ".property_header h1, h1", price: ".property_header_col h2", address: ".property_header_location", city: "h1", propertyType: "h1" };
    } else if (item.name === "Nizzi Propiedades") {
      source.startUrls = known.filter(url => /\/propiedades\?operacion=[12]$/.test(url));
      source.publicationUrlRegex = "-ficha-[a-z]+\\d+";
      source.detailFields = { title: "h2.text-2xl:first", price: "h1", operation: "h1", propertyType: "h2.text-2xl:first", city: "span.text-gray-300", summary: ".prose" };
    } else if (item.name === "Redondo Inmobiliaria") {
      source.startUrls = [origin + "/site/properties/rental", origin + "/site/properties/sale"];
      source.publicationUrlRegex = "/site/properties/\\d+/";
      source.detailFields = { title: ".about-property h2:first", price: ".price-column .price", city: ".about-property .location, .location:first", propertyType: ".about-property h2:first", summary: ".property-description" };
    } else if (item.name === "Selecto Propiedades") {
      source.publicationUrlRegex = "/p/\\d+/";
      source.detailFields = { title: "h1", price: "p.h1", city: "title", propertyType: "h1" };
    } else if (item.name === "Zicarelli Real Estate") {
      source.publicationUrlRegex = "/ad/[^/?#]+";
      source.detailFields = { title: ".detail__title", price: ".detail__price", address: ".detail__address", city: ".detail__address", area: ".detail__main dl div:has(dt:contains('Superficie cubierta'))", propertyType: ".detail__title", summary: ".detail__description" };
    } else if (item.name === "Gonnet Propiedades") {
      source.publicationUrlRegex = "/(?:propiedad|propiedades|ficha)/[^/?#]+";
      source.notes = "Sitio accesible; la pagina principal no expone enlaces de fichas en HTML. Extraccion pendiente de adaptador para su buscador cliente.";
      source.detailFields = { title: "h1" };
    }
  }
  source.name = item.name;
  source.website = item.url;
  source.enabled = true;
  if (!source.startUrls.length) source.startUrls = [canonical];
  config.sources.push(source);
  const validation = { name: source.name, status: "added", startUrls: source.startUrls };
  if (sample?.detailFile) {
    const listing = finalizeListing(source.name, sample.detailUrl, extractDetailListing(await readFile(sample.detailFile, "utf8"), source, sample.detailUrl));
    validation.sample = { title: listing.title, price: listing.priceAmount, type: listing.propertyType, city: listing.city, rooms: listing.rooms, parking: listing.parking };
  }
  updates.push(validation);
}
const byWebsite = config.sources.filter(s => s.website).map(s => host(s.website));
if (new Set(byWebsite).size !== byWebsite.length) throw new Error("Duplicate website");
await writeFile("config.yml", yaml.dump(config, { lineWidth: -1, noRefs: true }));
await writeFile("outputs/new-sources/registration.json", JSON.stringify(updates, null, 2) + "\n");
console.log(JSON.stringify({ added: updates.filter(s => s.status === "added").length, existing: updates.filter(s => s.status === "already included").length, total: config.sources.length, active: config.sources.filter(s => s.enabled !== false).length }));
