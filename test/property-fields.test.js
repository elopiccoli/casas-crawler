import assert from "node:assert/strict";
import test from "node:test";
import { operationFor, neighborhoodFor, propertyTypeFor } from "../web/property-fields.js";
import { extractDetailListing } from "../src/crawler.js";
import { finalizeListing } from "../src/listing.js";
import { catalogFields } from "../src/property-extraction.js";

test("operation never comes from menus or descriptive rental possibilities", () => {
  assert.equal(operationFor({ url: "https://agency.com/casa-venta/123", summary: "Ideal para alquiler", searchText: "Venta Alquiler Contacto" }), "Venta");
  assert.equal(operationFor({ summary: "Venta Alquiler", searchText: "Venta Alquiler" }), "");
  assert.equal(operationFor({ operation: "Alquiler", url: "https://agency.com/casa-venta" }), "Alquiler");
  assert.equal(operationFor({ operation: "Venta y Alquiler" }), "Venta / Alquiler");
});

test("neighborhood uses the explicit property location, not nearby places or menus", () => {
  assert.equal(neighborhoodFor({ neighborhood: "Los Troncos", title: "Cerca de Güemes", summary: "Playa Grande" }), "Los Troncos");
  assert.equal(neighborhoodFor({ title: "Casa en Los Troncos", summary: "A dos cuadras de Güemes" }), "Los Troncos");
  assert.equal(neighborhoodFor({ summary: "A dos cuadras de Guemes", searchText: "Stella Maris" }), "");
  assert.equal(neighborhoodFor({ neighborhood: "Lomas De Stella Maris" }), "Loma de Stella Maris");
  assert.equal(neighborhoodFor({ neighborhood: "Los Troncos / Stella Maris" }), "");
  assert.equal(neighborhoodFor({ neighborhood: "Villa Primera" }), "Villa Primera");
});

test("type is a canonical field rather than an entire sentence", () => {
  assert.equal(propertyTypeFor("Tipo de inmueble: Chalet"), "Chalet");
  assert.equal(propertyTypeFor("Casa - Chalet"), "Chalet");
  assert.equal(propertyTypeFor("Casa Departamento Local"), "");
});

test("a sale price is bound to the sale block when the property also has a rental price", () => {
  const html = `<h1>Casa</h1><div class="operations-box">
    <div class="operation-div"><div class="operation-type-div">ALQUILER</div><div class="operation-val">ARS 950.000</div></div>
    <div class="operation-div"><div class="operation-type-div">VENTA</div><div class="operation-val">USD 250.000</div></div>
    </div><footer>Guemes Mar del Plata</footer>`;
  const fields = extractDetailListing(html, {}, "https://agency.com/casa-en-venta");
  const listing = finalizeListing("Example", "https://agency.com/casa-en-venta", fields);
  assert.equal(listing.operation, "Venta");
  assert.equal(listing.priceAmount, 250000);
  assert.equal(listing.currency, "USD");
  assert.equal(listing.neighborhood, "");
  assert.doesNotMatch(listing.searchText, /Guemes/);
  const ambiguous = finalizeListing("Example", "https://agency.com/p/123", extractDetailListing(html, {}));
  assert.equal(ambiguous.priceAmount, null);
  assert.equal(ambiguous.operation, "Venta / Alquiler");
  assert(ambiguous.issues.some((issue) => issue.includes("multiple prices")));
});

test("related cards cannot supply the main property's operation, address or price", () => {
  const fields = extractDetailListing(`<h1>Casa en venta</h1><div class="property-wrap"><div class="page-title-wrap"><div class="label-status">En venta</div></div>
    <div class="item-listing-wrap"><address class="item-address">Otra calle 123</address><div class="item-price">USD 100</div><div class="label-status">En alquiler</div></div></div>`, {});
  assert.equal(fields.operation, "En venta");
  assert.equal(fields.address, undefined);
  assert.equal(fields.priceRaw, undefined);
});

test("catalog fields respect explicit location, decimal prices and labeled areas", () => {
  const item = { address: "Garay 502", publication_title: "Cerca de Guemes", location: { name: "Los Troncos", full_location: "Argentina | Costa Atlantica | Mar Del Plata | Los Troncos" }, roofed_surface: "796.00", surface: "1875.00", operations: [{ type: "Venta", currency: "USD", price: "250000.50" }], property_type: { name: "Casa" }, web_price: true };
  const listing = finalizeListing("Robles", "https://agency.com/property", catalogFields(item));
  assert.equal(listing.neighborhood, "Los Troncos");
  assert.equal(listing.priceAmount, 250000.5);
  assert.equal(listing.areaM2, 796);
  assert.equal(listing.areaKind, "cubierta");
  assert.equal(finalizeListing("Robles", "https://agency.com/property", catalogFields({ ...item, web_price: false })).priceAmount, null);
});

test("JSON-LD preserves currency and area units", () => {
  const html = `<script type="application/ld+json">{"@type":"House","name":"Casa","address":{"streetAddress":"Rawson 842","addressLocality":"Mar del Plata"},"offers":{"price":250000.5,"priceCurrency":"USD"},"floorSize":{"value":140,"unitCode":"MTK"}}</script>`;
  const listing = finalizeListing("Example", "https://agency.com/p/123", extractDetailListing(html, {}));
  assert.equal(listing.currency, "USD");
  assert.equal(listing.priceAmount, 250000.5);
  assert.equal(listing.areaM2, 140);
});

test("JSON-LD skips related properties and never labels square feet as square meters", () => {
  const html = `<script type="application/ld+json">[
    {"@type":"House","url":"https://agency.com/other","offers":{"price":100,"priceCurrency":"USD"}},
    {"@type":"House","url":"https://agency.com/main","offers":{"price":250000,"priceCurrency":"USD"},"floorSize":{"value":1400,"unitCode":"FTK"}}
    ]</script>`;
  const listing = finalizeListing("Example", "https://agency.com/main", extractDetailListing(html, {}, "https://agency.com/main"));
  assert.equal(listing.priceAmount, 250000);
  assert.equal(listing.areaM2, null);
});
