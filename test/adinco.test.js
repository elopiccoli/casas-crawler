import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { adincoFields, adincoPropertyFromHtml, crawlAdinco } from "../src/adinco.js";
import { finalizeListing } from "../src/listing.js";

const property = { id: 123, code: 7, title: "Departamento 3 ambientes", type: "Departamento", operation: "Venta",
  address: { street: "Sarmiento", number: "3000", neighborhood: "Güemes" }, zp_2: { name: "Mar del Plata" },
  rooms: 3, coveredGarages: 1, coveredArea: 50, totalArea: 80, currencyId: "usd", price: 165000 };
const html = row => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { property: row } } })}</script>`;

test("Adinco preserves structured parking and city and respects hidden price/address", () => {
  const decoded = adincoPropertyFromHtml(html(property));
  const listing = finalizeListing("Saforcada", "https://www.saforcada.com/saforcada-7", adincoFields(decoded));
  assert.equal(listing.rooms, 3);
  assert.equal(listing.parking, "Sí");
  assert.equal(listing.areaM2, 50);
  assert.equal(listing.city, "Mar del Plata");
  assert.equal(listing.priceAmount, 165000);
  const hidden = adincoFields({ ...property, hiddenPrice: true, hiddenAddress: true, optionalGarage: true });
  assert.equal(hidden.priceRaw, "");
  assert.equal(hidden.address, "");
  assert.equal(hidden.evidence.priceRaw, undefined);
  assert.equal(hidden.parkingRaw, "Cochera opcional");
  assert.throws(()=>adincoPropertyFromHtml("<h1>Loading</h1>"));
});

test("Adinco queries only its public catalog and checks property identity and location", async () => {
  const requests = [];
  const server = createServer(async(req,res)=>{
    requests.push(req.url);
    if(req.url === "/api/properties") {
      let body="";for await (const chunk of req) body+=chunk;
      const input=JSON.parse(body);
      assert.equal(input.realEstateId,16830);
      assert.equal(input.options.size,50);
      res.setHeader("content-type","application/json");
      res.end(JSON.stringify({data:[property],meta:{last_page:1}}));
    }else res.end(html(property));
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try {
    const source={name:"Saforcada",website:`http://127.0.0.1:${server.address().port}`,realEstateId:16830,propertySlug:"saforcada"};
    const results=await crawlAdinco(source,{delayMs:1},{city:"Mar del Plata",propertyTypes:["Departamento"]});
    assert.equal(results.length,1);
    assert.deepEqual(requests,["/api/properties","/saforcada-7"]);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
