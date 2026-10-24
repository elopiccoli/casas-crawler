import * as cheerio from "cheerio";
import { normalizeField } from "../web/property-fields.js";

const slug = value => normalizeField(value).replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

export function mardelCatalogFields(item) {
  const type = normalizeField(item.tipo_inmueble);
  const prefix = /departamento/.test(type) ? "dpto" : /casa|chalet/.test(type) ? "casa"
    : /terreno|lote/.test(type) ? "terreno" : /ph|duplex/.test(type) ? "pd"
    : /quinta/.test(type) ? "quinta" : /oficina/.test(type) ? "oficina" : /local/.test(type) ? "local" : "";
  const pick = suffix => prefix ? item[`${prefix}_${suffix}`] : null;
  const rooms = pick("ambientes");
  const parking = pick("cocheras");
  const covered = pick("sup_cubierta") || pick("sup_oficina");
  const land = pick("sup_terreno");
  const currency = Number(item.moneda) === 1 ? "$" : Number(item.moneda) === 2 ? "USD" : "";
  const fields = {
    title: item.titulo, address: [item.calle, item.numero].filter(Boolean).join(" "),
    city: item.ciudad, neighborhood: item.barrio_nombre,
    operation: item.tipo_operacion, propertyType: item.tipo_inmueble,
    roomsRaw: rooms > 0 ? String(rooms) : "",
    parkingRaw: parking != null ? (Number(parking) > 0 ? "Con cochera" : "Sin cochera") : "",
    totalAreaRaw: pick("sup_total") > 0 ? `${pick("sup_total")} m2 total` : "",
    areaRaw: covered > 0 ? `${covered} m2 cubierta` : land > 0 ? `${land} m2 terreno` : "",
    priceRaw: Number(item.no_publicar_precio) !== 1 && currency && Number(item.precio) > 0 ? `${currency} ${item.precio}` : "",
    priceWithheld: Number(item.no_publicar_precio) === 1,
    summary: cheerio.load(item.descripcion || "").text().replace(/\s+/g, " ").trim(), evidence: {}
  };
  const columns = { title: "titulo", address: "calle + numero", city: "ciudad", neighborhood: "barrio_nombre",
    operation: "tipo_operacion", propertyType: "tipo_inmueble", roomsRaw: `${prefix}_ambientes`,
    parkingRaw: `${prefix}_cocheras`, totalAreaRaw: `${prefix}_sup_total`, areaRaw: `${prefix}_sup_cubierta / sup_terreno`, priceRaw: "moneda + precio" };
  for (const [key, column] of Object.entries(columns)) if (fields[key]) {
    fields.evidence[key] = { selector: `public catalog: ${column}`, value: fields[key] };
  }
  return fields;
}

export function mardelPropertyUrl(source, item) {
  const path = source.portal ? `/inmueble/${slug(item.tipo_operacion)}/${slug(item.tipo_inmueble)}/${slug(item.titulo)}/${item.id}` : `/inmueble/${item.id}`;
  return new URL(path, source.website).href;
}
