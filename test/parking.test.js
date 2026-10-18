import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parkingFor } from "../src/parking.js";
import { extractDetailListing, crawlSources } from "../src/crawler.js";
import { catalogFields } from "../src/property-extraction.js";
import { finalizeListing } from "../src/listing.js";

test("parking distinguishes included, absent, optional, and unknown", () => {
  for (const text of ["Con cochera", "Incluye garage", "Cuenta con una cochera", "Garaje cubierto"]) assert.equal(parkingFor({ title: text }), "Sí", text);
  for (const text of ["Sin cochera", "No cuenta con garage", "No tiene garaje"]) assert.equal(parkingFor({ summary: text }), "No", text);
  for (const text of ["Cochera opcional", "Garage no incluido", "Con cochera por separado", "Posibilidad de cochera"]) assert.equal(parkingFor({ summary: text }), "Opcional", text);
  for (const text of ["Cochera en edificio cercano", "Posibilidad de construir garage", "Consultar disponibilidad de cocheras", "Departamento de 2 ambientes"]) assert.equal(parkingFor({ summary: text }), "No informado", text);
  assert.equal(parkingFor({ parkingRaw: "0", title: "Con cochera" }), "No");
  assert.equal(parkingFor({}), "No informado");
});

test("parking reads native, paired, configured, and catalog fields without confusing bedrooms", async () => {
  const fields = extractDetailListing(await readFile(new URL("./fixtures/wasi-barg.html", import.meta.url), "utf8"), {});
  assert.equal(finalizeListing("Example", "https://agency.com/p/1", fields).parking, "Sí");
  for (const [html, expected] of [
    ['<dl><div><dt>Cocheras</dt><dd>0</dd></div></dl>', "No"],
    ['<ul><li><p>Cocheras:</p></li></ul><ul><li><p>2</p></li></ul>', "Sí"],
    ['<ul class="caracteristicasDeFicha"><li><strong>Cochera</strong><span>Sí</span></li></ul>', "Sí"],
    ['<div class="ficha_detalle_item"><b>Dormitorios</b>3</div>', "No informado"]
  ]) assert.equal(finalizeListing("Example", "https://agency.com/p/1", extractDetailListing(html, {})).parking, expected);
  assert.equal(parkingFor(catalogFields({ garage_amount: 0 })), "No");
  assert.equal(parkingFor(catalogFields({ garage_amount: 2 })), "Sí");
  assert.equal(parkingFor(catalogFields({})), "No informado");
});

test("menus and related listings never supply parking for the main property", () => {
  const fields = extractDetailListing('<h1>Departamento en alquiler</h1><nav>Con cochera</nav><div class="related-properties"><div class="ficha_detalle_item"><b>Cocheras</b>2</div></div>', {});
  assert.equal(parkingFor(fields), "No informado");
});

test("rental crawling preserves a structured parking field through card and detail merging", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => new Response(String(url).includes("/p/")
    ? '<h1>Departamento en alquiler</h1><dl><div><dt>Cocheras</dt><dd>1</dd></div></dl>'
    : '<a href="/p/1">Ver</a>');
  try {
    const listings = await crawlSources({ request: { delayMs: 1 }, sources: [{ name: "Example", startUrls: ["https://agency.com/Alquiler"], listingSelector: "a[href]", detailFields: { title: "h1" } }] });
    assert.equal(listings[0].parking, "Sí");
  } finally { globalThis.fetch = originalFetch; }
});
