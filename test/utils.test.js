import assert from "node:assert/strict";
import test from "node:test";
import { parseArea, parsePrice } from "../src/utils.js";

test("parseArea extracts square meters from common Spanish labels", () => {
  assert.equal(parseArea("45 m² cubiertos"), 45);
  assert.equal(parseArea("120,5 metros totales"), 120.5);
  assert.equal(parseArea("sin dato"), null);
});

test("parsePrice extracts amount and currency", () => {
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
