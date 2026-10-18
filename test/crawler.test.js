import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { extractDetailListing } from "../src/crawler.js";
import { matchesFilters } from "../src/utils.js";

const sources = yaml.load(readFileSync(new URL("../config.yml", import.meta.url), "utf8")).sources;

test("Coste extracts only the main address and property, excluding related cards", () => {
  const source = sources.find((s) => s.name === "Coste Propiedades");
  const result = extractDetailListing(`
    <meta name="description" content="A long description of the house">
    <div class="property-title-price-wrap"><h1>Casa en Stella Maris</h1><span class="item-price">USD 250.000</span></div>
    <address class="item-address">Rawson 842, Mar del Plata</address>
    <address class="item-address">Rawson 842, Mar del Plata</address>
    <div class="fw-property-amenities-data">Sup. cubierta 140.00 m²</div>
    <div id="property-description-wrap"><div class="block-content-wrap">Casa con jardín.</div></div>
    <aside><address class="item-address">Otra propiedad 123</address><span class="item-price">USD 120.000</span></aside>
  `, source);
  assert.equal(result.address, "Rawson 842, Mar del Plata");
  assert.equal(result.title, "Casa en Stella Maris");
  assert.equal(result.summary, "Casa con jardín.");
  assert.equal(result.areaRaw, "Sup. cubierta 140.00 m²");
  assert.equal(result.priceRaw, "USD 250.000");
});

test("Latorre extracts property fields without menus, footer or metadata duplication", () => {
  const source = sources.find((s) => s.name.startsWith("Latorre"));
  const result = extractDetailListing(`
    <meta name="description" content="CASA DE 5 AMBIENTES CON HERMOSO PARQUE&amp;nbsp;">
    <nav>Venta Alquiler Los Troncos Güemes</nav>
    <div class="areaDetalle">
      <h1>LATORRE PROP. VENDE CASA CON PARQUE - CAMET NORTE</h1>
      <p class="ubicacion">Camet Norte, Buenos Aires</p>
      <div class="precio"><span class="pr">US$129,000</span></div>
      <div class="list-info-1a"><li>Área Construida: 150 m²</li><li>Área Terreno: 405 m²</li><li>Tipo de inmueble: Casa</li></div>
      <article>CASA DE 5 AMBIENTES&amp;nbsp; CON PARQUE</article>
    </div>
    <footer>Contacto Latorre Whatsapp</footer><script>secretMenu = "Los Troncos"</script>
  `, source);
  assert.equal(result.address, undefined);
  assert.equal(result.priceRaw, "US$129,000");
  assert.equal(result.areaRaw, "Área Construida: 150 m²");
  assert.equal(result.summary, "CASA DE 5 AMBIENTES CON PARQUE");
  assert.doesNotMatch(result.rawText, /Whatsapp|Güemes|secretMenu/);
  assert.equal(matchesFilters({ title: result.title, searchText: result.rawText }, { neighborhoods: ["Los Troncos"] }), false);
});

test("generic selectors never use a heading or description as an address", () => {
  const result = extractDetailListing(`<meta name="description" content="${"Description ".repeat(100)}"><h1>Casa en venta</h1><body>Page contents<script>code()</script></body>`, {
    detailFields: { address: "meta[name='description']::attr(content), h1, body", title: "h1, title" }
  });
  assert.equal(result.address, undefined);
  assert.equal(result.title, "Casa en venta");
  assert.doesNotMatch(result.rawText, /code\(\)/);
});

test("price selectors skip descriptions with room counts or street numbers", () => {
  const result = extractDetailListing(`
    <meta name="description" content="Casa de 5 ambientes en Mendoza al 3600">
    <span class="price">USD 250.000</span>
  `, { detailFields: { price: "meta[name='description']::attr(content), .price" } });
  assert.equal(result.priceRaw, "USD 250.000");
});

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
