import { normalizeText, parseArea, parsePrice, parseRooms } from "./utils.js";
import { parkingFor } from "./parking.js";
import { neighborhoodFor, operationFor, propertyTypeFor, urlPath } from "../web/property-fields.js";

export function finalizeListing(sourceName, url, fields) {
  const price = fields.priceAmbiguous || fields.priceWithheld ? { amount: null, currency: "" } : parsePrice(fields.priceRaw);
  let address = normalizeText(fields.address);
  if (address.length > 180 || /@|https?:|\b(venta|vende|ambientes|dormitorios|precio|descripcion|contacto|whatsapp)\b/i.test(address)) address = "";
  const title = normalizeText(fields.title).length <= 200 ? normalizeText(fields.title) : "";
  const listing = {
    sourceName, url, address, title,
    summary: normalizeText(fields.summary),
    rooms: parseRooms(fields.roomsRaw) ?? parseRooms(title, true),
    parking: parkingFor(fields),
    areaM2: parseArea(fields.areaRaw),
    totalAreaM2: parseArea(fields.totalAreaRaw) ?? (/\btotal(?:es)?\b/i.test(fields.areaRaw) ? parseArea(fields.areaRaw) : null),
    areaKind: /\btotal(?:es)?\b/i.test(fields.areaRaw) ? "total" : /\b(cubiert[oa]s?|construid[oa]s?)\b/i.test(fields.areaRaw) ? "cubierta" : /\bsemicubierta\b/i.test(fields.areaRaw) ? "semicubierta" : /\bdescubierta\b/i.test(fields.areaRaw) ? "descubierta" : /terreno/i.test(fields.areaRaw) ? "terreno" : "",
    priceAmount: price.amount > 0 ? price.amount : null,
    currency: price.currency,
    propertyType: propertyTypeFor(fields.propertyType) || propertyTypeFor(urlPath(url)) || propertyTypeFor(title),
    operation: operationFor({ ...fields, title, url }),
    neighborhood: neighborhoodFor({ ...fields, address, title, url }),
    city: normalizeText(fields.city),
    evidence: { ...fields.evidence },
    scrapedAt: new Date()
  };
  // Search/filter text must never include a site menu, footer, related cards,
  // contact details, or the descriptive prose's nearby neighborhood references.
  listing.searchText = normalizeText([address, title, listing.neighborhood, listing.city, urlPath(url)].join(" "));
  if (listing.propertyType && !propertyTypeFor(fields.propertyType)) {
    listing.evidence.propertyType = { selector: "property URL/title", value: listing.propertyType };
  }
  for (const field of ["operation", "neighborhood", "propertyType"]) {
    if (listing[field] && !listing.evidence[field]) listing.evidence[field] = { selector: "property URL/title/address", value: listing[field] };
  }
  listing.issues = [];
  if (listing.rooms && !listing.evidence.roomsRaw) listing.evidence.roomsRaw = { selector: "property title: explicit ambientes", value: title };
  if (listing.parking !== "No informado" && !listing.evidence.parkingRaw) {
    const fromTitle = parkingFor({ title }) !== "No informado";
    listing.evidence.parkingRaw = { selector: fromTitle ? "property title: explicit parking" : "property description: explicit parking", value: fromTitle ? title : listing.summary };
  }
  const names = { address: "direccion", operation: "operacion", neighborhood: "barrio", priceAmount: "precio", currency: "moneda", areaM2: "metros", rooms: "ambientes", propertyType: "tipo" };
  for (const [field, name] of Object.entries(names)) if (!listing[field]) listing.issues.push(`${name}: missing or uncertain`);
  if (fields.priceAmbiguous) listing.issues.push("precio: multiple prices require an operation-specific selector");
  if (fields.priceWithheld) listing.issues.push("precio: source marks web_price=false");
  if (fields.error) listing.issues.push(`page: ${fields.error}`);
  return listing;
}
