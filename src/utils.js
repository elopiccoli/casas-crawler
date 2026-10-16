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

export function inferOperation(listing = {}) {
  const explicit = detectOperation(listing.operation || "");
  if (explicit) return explicit;

  const primary = detectOperation([
    listing.title,
    listing.url,
    listing.contextUrl
  ].join(" "));
  if (primary) return primary;

  return detectOperation([
    listing.summary,
    listing.rawText,
    listing.searchText
  ].join(" "));
}

function detectOperation(value) {
  const text = normalizeForSearch(value);
  const match = text.match(/\b(alquiler|alquilar|rent|rental|venta|vender|comprar|sale)\b/);
  if (!match) return "";

  return /^(alquiler|alquilar|rent|rental)$/.test(match[1]) ? "Alquiler" : "Venta";
}

export function inferNeighborhood(listing = {}, neighborhoods = []) {
  const text = normalizeForSearch([
    listing.address,
    listing.title,
    listing.summary,
    listing.searchText,
    listing.url
  ].join(" "));

  return neighborhoods.find((neighborhood) =>
    text.includes(normalizeForSearch(neighborhood))
  ) || "";
}

export function parseRooms(value) {
  const text = normalizeForSearch(value);
  if (/\bmonoambiente\b/.test(text)) return 1;

  const match = text.match(/(?:^|[^a-z0-9])(\d{1,2})\s*amb(?:ientes?|s)?\.?(?=$|[^a-z])/);
  return match ? Number(match[1]) : null;
}

export function parseArea(value) {
  const text = normalizeText(value).toLowerCase();
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|mts|metros)/i);
  if (!match) return null;
  return Number(match[1].replace(",", "."));
}

export function parsePrice(value) {
  const text = normalizeText(value);
  const currencyMatch = text.match(/(u\$s|usd|us\$|\$|ars)/i);
  const numberMatch = text.match(/(\d[\d.,]*)/);

  return {
    raw: text,
    currency: currencyMatch ? currencyMatch[1].toUpperCase().replace("US$", "USD").replace("U$S", "USD") : "",
    amount: numberMatch ? Number(numberMatch[1].replace(/\./g, "").replace(",", ".")) : null
  };
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
  const propertyText = normalizeForSearch([
    listing.propertyType,
    listing.title,
    getUrlPath(listing.url)
  ].join(" "));

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

  if (filters.neighborhoods?.length && !matchesAny(text, filters.neighborhoods)) {
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
