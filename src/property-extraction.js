import { normalizeText, parseRooms } from "./utils.js";
import { parkingStatus } from "./parking.js";
import { parseOperation, urlPath } from "../web/property-fields.js";

const money = /(?:u\$s|u\$d|usd|us\$|\$|ars)\s*\d/i;
const area = /\d[\d.,]*\s*(?:m²|m2|metros)|(?:m²|m2)\s*(?:cubiert[oa]s?|totales?|descubiert[oa]s?|terreno)\s*:?\s*\d/i;

// Only dedicated property elements may supply structured fields. Metadata
// descriptions and body text are prose, even when they contain valid numbers.
const selectors = {
  totalAreaRaw: ["#lista_superficies li:contains('Total:')", ".ficha_detalle_item:has(b:contains('Total'))", ".caracteristicasDeFicha li:contains('Superficie Total')", ".fw-property-amenities-data:contains('Sup. total')", ".list-info-1a li:contains('Área Total')", "#Description .list-info-2 li:contains('Área Total')", "#property-detail-wrap li:contains('Totales')", "#property-detail-wrap li:contains('total')", "dl div:has(dt:contains('total'))", ".adic-chip:contains('Total')", ".mini-chip:contains('Total')"],
  parkingRaw: [".ficha_detalle_item", ".caracteristicasDeFicha li", ".fw-property-amenities-data", ".areaDetalle .list-info-1a li", "#Description .list-info-2 li", "#property-detail-wrap li", "dl div:has(dt)", ".adic-chip", ".mini-chip", ".item-garage", "[data-field='garage']"],
  roomsRaw: [".ficha_detalle_item:has(b:contains('Ambientes'))", ".caracteristicasDeFicha li:contains('Ambientes')", ".fw-property-amenities-data:contains('Ambientes')", ".list-info-1a li:contains('Ambientes')", "#Description .list-info-2 li:contains('Ambientes')", "#property-detail-wrap li:contains('Ambientes')", ".rooms", ".ambientes"],
  address: [".title-address", ".caracteristicasDeFicha li:contains('Dirección') span", "#property-address-wrap .detail-address span", "address.item-address"],
  title: [".single_property_title h2", ".areaDetalle h1", "#Description h1", "h1", "meta[property='og:title']::attr(content)"],
  priceRaw: [".prop-detail-prices .price-number", ".operations-box .operation-val", ".areaDetalle .precio .pr", "#Description .blq_precio span", ".caracteristicasDeFicha li:contains('Valor') span", ".property-title-price-wrap .item-price", ".property-wrap .item-price"],
  areaRaw: ["#lista_superficies li:contains('Cubierta:')", ".caracteristicasDeFicha li:contains('Superficie Cubierta') span", ".fw-property-amenities-data:contains('Sup. cubierta')", ".list-info-1a li:contains('Área Construida')", "#Description .list-info-2 li:contains('Área Construida')"],
  neighborhood: [".ficha_detalle_item:has(b:contains('Ubicación'))", "#property-address-wrap .detail-area", ".areaDetalle .list-info-1a li:contains('Zona:')", "#Description .list-info-2 li:contains('Zona:')"],
  operation: [".prop-detail-op-tag", ".operations-box .operation-type-div", ".caracteristicasDeFicha li:contains('Tipo de Operación') span", ".list-info-1a li:contains('Tipo de negocio')", "#Description .list-info-2 li:contains('Tipo de negocio')", ".property-wrap .label-status"],
  propertyType: [".prop-ref-code", ".caracteristicasDeFicha li:contains('Tipo:') span", ".list-info-1a li:contains('Tipo de inmueble')", "#Description .list-info-2 li:contains('Tipo de inmueble')", ".property-type"],
  city: ["#property-address-wrap .detail-city", ".list-info-1a li:contains('Ciudad:')", "#Description .list-info-2 li:contains('Ciudad:')", ".areaDetalle .ubicacion", ".slider-thumb::attr(alt)"],
  summary: [".full-description", "#property-description-wrap .block-content-wrap", ".areaDetalle article", ".descripcionDeFicha", "#ficha_descripcion"]
};

export function extractPropertyFields($, source, url = "", requestedOperation = "") {
  try {
    const item = JSON.parse($("#app[data-page]").attr("data-page") || "{}").props?.property;
    if (item?.slug && item.address) return catalogFields(item);
  } catch { /* HTML parsers continue when an embedded payload is malformed. */ }
  const result = { evidence: {} };
  const configured = source.detailFields || {};
  const names = { priceRaw: "price", areaRaw: "area", totalAreaRaw: "totalArea", roomsRaw: "rooms", parkingRaw: "parking" };
  for (const [field, defaults] of Object.entries(selectors)) {
    const configuredParts = splitSelectors(configured[names[field] || field] || "");
    const candidates = source.preferConfiguredFields ? [...configuredParts, ...defaults] : [...defaults, ...configuredParts];
    for (const selector of candidates) {
      if (/^(body|html)$/.test(selector) || selector === "title" && !(source.preferConfiguredFields && configuredParts.includes(selector)) || /meta.*description/i.test(selector) && field !== "summary") continue;
      if (field === "address" && /h[1-6]|meta|\.ubicacion/i.test(selector)) continue;
      const attr = selector.match(/^(.*?)::attr\(([^)]+)\)$/);
      const elements = $(attr ? attr[1] : selector).toArray();
      const values = elements.map((element) => {
        const node = $(element).clone();
        if (["parkingRaw", "areaRaw", "totalAreaRaw"].includes(field)) node.find("b,strong,dt,br").after(" ");
        if (["neighborhood", "city"].includes(field)) node.find("b,strong").remove();
        return normalizeText(attr ? $(element).attr(attr[2]) : node.text());
      }).filter(Boolean);
      const valid = values.filter((text) => validField(field, text));
      if (!valid.length) continue;
      const unique = [...new Set(valid)];
      if (["operation", "priceRaw"].includes(field) && unique.length > 1) {
        result[field] = field === "operation" ? unique.join(" / ") : "";
        if (field === "priceRaw") result.priceAmbiguous = true;
      } else result[field] = valid[0];
      result.evidence[field] = { selector, value: result[field] };
      break;
    }
  }
  if (source.locationSeparator && result.city) {
    const parts = result.city.split(source.locationSeparator).map(value => value.trim()).filter(Boolean);
    if (parts.length === 2) {
      result.neighborhood = parts[0];
      result.city = parts[1];
      result.evidence.neighborhood = {...result.evidence.city, value:parts[0]};
      result.evidence.city = {...result.evidence.city, value:parts[1]};
    }
  }
  if (source.detailLabelSelector) {
    const labels = { ambientes: "roomsRaw", cocheras: "parkingRaw", "superficie total": "totalAreaRaw", "superficie cub.": "areaRaw" };
    for (const element of $(source.detailLabelSelector).toArray()) {
      const label = normalizeText($(element).text()).toLowerCase();
      const field = labels[label];
      if (!field || result[field]) continue;
      let value = "";
      for (let node = element.nextSibling; node && node.type === "text"; node = node.nextSibling) value += node.data;
      value = normalizeText(value);
      if (!validField(field, value)) continue;
      result[field] = field === "areaRaw" ? `Cubierta: ${value}` : field === "totalAreaRaw" ? `Total: ${value}` : value;
      result.evidence[field] = { selector: `${source.detailLabelSelector}: ${label} + text`, value: result[field] };
    }
  }
  if (!result.parkingRaw) {
    const label = $("li p").filter((i, e) => /^(?:Cocheras?|Garages?|Garajes?):?$/i.test(normalizeText($(e).text()))).first();
    const value = normalizeText(label.closest("ul").next("ul").text());
    if (label.length && parkingStatus(value, true)) {
      result.parkingRaw = value;
      result.evidence.parkingRaw = { selector: "parking label + value", value };
    }
  }
  requestedOperation ||= parseOperation(urlPath(url || $("link[rel='canonical']").attr("href")));
  if (!parseOperation(result.operation) && requestedOperation) {
    result.operation = requestedOperation;
    result.evidence.operation = { selector: "operation-specific catalog", value: requestedOperation };
  }
  if (["Venta", "Alquiler", "Alquiler temporario"].includes(requestedOperation)) {
    for (const block of $(".prop-detail-prices > p, .operations-box .operation-div").toArray()) {
      const node = $(block);
      const operation = parseOperation(node.find(".prop-detail-op-tag, .operation-type-div").text());
      if (operation !== requestedOperation) continue;
      const value = normalizeText(node.find(".price-number, .operation-val").text());
      result.operation = operation;
      result.priceRaw = money.test(value) ? value : "";
      result.priceAmbiguous = false;
      result.evidence.operation = { selector: "operation block matching property URL", value: operation };
      result.evidence.priceRaw = { selector: "price within matching operation block", value: result.priceRaw };
      break;
    }
  }
  // Tokko's detail view uses paired label/value lists and a location breadcrumb.
  const location = normalizeText($(".single_property_title p").first().text()).split("|").map((s) => s.trim()).filter(Boolean);
  if (location.length >= 3) {
    result.neighborhood ||= location.at(-3);
    result.city = location.at(-2);
    result.evidence.neighborhood ||= { selector: ".single_property_title p", value: result.neighborhood };
    const address = location.slice(0, -3).join(" | ");
    if (!result.address && validField("address", address) && /\d/.test(address) && !/\b(venta|chalet|ambientes)\b/i.test(address)) {
      result.address = address;
      result.evidence.address = { selector: ".single_property_title p", value: address };
    }
  }
  if (!result.roomsRaw) {
    const label = $("li p").filter((i, e) => /^Ambientes:?$/i.test(normalizeText($(e).text()))).first();
    const value = normalizeText(label.closest("ul").next("ul").text());
    if (parseRooms(value) != null) {
      result.roomsRaw = value;
      result.evidence.roomsRaw = { selector: "Ambientes: + value", value };
    }
  }
  if (!result.areaRaw) {
    const label = $("li p").filter((i, e) => normalizeText($(e).text()) === "Cubierta:").first();
    const value = normalizeText(label.closest("ul").next("ul").text());
    if (area.test(value)) {
      result.areaRaw = `Cubierta: ${value}`;
      result.evidence.areaRaw = { selector: "Cubierta: + value", value };
    }
  }
  if (!result.totalAreaRaw) {
    // Exact technical labels only: never search descriptive prose for numbers.
    for (const element of $("strong,b,dt,span,div").toArray()) {
      const label = $(element);
      if (label.children().length || !/^(?:(?:Superficie|Sup\.|Área|M[²2])\s*)?Total(?:es| construido)?\s*:?$/i.test(normalizeText(label.text()))) continue;
      const container = label.parent().clone();
      container.find("strong,b,dt").after(" ");
      const text = normalizeText(container.text());
      if (text.length > 100 || /cubiert|terreno|descubiert/i.test(text)) continue;
      if (area.test(text)) {
        result.totalAreaRaw = text;
        result.evidence.totalAreaRaw = { selector: "exact total surface label and value", value: text };
        break;
      }
    }
  }
  if (!result.totalAreaRaw) {
    const label = $("li p").filter((i, e) => /^(?:(?:Superficie|Sup\.|Área)\s+)?Total(?:es| construido)?\s*:?$/i.test(normalizeText($(e).text()))).first();
    const value = normalizeText(label.closest("ul").next("ul").text());
    if (label.length && area.test(value)) {
      result.totalAreaRaw = `Total: ${value}`;
      result.evidence.totalAreaRaw = { selector: "Total: + value", value: result.totalAreaRaw };
    }
  }
  result.city ||= normalizeText($(".list-info-1a li:contains('Ciudad:'), #Description .list-info-2 li:contains('Ciudad:')").first().text()).replace(/^Ciudad:\s*/i, "");
  if (!result.neighborhood) {
    const description = normalizeText($(".descripcionDeFicha").first().text());
    const labeled = description.match(/(?:Ubicación|Barrio)\s*:\s*([^,.;\n]{1,80})/i);
    if (labeled && !/\d/.test(labeled[1])) {
      result.neighborhood = labeled[1].trim();
      result.evidence.neighborhood = { selector: ".descripcionDeFicha: explicitly labeled location", value: result.neighborhood };
    }
  }
  result.rawText = normalizeText([result.address, result.title, result.neighborhood, result.city].join(" "));
  return result;
}

export function catalogFields(item) {
  const operation = item.operations?.find((o) => parseOperation(o.type) === "Venta") || item.operations?.[0] || {};
  const location = (item.location?.full_location || "").split("|").map((s) => s.trim());
  const result = {
    address: item.address || "", title: item.publication_title || "", summary: item.description || "",
    neighborhood: item.location?.type === "Localidad" ? "" : item.location?.name || "",
    city: item.location?.type === "Localidad" ? item.location.name : location.at(-2) || "",
    operation: operation.type || "", propertyType: item.property_type?.name || "",
    roomsRaw: item.room_amount ?? "",
    totalAreaRaw: Number(item.total_surface) > 0 ? `${item.total_surface} m2 total` : "",
    parkingRaw: item.garage_amount == null ? "" : String(item.garage_amount),
    areaRaw: Number(item.roofed_surface) > 0 ? `Cubierta: ${item.roofed_surface} m2` : Number(item.total_surface) > 0 ? `Total: ${item.total_surface} m2` : Number(item.surface) > 0 ? `Terreno: ${item.surface} m2` : "",
    priceRaw: item.web_price === false ? "" : operation.price ? `${operation.currency || ""} ${operation.price}` : "",
    priceWithheld: item.web_price === false,
    evidence: {}
  };
  for (const field of ["address", "title", "neighborhood", "city", "operation", "propertyType", "areaRaw", "totalAreaRaw", "priceRaw", "roomsRaw", "parkingRaw"]) {
    result.evidence[field] = { selector: `Robles property JSON: ${field}`, value: result[field] };
  }
  return result;
}

function validField(field, text) {
  if (!text) return false;
  if (field === "summary") return text.length <= 20000;
  if (text.length > ({ address: 180, title: 200, priceRaw: 100, areaRaw: 100, neighborhood: 80, operation: 80, propertyType: 80 }[field] || 200)) return false;
  if (field === "priceRaw") return money.test(text);
  if (["areaRaw", "totalAreaRaw"].includes(field)) return text.length <= 100 && area.test(text);
  if (field === "roomsRaw") return parseRooms(text) != null;
  if (field === "parkingRaw") return !!parkingStatus(text, true);
  if (field === "address") return !/@|https?:|\b(venta|vende|ambientes|dormitorios|precio|descripcion|contacto|whatsapp)\b/i.test(text);
  return !/@|https?:|whatsapp/i.test(text);
}

export function splitSelectors(selector) {
  const parts = []; let current = ""; let depth = 0; let quote = "";
  for (const char of selector) {
    if (quote) { if (char === quote) quote = ""; }
    else if (char === "'" || char === '"') quote = char;
    else if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;
    if (char === "," && !depth && !quote) { parts.push(current.trim()); current = ""; }
    else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
