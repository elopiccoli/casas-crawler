import test from "node:test";
import assert from "node:assert/strict";
import { extractDetailListing } from "../src/crawler.js";

test("source-specific selectors can override a generic page heading and price", () => {
  const html = `<title>Departamento en alquiler, Mar del Plata</title><h1>Detalle</h1>
    <h2 class="property-name">Departamento en alquiler</h2><span class="actual-price">$ 700.000</span>
    <div class="operations-box"><div class="operation-val">USD 999.000</div></div>`;
  const result = extractDetailListing(html, { preferConfiguredFields: true, detailFields: {
    title: ".property-name", price: ".actual-price", city: "title"
  } });
  assert.equal(result.title, "Departamento en alquiler");
  assert.equal(result.priceRaw, "$ 700.000");
  assert.equal(result.city, "Departamento en alquiler, Mar del Plata");
  // Existing source configurations retain their structured default selectors.
  assert.equal(extractDetailListing(html, { detailFields: { title: ".property-name" } }).title, "Detalle");
});
