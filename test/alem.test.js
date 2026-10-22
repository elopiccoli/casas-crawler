import test from "node:test";
import assert from "node:assert/strict";
import {extractDetailListing} from "../src/crawler.js";
import {finalizeListing} from "../src/listing.js";

test("Wasi agencies may reject bedroom counts incorrectly labeled as JSON-LD rooms",()=>{
  const source={skipJsonLdRooms:true,detailFields:{rooms:"h1.title",title:"h1.title"}};
  const render=title=>`<h1 class="title">${title}</h1><script type="application/ld+json">{"@type":"Apartment","numberOfRooms":1}</script>`;
  const withRooms=finalizeListing("Alem","https://alempropiedades.com/example",extractDetailListing(render("Departamento 2 ambientes"),source));
  assert.equal(withRooms.rooms,2);
  const withoutRooms=finalizeListing("Alem","https://alempropiedades.com/example",extractDetailListing(render("Departamento en alquiler"),source));
  assert.equal(withoutRooms.rooms,null);
});
