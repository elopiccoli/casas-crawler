import assert from "node:assert/strict";
import test from "node:test";
import { matchesFilters } from "../src/utils.js";

test("matchesFilters keeps listings within the configured price range", () => {
  const filters = { price: { min: 50000, max: 250000, currency: "USD" } };

  assert.equal(matchesFilters({ priceAmount: 120000, currency: "USD" }, filters), true);
  assert.equal(matchesFilters({ priceAmount: 300000, currency: "USD" }, filters), false);
  assert.equal(matchesFilters({ priceAmount: 120000, currency: "$" }, filters), false);
});

test("matchesFilters keeps listings with missing price data", () => {
  const filters = { price: { min: 50000, max: 250000, currency: "USD" } };

  assert.equal(matchesFilters({ priceAmount: null, currency: "" }, filters), true);
});

test("matchesFilters supports property type, city and neighborhood filters", () => {
  const filters = {
    propertyTypes: ["Casa"],
    city: "Mar del Plata",
    neighborhoods: ["Güemes", "Los Troncos"]
  };

  assert.equal(matchesFilters({
    propertyType: "Casa",
    searchText: "Venta Casa en Mar del Plata zona Guemes"
  }, filters), true);

  assert.equal(matchesFilters({
    propertyType: "Departamento",
    searchText: "Venta Departamento en Mar del Plata zona Guemes"
  }, filters), false);

  assert.equal(matchesFilters({
    propertyType: "Casa",
    searchText: "Venta Casa en Miramar zona Centro"
  }, filters), false);
});

test("matchesFilters does not infer property type from unrelated body text", () => {
  const filters = {
    propertyTypes: ["Casa"],
    city: "Mar del Plata",
    neighborhoods: ["Güemes"]
  };

  assert.equal(matchesFilters({
    propertyType: "Departamento",
    title: "Departamento en venta",
    searchText: "Departamento en Mar del Plata zona Guemes menu Casa Chalet"
  }, filters), false);
});

test("matchesFilters ignores property type words in the URL domain", () => {
  const filters = {
    propertyTypes: ["Casa"],
    city: "Mar del Plata",
    neighborhoods: ["Divino Rostro"]
  };

  assert.equal(matchesFilters({
    propertyType: "Terreno",
    title: "Importante fraccion sobre avenida",
    url: "https://roblescasascampos.com/propiedades/importante-fraccion",
    searchText: "Terreno en Divino Rostro, Mar del Plata"
  }, filters), false);
});
