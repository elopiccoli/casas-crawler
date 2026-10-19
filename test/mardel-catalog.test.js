import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mardelCatalogFields, mardelPropertyUrl } from "../src/mardel-catalog.js";
import { finalizeListing } from "../src/listing.js";
import { crawlSources } from "../src/crawler.js";

const property = { id: 123, titulo: "Departamento 3 ambientes", calle: "Colon", numero: 1234,
  ciudad: "Mar del Plata", barrio_nombre: "Centro", tipo_operacion: "Alquiler", tipo_inmueble: "Departamento",
  moneda: 1, precio: "600000.00", dpto_ambientes: 3, dpto_cocheras: 1, dpto_sup_cubierta: 70,
  casa_ambientes: null, casa_cocheras: null, descripcion: "<p>Departamento luminoso.</p>" };

test("Mar del Inmueble keeps structured rooms, parking, currency, area and withheld prices", () => {
  const source = { website: "https://loreleypropiedades.com" };
  const listing = finalizeListing("Loreley", mardelPropertyUrl(source, property), mardelCatalogFields(property));
  assert.equal(listing.rooms, 3);
  assert.equal(listing.parking, "Sí");
  assert.equal(listing.areaM2, 70);
  assert.equal(listing.priceAmount, 600000);
  assert.equal(listing.currency, "$");
  assert.equal(listing.neighborhood, "Centro");
  assert.equal(listing.url, "https://loreleypropiedades.com/inmueble/123");
  const missing = finalizeListing("Loreley", listing.url, mardelCatalogFields({ ...property, dpto_cocheras: null, no_publicar_precio: 1 }));
  assert.equal(missing.parking, "No informado");
  assert.equal(missing.priceAmount, null);
  assert.equal(missing.evidence.priceRaw, undefined);
  const absent = finalizeListing("Loreley", listing.url, mardelCatalogFields({ ...property, dpto_cocheras: 0 }));
  assert.equal(absent.parking, "No");
  const land = finalizeListing("Loreley", listing.url, mardelCatalogFields({ ...property, titulo: "Terreno en venta", tipo_inmueble: "Terreno", moneda: 2, terreno_sup_terreno: 300, precio: "25000.00" }));
  assert.equal(land.rooms, null);
  assert.equal(land.areaM2, 300);
  assert.equal(land.currency, "USD");
  assert.equal(land.parking, "No informado");
});

test("public catalog pagination fetches only the selected catalog and applies existing filters", async () => {
  const paths = [];
  const server = createServer((req, res) => {
    paths.push(req.url);
    const page = Number(new URL(req.url, "http://localhost").searchParams.get("page"));
    const rows = page === 1 ? Array.from({ length: 50 }, (_, index) => ({ ...property, id: index + 1 })) : [{ ...property, id: 51 }];
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true, total: 51, inmuebles: rows }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const catalogUrl = `http://127.0.0.1:${server.address().port}/catalog?id_inmobiliaria=14`;
    const results = await crawlSources({ request: { delayMs: 1 }, filters: { city: "Mar del Plata", propertyTypes: ["Departamento"] }, sources: [{
      name: "Selected", website: "https://loreleypropiedades.com", startUrls: ["https://never-fetch.example"], format: "mardelCatalog", catalogUrl
    }] });
    assert.equal(results.length, 51);
    assert.equal(paths.length, 2);
    assert.ok(paths.every(path => path.includes("items_x_page=50") && path.includes("id_inmobiliaria=14")));
    assert.ok(paths[1].includes("page=2"));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
