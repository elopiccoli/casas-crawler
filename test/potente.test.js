import test from 'node:test';
import assert from 'node:assert/strict';
import {potenteFields,publicPotenteConnection} from '../src/potente.js';
import {finalizeListing} from '../src/listing.js';

test('Potente keeps the property location, rooms, covered area and explicit parking',()=>{
  const item={titulo:'Departamento',categoria:'departamento',operacion:'alquiler',zona:'Punta Mogotes',provincia:'Mar del Plata',ambientes:3,dormitorios:2,cocheras:0,m2cubiertos:68,precioARS:600000};
  const row=finalizeListing('Potente','https://potentepropiedades.com/propiedad/1',potenteFields(item));
  assert.equal(row.rooms,3);assert.equal(row.parking,'No');assert.equal(row.areaM2,68);assert.equal(row.areaKind,'cubierta');assert.equal(row.priceAmount,600000);assert.equal(row.city,'Punta Mogotes, Mar del Plata');
  item.precioUSD=1000;
  assert.equal(finalizeListing('Potente',row.url,potenteFields(item)).priceAmount,null);
});

test('Potente accepts only an anonymous frontend connection, never an elevated key',()=>{
  const jwt=role=>`eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
  assert.throws(()=>publicPotenteConnection(`https://sample.supabase.co "${jwt('service_role')}"`));
  assert.equal(publicPotenteConnection(`https://sample.supabase.co "${jwt('anon')}"`).key,jwt('anon'));
});
