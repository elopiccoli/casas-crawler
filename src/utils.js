export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function absolutizeUrl(href, baseUrl) {
  if (!href) return "";
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

export function normalizeText(value) {
  return String(value ?? "")
    .replace(/&(?:nbsp|#160|#x0*a0);/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

export function normalizeForSearch(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function parseRooms(value, labeledOnly = false) {
  const text = normalizeText(value);
  if (/\bmonoambiente\b/i.test(text)) return 1;
  const match = text.match(/(?<![\d.,])\b(\d+)\s*(?:ambientes?\b|amb\b\.?)/i)
    || text.match(/\bambientes?\s*:?\s*(\d+)(?![\d.,])/i);
  const number = match ? Number(match[1]) : !labeledOnly && /^\d+$/.test(text) ? Number(text) : null;
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function parseArea(value) {
  const text = normalizeText(value).toLowerCase();
  const match = text.match(/(\d[\d.,]*)\s*(?:m2|m²|mts|metros)/i)
    || text.match(/(?:m2|m²)\s*(?:cubiert[oa]s?|totales?|descubiert[oa]s?|terreno)\s*:?\s*(\d[\d.,]*)/i);
  if (!match) return null;
  const number = parsePriceNumber(match[1]);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function parsePrice(value) {
  const text = normalizeText(value);
  const currencyMatch = text.match(/(u\$s|u\$d|usd|us\$|\$|ars)/i);
  const numberMatch = text.match(/(?:u\$s|u\$d|usd|us\$|\$|ars)\s*(\d[\d.,]*)/i)
    || text.match(/^(\d[\d.,]*)$/);

  return {
    raw: text,
    currency: currencyMatch ? currencyMatch[1].toUpperCase().replace("US$", "USD").replace("U$S", "USD").replace("U$D", "USD") : "",
    amount: numberMatch ? parsePriceNumber(numberMatch[1]) : null
  };
}

function parsePriceNumber(value) {
  value = value.replace(/[.,]+$/, "");
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(value)) return Number(value.replace(/[.,]/g, ""));
  const decimal = Math.max(value.lastIndexOf("."), value.lastIndexOf(","));
  if (decimal < 0) return Number(value);
  return Number(value.slice(0, decimal).replace(/[.,]/g, "") + "." + value.slice(decimal + 1));
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

export function matchesFilters(listing, filters = {}) {
  const priceFilter = filters.price || {};
  const text = normalizeForSearch(listing.searchText || [
    listing.address,
    listing.propertyType,
    listing.title,
    listing.summary,
    listing.url
  ].join(" "));
  const propertyText = normalizeForSearch(listing.propertyType || [
    listing.title,
    getUrlPath(listing.url)
  ].join(" "));

  if (filters.operation) {
    const requested = normalizeForSearch(filters.operation);
    const operation = normalizeForSearch(listing.operation);
    if (requested !== "todos" && operation !== requested && !(operation === "venta / alquiler" && ["venta", "alquiler"].includes(requested))) return false;
  }

  if (priceFilter.currency && listing.currency && listing.currency !== normalizeCurrency(priceFilter.currency)) {
    return false;
  }

  if (priceFilter.min != null && listing.priceAmount != null && listing.priceAmount < Number(priceFilter.min)) {
    return false;
  }

  if (priceFilter.max != null && listing.priceAmount != null && listing.priceAmount > Number(priceFilter.max)) {
    return false;
  }

  if (filters.propertyTypes?.length && !matchesAny(propertyText, filters.propertyTypes)) {
    return false;
  }

  if (filters.city && !text.includes(normalizeForSearch(filters.city))) {
    return false;
  }

  if (filters.neighborhoods?.length && !matchesAny(normalizeForSearch(listing.neighborhood || text), filters.neighborhoods)) {
    return false;
  }

  return true;
}

function matchesAny(text, values) {
  return values.some((value) => text.includes(normalizeForSearch(value)));
}

function normalizeCurrency(currency) {
  return String(currency).toUpperCase().replace("US$", "USD").replace("U$S", "USD");
}

function getUrlPath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url || "";
  }
}
