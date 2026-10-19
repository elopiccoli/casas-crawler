import assert from "node:assert/strict";
import test from "node:test";
import { parseArea, parsePrice, matchesFilters, parseRooms } from "../src/utils.js";

test("workflow operation filters preserve combined sale/rental listings", () => {
  assert.equal(matchesFilters({ operation: "Alquiler" }, { operation: "Alquiler" }), true);
  assert.equal(matchesFilters({ operation: "Venta" }, { operation: "Alquiler" }), false);
  assert.equal(matchesFilters({ operation: "Venta / Alquiler" }, { operation: "Alquiler" }), true);
  assert.equal(matchesFilters({ operation: "Venta" }, { operation: "Todos" }), true);
  assert.equal(parseRooms("Departamento monoambiente"), 1);
});

test("parseArea extracts square meters from common Spanish labels", () => {
  assert.equal(parseArea("45 m² cubiertos"), 45);
  assert.equal(parseArea("120,5 metros totales"), 120.5);
  assert.equal(parseArea("Cubierta: 115.7 m²"), 115.7);
  assert.equal(parseArea("Total: 1.200,50 m²"), 1200.5);
  assert.equal(parseArea("M² Cubiertos 80"), 80);
  assert.equal(parseArea("M² Totales: 85"), 85);
  assert.equal(parseArea("sin dato"), null);
});

test("parsePrice extracts amount and currency", () => {
  assert.equal(parsePrice("US$129,000").amount, 129000);
  assert.equal(parsePrice("USD 1,250,000").amount, 1250000);
  assert.equal(parsePrice("USD 129.000,50").amount, 129000.5);
  assert.equal(parsePrice("Casa de 5 ambientes por U$D250.000").amount, 250000);
  assert.equal(parsePrice("U$D250.000").currency, "USD");
  assert.equal(parsePrice("Casa de 5 ambientes en Rawson 842").amount, null);
  assert.equal(parsePrice("USD 250000.50").amount, 250000.5);
  assert.deepEqual(parsePrice("U$S 120.000"), {
    raw: "U$S 120.000",
    currency: "USD",
    amount: 120000
  });

  assert.deepEqual(parsePrice("$ 85.500.000"), {
    raw: "$ 85.500.000",
    currency: "$",
    amount: 85500000
  });
});
