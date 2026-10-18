import test from "node:test";
import assert from "node:assert/strict";
import { neighborhoodOptions, matchesNeighborhoods, matchesParking, matchesPropertyType } from "../web/listing-filters.js";
import { propertyTypeFor } from "../web/property-fields.js";
import { matchesFilters } from "../src/utils.js";
import { finalizeListing } from "../src/listing.js";

test("neighborhood choices combine with OR and deduplicate case and accent variants", () => {
  const listings = [{ barrio: "Centro" }, { barrio: "CENTRO" }, { barrio: "Güemes" }, { barrio: "Guemes" }, { barrio: "La Perla" }, { barrio: "" }];
  assert.deepEqual(neighborhoodOptions(listings), ["Centro", "Güemes", "La Perla"]);
  assert.equal(listings.filter(item => matchesNeighborhoods(item, ["Centro", "La Perla"])).length, 3);
  assert.equal(listings.filter(item => matchesNeighborhoods(item, ["unknown"])).length, 1);
  assert.equal(listings.filter(item => matchesNeighborhoods(item, [])).length, 6);
});

test("included parking never matches optional or missing parking", () => {
  const listings = [{ cochera: "Sí" }, { cochera: "Opcional" }, { cochera: "No" }, {}];
  assert.deepEqual(listings.filter(item => matchesParking(item, "Sí")), [listings[0]]);
  assert.deepEqual(listings.filter(item => matchesParking(item, "Opcional")), [listings[1]]);
  assert.deepEqual(listings.filter(item => matchesParking(item, "No informado")), [listings[3]]);
});

test("land types are extracted and filtered without including houses on lots", () => {
  assert.equal(propertyTypeFor("Terreno"), "Terreno");
  assert.equal(propertyTypeFor("Tipo de PropiedadTerreno"), "Terreno");
  assert.equal(propertyTypeFor("Lotes"), "Lote");
  assert.equal(propertyTypeFor("Terreno / Lote"), "Lote");
  assert.equal(matchesPropertyType({ tipo: "Lote" }, "Lote"), true);
  assert.equal(matchesPropertyType({ tipo: "Terreno" }, "Lote"), false);
  assert.equal(matchesPropertyType({ tipo: "Casa", titulo: "Casa sobre lote" }, "Lote"), false);
  assert.equal(matchesFilters({ propertyType: "Lote" }, { propertyTypes: ["Casa", "Terreno", "Lote"] }), true);
  assert.equal(matchesFilters({ propertyType: "Terreno" }, { propertyTypes: ["Terreno"] }), true);
  const listing = finalizeListing("Dante", "https://example.com/terreno-venta_123.html", {
    propertyType: "Residencial", title: "Terreno en Venta", evidence: { propertyType: { value: "Residencial" } }
  });
  assert.equal(listing.propertyType, "Terreno");
  assert.equal(listing.evidence.propertyType.selector, "property URL/title");
});
