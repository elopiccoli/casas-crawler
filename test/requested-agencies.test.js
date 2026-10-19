import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { extractDetailListing } from "../src/crawler.js";
import { finalizeListing } from "../src/listing.js";

const sources = yaml.load(readFileSync(new URL("../config.yml", import.meta.url), "utf8")).sources;
const extract = (name, html) => {
  const source = sources.find(s=>s.name === name);
  return finalizeListing(name, `${source.website}/example`, extractDetailListing(html, source, `${source.website}/example`));
};

test("Nizzi reads the property header and structured attributes, excluding unrelated cards", () => {
  const item = extract("Nizzi Propiedades", `<div class="mb-6 mt-6"><p>Departamento · 2 Ambientes</p><h1>Alquiler ARS 700.000</h1><p class="text-sm">Mendoza 2259, Varese, Mar del Plata</p></div>
    <h2 class="text-2xl">2 ambientes reciclado en Varese</h2>
    <div class="flex flex-col"><span>Ambientes</span><span class="font-semibold">2 Ambientes</span></div>
    <div class="flex flex-col"><span>Superficie Cubierta</span><span class="font-semibold">29 m²</span></div>
    <div class="p-6">Otra casa de 9 ambientes con cochera, USD 900.000</div>`);
  assert.equal(item.propertyType, "Departamento");
  assert.equal(item.operation, "Alquiler");
  assert.equal(item.rooms, 2);
  assert.equal(item.areaM2, 29);
  assert.equal(item.priceAmount, 700000);
  assert.equal(item.parking, "No informado");
});

test("Girard uses its primary tags, room count and area rather than similar properties", () => {
  const item = extract("Girard Propiedades", `<h1 class="tgpd-title">Catamarca al 1100</h1>
    <div class="tgpd-tags"><span class="tgpd-tag-venta">Venta</span><span class="tgpd-tag-outline">Departamento</span></div>
    <p class="tgpd-loc">La Perla</p><h2 class="tgpd-price">USD 159.000</h2>
    <div class="tgpd-extra-row"><p>3 ambientes / 2 dormitorios</p></div>
    <div class="tgpd-extra-row"><p>70 m² cubiertos / 73 m² totales</p></div>
    <div class="tgpd-sim-price">USD 900.000</div>`);
  assert.equal(item.address, "Catamarca al 1100");
  assert.equal(item.rooms, 3);
  assert.equal(item.areaM2, 70);
  assert.equal(item.priceAmount, 159000);
  assert.equal(item.neighborhood, "La Perla");
  assert.equal(item.city, "");
});

test("Rey preserves explicit parking and rooms for the main listing", () => {
  const item = extract("Rey Propiedades", `<h1 class="detail__title">Piso en venta</h1>
    <p class="detail__address">Santa Fe 2534, Mar del Plata</p><div class="detail__price">USD 199.000</div>
    <div class="detail__badges"><span class="tag--op">Venta</span><span class="tag--type">Departamento</span></div>
    <div class="detail__main"><ul class="feats"><li><strong>4</strong><span>Ambientes</span></li><li><strong>1</strong><span>Cochera</span></li></ul></div>
    <div class="card"><ul class="feats"><li><strong>8</strong><span>Cochera</span></li></ul></div>`);
  assert.equal(item.rooms, 4);
  assert.equal(item.parking, "Sí");
  assert.equal(item.priceAmount, 199000);
  assert.equal(item.operation, "Venta");
});
