import assert from "node:assert/strict";
import test from "node:test";
import { crawlSources } from "../src/crawler.js";

test("POST listings preserve form fields and paginate without posting detail requests", async () => {
  const originalFetch = globalThis.fetch;
  const pages = [];
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/ventas/filtro.php") {
      assert.equal(options.method, "POST");
      assert.equal(options.body.get("tipo_prop"), "0");
      const page = options.body.get("page");
      pages.push(page);
      return new Response(`<a href="/ventas/propiedad/${page}/">Ver</a>`);
    }
    assert.equal(options.method, undefined);
    return new Response('<h1>Departamento en Venta de 2 ambientes en Mar del Plata</h1><div class="ambientes">4</div>');
  };
  try {
    const listings = await crawlSources({ request: { delayMs: 1 }, sources: [{
      name: "Example", startUrls: ["https://agency.com/ventas/filtro.php?page=1"],
      listingRequest: { method: "POST", form: { tipo_prop: 0 } },
      pagination: { maxPages: 2, pageParam: "page", firstPage: 2 },
      listingSelector: "a[href]", publicationUrlRegex: "/ventas/propiedad/", detailFields: { title: "h1" }
    }] });
    assert.deepEqual(pages, ["1", "2"]);
    assert.equal(listings.length, 2);
    assert(listings.every(item => item.rooms === 4));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
