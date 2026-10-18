import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { extractDetailListing } from "../src/crawler.js";
import { finalizeListing } from "../src/listing.js";
import { catalogFields } from "../src/property-extraction.js";

const listing = (html, source = {}) => finalizeListing("Example", "https://agency.com/p/123", extractDetailListing(html, source));

test("rooms use dedicated property fields and never bedroom counts or related cards", async () => {
  const html = await readFile(new URL("./fixtures/houzez.html", import.meta.url), "utf8");
  assert.equal(listing(html).rooms, 7);
  assert.equal(listing('<h1>Casa de 3 dormitorios</h1><nav>4 ambientes</nav><div class="related-properties"><span class="ambientes">5</span></div>').rooms, null);
  assert.equal(listing('<h1>Casa de 4 ambientes</h1><span class="ambientes">5</span>').rooms, 5);
});

test("rooms support paired Tokko fields, configured selectors, and explicit titles", () => {
  assert.equal(listing('<ul><li><p>Ambientes:</p></li></ul><ul><li><p>3</p></li></ul>').rooms, 3);
  assert.equal(listing('<div class="custom-rooms">6</div>', { detailFields: { rooms: ".custom-rooms" } }).rooms, 6);
  assert.equal(listing('<h1>Departamento 2 amb.</h1>').rooms, 2);
  assert.equal(listing('<h1>Casa 120 m2</h1>').rooms, null);
  assert.equal(listing('<span class="ambientes">0</span>').rooms, null);
});

test("catalog and JSON-LD rooms preserve the published room count", () => {
  assert.equal(finalizeListing("Example", "https://agency.com/p/1", catalogFields({ room_amount: 4, suite_amount: 3 })).rooms, 4);
  assert.equal(finalizeListing("Example", "https://agency.com/p/1", catalogFields({ suite_amount: 3 })).rooms, null);
  assert.equal(listing('<script type="application/ld+json">{"@type":"House","numberOfRooms":{"value":5},"numberOfBedrooms":3}</script>').rooms, 5);
});
