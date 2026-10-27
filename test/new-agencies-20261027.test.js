import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.js";
import { crawlSources, extractDetailListing } from "../src/crawler.js";
import { finalizeListing } from "../src/listing.js";
import { matchesFilters } from "../src/utils.js";

const config = await loadConfig(fileURLToPath(new URL("../config.yml", import.meta.url)));

test("Rodríguez-Amigo uses its Wasi detail fields instead of property types from the navigation", () => {
  const source = config.sources.find(s => s.name === "Rodríguez-Amigo Negocios Inmobiliarios");
  const html = `<nav><span class="property-type">Casa</span></nav><h1 class="title">Lote en Venta</h1>
    <div class="area-description"><div class="blq_precio">Precio de venta <span>US$24,000</span></div><ul class="list-info-2 row">
    <li><strong>Ciudad:</strong> Mar del Plata</li><li><strong>Tipo de inmueble:</strong> Lote / Terreno</li>
    <li><strong>Tipo de negocio:</strong> Venta</li><li><strong>Área Terreno:</strong> 200 m²</li></ul></div>`;
  const url = "https://rodriguezamigo.com/lote-terreno-venta-argentina-mar-del-plata/10366911";
  const row = finalizeListing(source.name, url, extractDetailListing(html, source, url));
  assert.equal(row.propertyType, "Lote");
  assert.equal(row.city, "Mar del Plata");
  assert.equal(row.priceAmount, 24000);
  assert.equal(row.areaM2, 200);
  assert.equal(row.totalAreaM2, null);
});

test("Moccia reads the property's city and category, keeping another locality out of MDP results", () => {
  const source = config.sources.find(s => s.name === "Moccia Inmobiliaria");
  const html = `<h1 class="entry-title">Departamento dos ambientes</h1><span class="entry-category"><a>Departamento</a></span>
    <ul class="trail-items"><li><a href="/categorias/ventas">Ventas</a></li></ul>
    <table><tr id="cp_city"><td class="listing-custom-field-value">Mar del Plata</td></tr>
    <tr id="cp_ambientes"><td class="listing-custom-field-value">2</td></tr></table>`;
  const url = "https://mocciainmobiliaria.com.ar/propiedades/departamento-dos-ambientes";
  const row = finalizeListing(source.name, url, extractDetailListing(html, source, url));
  assert.equal(row.rooms, 2);
  assert.equal(row.operation, "Venta");
  assert.equal(matchesFilters(row, config.filters), true);
  assert.equal(matchesFilters({ ...row, city: "Santa Clara del Mar", title: "Cerca de Mar del Plata" }, config.filters), false);
});

test("Pixel agencies keep ambientes, surfaces and catalog operation beside reserved status", () => {
  const source = config.sources.find(s => s.name === "Villaverde Propiedades");
  const html = `<div class="sale"><div>Reservado</div></div>
    <div class="icon_default"><h5>3 ambientes externo con cochera cubierta La Perla.</h5><p>La Rioja, Mar Del Plata, Buenos Aires, Argentina.</p></div>
    <div class="property-price"><p class="sale">USD110.000</p><div class="amount">Departamento</div></div>
    <div class="btn-group"><button>Dormitorios <span class="number">2</span></button><button>Ambientes <span class="number">3</span></button>
    <button>M² Totales <span class="number">53.5</span></button><button>M² Cubiertos <span class="number">51</span></button></div>`;
  const url = "https://www.villaverdeinmo.com/ad/3-ambientes-externo-con-cochera-cubierta-la-perla";
  const row = finalizeListing(source.name, url, extractDetailListing(html, source, url, "Venta"));
  assert.equal(row.rooms, 3);
  assert.equal(row.parking, "Sí");
  assert.equal(row.totalAreaM2, 53.5);
  assert.equal(row.areaM2, 51);
  assert.equal(row.operation, "Venta");
  assert.equal(row.priceAmount, 110000);
});

test("Sauce labels read only adjacent values and never turn a dash into no parking", () => {
  const source = config.sources.find(s => s.name === "Sauce Propiedades");
  const html = `<div class="col_principal"><h1>Departamento en venta</h1><p class="categoria">Departamento</p><p class="precio">U$S 68.000</p></div>
    <p class="ClipUbicacion"><span>Mar del Plata</span></p>
    <div class="resumen"><span>Ambientes</span> 2<br><span>Dormitorios</span> 1<br><span>Cocheras</span> -<br><span>Superficie Total</span> 40 m2<br><span>Superficie Cub.</span> 35 m2<br></div>
    <div class="related-properties"><div class="resumen"><span>Cocheras</span> 3<br><span>Superficie Total</span> 500 m2<br></div></div>`;
  const url = "https://www.saucepropiedades.com/venta/departamento/926";
  const row = finalizeListing(source.name, url, extractDetailListing(html, source, url));
  assert.equal(row.rooms, 2);
  assert.equal(row.parking, "No informado");
  assert.equal(row.totalAreaM2, 40);
  assert.equal(row.areaM2, 35);
  assert.equal(row.areaKind, "cubierta");
});

test("public Tokko catalog uses the site's public search, preserves both operations and filters geography", async () => {
  const property = { id: 12, publication_title: "Departamento en Mar del Plata", type: { name: "Departamento" },
    location: { name: "Mar Del Plata", type: "Localidad", full_location: "Argentina | Costa Atlantica | Mar Del Plata" },
    room_amount: 3, parking_lot_amount: 1, total_surface: "70.5", roofed_surface: "60", web_price: true,
    operations: [{ operation_type: "Venta", prices: [{ price: 110000, currency: "USD" }] },
      { operation_type: "Alquiler", prices: [{ price: 700000, currency: "ARS" }] }] };
  const server = createServer((req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.headers.authorization, undefined);
    assert.equal(req.headers["content-type"], "application/json");
    assert.equal(new URL(req.url, "http://localhost").searchParams.get("client"), "48");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ meta: { total_count: 3 }, objects: [property, { ...property, id: 13, location: { type: "Localidad", name: "Miramar" } }, { id: 14 }] }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const website = `http://127.0.0.1:${server.address().port}`;
    const rows = await crawlSources({ sources: [{ name: "Beber", website, format: "tokkoPublicCatalog",
      catalogUrl: `${website}/search/?client=48`, catalogRequest: { method: "POST", body: {} }, propertyPath: "/tokko/{id}" }],
      filters: { city: "Mar del Plata", propertyTypes: ["Departamento"] } });
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map(r => r.operation), ["Venta", "Alquiler"]);
    assert.deepEqual(rows.map(r => r.priceAmount), [110000, 700000]);
    assert.equal(rows[0].rooms, 3);
    assert.equal(rows[0].parking, "Sí");
    assert.equal(rows[0].totalAreaM2, 70.5);
    assert.equal(rows[0].areaM2, 60);
    assert.equal(rows[0].city, "Mar Del Plata");
  } finally { await new Promise(resolve => server.close(resolve)); }
});
