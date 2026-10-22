import * as cheerio from "cheerio";
import { finalizeListing } from "./listing.js";
import { matchesFilters, sleep } from "./utils.js";

export function adincoFields(property) {
  const counts = [property.garages, property.coveredGarages, property.semiCoveredGarages].filter(value=>value != null);
  const currency = { usd: "USD", ars: "$" }[String(property.currencyId || "").toLowerCase()] || "";
  const fields = {
    title: property.title, propertyType: property.type, operation: property.operation,
    address: property.hiddenAddress ? "" : [property.address?.street, property.address?.number].filter(Boolean).join(" "),
    city: property.zp_2?.name || "", neighborhood: property.zp_3?.name || property.address?.neighborhood || "",
    roomsRaw: property.rooms > 0 ? String(property.rooms) : "",
    parkingRaw: property.optionalGarage ? "Cochera opcional" : counts.some(value=>Number(value)>0) ? "Con cochera" : counts.length ? "Sin cochera" : "",
    areaRaw: property.coveredArea > 0 ? `${property.coveredArea} m2 cubierta` : property.totalArea > 0 ? `${property.totalArea} m2 total` : "",
    priceRaw: !property.hiddenPrice && currency && property.price > 0 ? `${currency} ${property.price}` : "",
    priceWithheld: !!property.hiddenPrice,
    summary: cheerio.load(property.description || "").text().replace(/\s+/g, " ").trim(), evidence: {}
  };
  const columns = { title: "title", propertyType: "type", operation: "operation", address: "address",
    city: "zp_2.name", neighborhood: "zp_3.name / address.neighborhood", roomsRaw: "rooms",
    parkingRaw: "optionalGarage / garages / coveredGarages / semiCoveredGarages", areaRaw: "coveredArea / totalArea", priceRaw: "currencyId + price" };
  for (const [field, column] of Object.entries(columns)) if (fields[field]) fields.evidence[field] = { selector: `public property data: ${column}`, value: fields[field] };
  return fields;
}

export function adincoPropertyFromHtml(html) {
  const $ = cheerio.load(html);
  const payload = JSON.parse($("#__NEXT_DATA__").text() || "{}");
  const property = payload.props?.pageProps?.property;
  if (!property?.id) throw new Error("La ficha no publicó datos estructurados del inmueble");
  return property;
}

export async function crawlAdinco(source, requestConfig, globalFilters, logger) {
  const listings = [], seen = new Set();
  const filters = { ...globalFilters, ...(source.filters || {}) };
  for (let page = 1; page <= (source.pagination?.maxPages || 10); page++) {
    const response = await fetch(new URL("/api/properties", source.website), {
      method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(requestConfig.timeoutMs || 20000),
      body: JSON.stringify({ realEstateId: source.realEstateId, options: { size: 50, page, conditions: {}, order: { order: "created-desc" } } })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} al descargar el catálogo de ${source.name}`);
    const payload = await response.json();
    if (!Array.isArray(payload.data)) throw new Error("El catálogo no devolvió una lista de propiedades válida");
    let discovered = 0;
    for (const item of payload.data) {
      const key = `${item.id}|${item.operation}`;
      if (seen.has(key) || !item.code) continue;
      seen.add(key); discovered++;
      if (!matchesFilters({ propertyType: item.type }, { propertyTypes: filters.propertyTypes })) continue;
      const url = new URL(`/${source.propertySlug}-${item.code}`, source.website).href;
      try {
        const detail = await fetch(url, { signal: AbortSignal.timeout(requestConfig.timeoutMs || 20000) });
        if (!detail.ok) throw new Error(`HTTP ${detail.status} al descargar ${url}`);
        const property = adincoPropertyFromHtml(await detail.text());
        if (String(property.id) !== String(item.id)) throw new Error("La ficha no corresponde al inmueble solicitado");
        const listing = finalizeListing(source.name, url, adincoFields(property));
        if (matchesFilters(listing, filters)) listings.push(listing);
      } catch (error) { logger?.(`  ${source.name}: ficha ${url}: ${error.message}`); }
      await sleep(requestConfig.delayMs || 1000);
    }
    logger?.(`  ${source.name}: página ${page}, ${listings.length} publicaciones válidas`);
    if (!discovered || page >= Number(payload.meta?.last_page || 1)) break;
  }
  return listings;
}
