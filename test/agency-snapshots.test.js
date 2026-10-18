import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { extractDetailListing } from "../src/crawler.js";
import { finalizeListing } from "../src/listing.js";

// Expected values were checked against public property fields, not prose or
// inferred from descriptions. Fixtures preserve representative agency markup.
for (const example of [
  { file: "tokko-modern", url: "https://agency.com/p/10476090-Casa-en-Venta-en-Los-Troncos", price: 483000, area: 230, neighborhood: "Los Troncos", type: "Casa", address: "" },
  { file: "tokko-classic", url: "https://agency.com/p/5490668-Departamento-en-Venta-en-Los-Troncos", price: 405900, area: 115.7, neighborhood: "Los Troncos", type: "Departamento", address: "Rodríguez Peña y Sarmiento" },
  { file: "houzez", url: "https://agency.com/propiedad/casa-en-venta", price: 250000, area: 140, neighborhood: "Loma de Stella Maris", type: "Casa", address: "Rawson 842" },
  { file: "martinez", url: "https://agency.com/casa-chalet-venta", price: 179000, area: 120, neighborhood: "", type: "Chalet", address: "Italia 197" },
  { file: "wasi-barg", url: "https://agency.com/chalet-venta-los-troncos", price: 430000, area: 290, neighborhood: "Los Troncos", type: "Chalet", address: "" }
]) {
  test(`real agency markup: ${example.file} preserves separate property fields`, () => {
    const html = readFileSync(new URL(`fixtures/${example.file}.html`, import.meta.url), "utf8");
    const listing = finalizeListing("Snapshot", example.url, extractDetailListing(html, {}, example.url));
    assert.equal(listing.priceAmount, example.price);
    assert.equal(listing.currency, "USD");
    assert.equal(listing.areaM2, example.area);
    assert.equal(listing.neighborhood, example.neighborhood);
    assert.equal(listing.propertyType, example.type);
    assert.equal(listing.address, example.address);
    assert.equal(listing.operation, "Venta");
  });
}
