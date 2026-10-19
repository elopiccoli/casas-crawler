import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.js";
import { extractDetailListing } from "../src/crawler.js";
import { finalizeListing } from "../src/listing.js";

test("Del Prete preserves covered area with units before the value, rooms and rental parking", async () => {
  const config = await loadConfig(fileURLToPath(new URL("../config.yml", import.meta.url)));
  const source = config.sources.find(item=>item.name === "Del Prete Propiedades");
  const url = "https://www.delpretepropiedades.com/ad/alquiler-semipiso";
  const fields = extractDetailListing(`<div class="sale"><div>En Alquiler</div></div><div class="sale">$2.400.000</div>
    <div class="amount">Departamento</div><div class="icon_default"><h5>Semipiso con cochera</h5><p>Av. Camet 1300, Mar del Plata</p></div>
    <div class="btn-group w-100">Ambientes <span class="number">3</span></div>
    <div class="btn-group w-100">M² Totales <span class="number">85</span></div>
    <div class="btn-group w-100">M² Cubiertos <span class="number">80</span></div>
    <div class="other-property">USD 900.000 / 9 ambientes / 800 m²</div>`, source, url);
  const item = finalizeListing(source.name, url, fields);
  assert.equal(item.priceAmount, 2400000);
  assert.equal(item.operation, "Alquiler");
  assert.equal(item.propertyType, "Departamento");
  assert.equal(item.rooms, 3);
  assert.equal(item.areaM2, 80);
  assert.equal(item.areaKind, "cubierta");
  assert.equal(item.parking, "Sí");
});
