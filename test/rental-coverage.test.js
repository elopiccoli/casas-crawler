import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import yaml from "js-yaml";
import { crawlSources, extractDetailListing } from "../src/crawler.js";
import { finalizeListing } from "../src/listing.js";
import { matchesFilters } from "../src/utils.js";

test("active configuration includes apartment rentals and accepts peso prices", async () => {
  const config = yaml.load(await readFile(new URL("../config.yml", import.meta.url), "utf8"));
  assert.equal(config.filters.price.currency, null);
  assert(config.filters.propertyTypes.includes("Departamento"));
  assert(matchesFilters({ propertyType: "Departamento", title: "Departamento en alquiler en Mar del Plata", priceAmount: 406000, currency: "$" }, config.filters));
  for (const source of config.sources.filter(s => s.enabled !== false)) {
    if (source.startUrls.some(url => new URL(url).pathname === "/Venta")) {
      assert(source.startUrls.some(url => new URL(url).pathname === "/Alquiler"), source.name);
    }
  }
  assert(!config.sources.some(s => /robles|pernice/i.test(s.name)));
  assert.deepEqual(config.filters.neighborhoods, []);
});

test("a shared property URL preserves separate sale and rental prices from search context", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => new Response(String(url).includes("/p/") ? `
    <h1>Departamento en Venta en Mar del Plata</h1>
    <div class="operations-box">
      <div class="operation-div"><div class="operation-type-div">VENTA</div><div class="operation-val">USD 90000</div></div>
      <div class="operation-div"><div class="operation-type-div">ALQUILER</div><div class="operation-val">$ 600000</div></div>
    </div>` : '<a href="/p/123-Departamento-en-Venta">Departamento</a>');
  try {
    const listings = await crawlSources({ request: { delayMs: 1 }, sources: [{
      name: "Example", startUrls: ["https://agency.com/Venta", "https://agency.com/Alquiler"],
      listingSelector: "a[href]", publicationUrlRegex: "/p/", detailFields: { title: "h1" }
    }] });
    assert.equal(listings.length, 2);
    assert.equal(listings.find(item => item.operation === "Alquiler").priceAmount, 600000);
    assert.equal(listings.find(item => item.operation === "Venta").priceAmount, 90000);
  } finally { globalThis.fetch = originalFetch; }
});

test("a failed sale listing does not discard rentals already discovered", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).endsWith("/Venta")) return new Response("Error", { status: 503 });
    return new Response(String(url).includes("/p/") ? '<h1>Departamento en Alquiler en Mar del Plata</h1>' : '<a href="/p/123-Departamento-en-Alquiler">Ver</a>');
  };
  try {
    const listings = await crawlSources({ request: { delayMs: 1 }, sources: [{
      name: "Example", startUrls: ["https://agency.com/Alquiler", "https://agency.com/Venta"],
      listingSelector: "a[href]", publicationUrlRegex: "/p/", detailFields: { title: "h1" }
    }] });
    assert.equal(listings.length, 1);
    assert.equal(listings[0].operation, "Alquiler");
  } finally { globalThis.fetch = originalFetch; }
});

test("rental location comes from property metadata rather than an unrelated footer", () => {
  const html = `<meta property="og:title" content="Departamento en Alquiler en La Perla, Mar del Plata - $ 700.000 | Dante Propiedades">
    <h1>Departamento en Alquiler en La Perla</h1>
    <ul class="caracteristicasDeFicha"><li><strong>Zona:</strong><span>La Perla</span></li>
    <li><strong>Valor:</strong><span>$ 700.000</span></li></ul><footer>Otra ciudad</footer>`;
  const listing = finalizeListing("Dante", "https://agency.com/departamento-alquiler-la-perla", extractDetailListing(html, {
    detailFields: { city: "meta[property='og:title']::attr(content)" }
  }));
  assert.equal(listing.priceAmount, 700000);
  assert(matchesFilters(listing, { city: "Mar del Plata", propertyTypes: ["Departamento"] }));
  assert(!listing.city.includes("Otra ciudad"));
});

test("JSON rental listings support offsets, HTML base URLs, and exclude external share links", async () => {
  const originalFetch = globalThis.fetch;
  const offsets = [];
  const details = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/listing/api")) {
      const offset = options.body.get("desde");
      offsets.push(offset);
      return Response.json({ html: `<base href="https://agency.com/"><a href="p/${offset}">Ver</a><a href="https://social.example/share/p/${offset}">Compartir</a>` });
    }
    details.push(String(url));
    return new Response('<h1>Departamento en Alquiler en Mar del Plata</h1>');
  };
  try {
    const listings = await crawlSources({ request: { delayMs: 1 }, sources: [{
      name: "Example", startUrls: ["https://agency.com/listing/api?desde=0"],
      listingRequest: { method: "POST", responseHtmlField: "html", form: { hasta: 6 } },
      pagination: { maxPages: 2, pageParam: "desde", firstPage: 6, step: 6 },
      listingSelector: "a[href]", publicationUrlRegex: "/p/", detailFields: { title: "h1" }
    }] });
    assert.deepEqual(offsets, ["0", "6"]);
    assert.deepEqual(details, ["https://agency.com/p/0", "https://agency.com/p/6"]);
    assert.equal(listings.length, 2);
  } finally { globalThis.fetch = originalFetch; }
});
