import assert from "node:assert/strict";
import test from "node:test";
import { listingHeading, listingType } from "../web/listing-format.js";

test("old malformed exports display a useful short title and type", () => {
  assert.equal(listingHeading({ direccion: "Page text ".repeat(100), titulo: "Casa con parque&nbsp; en Camet Norte" }), "Casa con parque en Camet Norte");
  assert.equal(listingHeading({ direccion: "Rawson 842", titulo: "Casa en venta" }), "Rawson 842");
  assert.equal(listingHeading({ direccion: "Page text ".repeat(100), titulo: "Page text ".repeat(100) }), "Propiedad sin dirección");
  assert.equal(listingType({ tipo: "Tipo de inmueble: Casa" }), "Casa");
  assert.equal(listingType({ tipo: "Page text ".repeat(100) }), "Tipo s/d");
});
