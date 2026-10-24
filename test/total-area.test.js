import assert from "node:assert/strict";
import test from "node:test";
import { extractDetailListing } from "../src/crawler.js";
import { finalizeListing } from "../src/listing.js";
import { adincoFields } from "../src/adinco.js";
import { potenteFields } from "../src/potente.js";
import { catalogFields } from "../src/property-extraction.js";
import { publicJsonFields } from "../src/public-json.js";
import { mardelCatalogFields } from "../src/mardel-catalog.js";
import { importListings, mergeSnapshots } from "../src/incremental.js";
import { totalAreaFor, matchesMinimumTotalArea } from "../web/listing-filters.js";

const listing = fields => finalizeListing("Example", "https://example.com/p/123", fields);

test("total and covered surfaces remain separate in technical HTML fields", () => {
  for (const html of [
    `<ul id="lista_superficies"><li>Cubierta: 80 m²</li><li>Total: 100,5 m²</li></ul>`,
    `<div class="caracteristicasDeFicha"><li>Superficie Cubierta <span>80 m²</span></li><li>Superficie Total <span>100,5 m²</span></li></div>`,
    `<div><strong>Sup. total:</strong> 100,5 m²</div>`,
    `<div><div>Sup. total</div><div>100,5 m²</div></div>`,
    `<ul><li><p>Total:</p></li></ul><ul><li>100,5 m²</li></ul>`
  ]) {
    const fields = extractDetailListing(html, {}, "https://example.com/p/123");
    assert.equal(listing(fields).totalAreaM2, 100.5, html);
    assert.ok(fields.evidence.totalAreaRaw);
  }
  const fields = extractDetailListing(`<ul id="lista_superficies"><li>Cubierta: 80 m²</li><li>Total: 100,5 m²</li></ul>`, {});
  assert.equal(listing(fields).areaM2, 80);
});

test("total surface does not come from covered area, prose, related properties or JSON-LD floorSize", () => {
  const fields = extractDetailListing(`<div id="lista_superficies"><li>Cubierta: 80 m²</li></div>
    <p>Superficie total: 200 m²</p><div class="related-properties"><strong>Sup. total:</strong> 300 m²</div>
    <script type="application/ld+json">{"@type":"Apartment","floorSize":{"value":80,"unitText":"m2"}}</script>`, {});
  assert.equal(listing(fields).totalAreaM2, null);
  assert.equal(listing({ areaRaw: "0 m2 total" }).totalAreaM2, null);
});

test("public API adapters preserve total independently of covered or land area", () => {
  for (const fields of [
    adincoFields({ coveredArea: 80, totalArea: 100.5 }),
    potenteFields({ m2cubiertos: 80, m2totales: 100.5 }),
    catalogFields({ roofed_surface: 80, total_surface: 100.5 }),
    publicJsonFields({ covered: 80, total: 100.5 }, { jsonFields: { areaM2: "covered", totalAreaM2: "total" } }),
    mardelCatalogFields({ tipo_inmueble: "Departamento", dpto_sup_cubierta: 80, dpto_sup_total: 100.5 })
  ]) assert.equal(listing(fields).totalAreaM2, 100.5);
  assert.equal(listing(catalogFields({ surface: 200 })).totalAreaM2, null);
});

test("minimum total surface is inclusive and excludes unknown areas only with an active minimum", () => {
  assert.equal(matchesMinimumTotalArea({ metrosTotales: 100.5 }, 100.5), true);
  assert.equal(matchesMinimumTotalArea({ metrosTotales: 100.4 }, 100.5), false);
  for (const item of [{}, { metrosTotales: null }, { metrosTotales: 0 }, { metrosTotales: "invalid" }, { metros: 200, superficieTipo: "cubierta" }]) {
    assert.equal(matchesMinimumTotalArea(item, 1), false);
    assert.equal(matchesMinimumTotalArea(item, ""), true);
    assert.equal(matchesMinimumTotalArea(item, 0), true);
  }
  assert.equal(totalAreaFor({ metros: 100, superficieTipo: "total" }), 100);
});

test("incremental refreshes and legacy snapshot deployments retain the total column", () => {
  const base = { inmobiliaria: "Example", link: "https://example.com/p/123", metros: 80, superficieTipo: "cubierta", fechaExtraccion: "2026-10-24" };
  const saved = { listings: [{ ...base, metrosTotales: 100.5 }] };
  assert.equal(importListings(saved)[0].totalAreaM2, 100.5);
  assert.equal(mergeSnapshots(saved, { listings: [base] })[0].totalAreaM2, 100.5);
  assert.equal(mergeSnapshots(saved, { listings: [{ ...base, metrosTotales: null }] })[0].totalAreaM2, null);
});
