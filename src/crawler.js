import * as cheerio from "cheerio";
import { absolutizeUrl, matchesFilters, normalizeText, sleep, uniqueBy } from "./utils.js";
import { extractPropertyFields, catalogFields } from "./property-extraction.js";
import { finalizeListing } from "./listing.js";
import { parseOperation, urlPath } from "../web/property-fields.js";

export async function crawlSources(config, options = {}) {
  const requestConfig = config.request || {};
  const logger = options.logger || null;
  const listings = [];

  for (const source of config.sources || []) {
    if (source.enabled === false) continue;

    logger?.(`Revisando ${source.name}...`);
    try {
      const sourceListings = await crawlSource(source, requestConfig, config.filters || {}, logger);
      logger?.(`  ${source.name}: ${sourceListings.length} publicaciones`);
      listings.push(...sourceListings);
    } catch (error) {
      logger?.(`  ${source.name}: error (${error.message})`);
    }
  }

  return uniqueBy(listings, (listing) => `${listing.url}|${listing.operation}`);
}

async function crawlSource(source, requestConfig, globalFilters, logger) {
  if (source.format === "roblesCatalog") {
    return crawlRoblesCatalog(source, requestConfig, globalFilters);
  }

  const visitedPages = new Set();
  const detailUrls = new Map();
  const listings = [];
  for (const url of source.detailUrls || []) {
    const requestedOperation = parseOperation(urlPath(url));
    detailUrls.set(`${url}|${requestedOperation}`, { url, requestedOperation });
  }

  for (const startUrl of source.startUrls || []) {
    const start = new URL(startUrl);
    const requestedOperation = parseOperation(start.searchParams.get("operacion") || urlPath(startUrl));
    let pageUrl = startUrl;
    let pageCount = 0;
    const maxPages = source.pagination?.maxPages || 1;
    let nextPageNumber = source.pagination?.firstPage || 2;

    while (pageUrl && !visitedPages.has(pageUrl) && pageCount < maxPages) {
      visitedPages.add(pageUrl);
      pageCount += 1;

      let html;
      try {
        html = await fetchHtml(pageUrl, requestConfig, source.listingRequest);
      } catch (error) {
        logger?.(`  ${source.name}: listado ${pageUrl}: ${error.message}`);
        break;
      }
      const $ = cheerio.load(html);

      let discovered = 0;
      for (const cardListing of extractListingsFromPage($, pageUrl, source)) {
        const key = `${cardListing.url}|${requestedOperation}`;
        if (!detailUrls.has(key)) {
          detailUrls.set(key, { ...cardListing, requestedOperation });
          discovered++;
        }
      }
      if (!discovered) break;

      const nextHref = source.pagination?.nextSelector
        ? $(source.pagination.nextSelector).first().attr("href")
        : "";
      pageUrl = nextHref
        ? absolutizeUrl(nextHref, pageUrl)
        : buildQueryPageUrl(startUrl, source.pagination, nextPageNumber);
      nextPageNumber += source.pagination?.step || 1;

      if (pageUrl) await sleep(requestConfig.delayMs || 1000);
    }
  }

  for (const cardListing of detailUrls.values()) {
    const { url, requestedOperation } = cardListing;
    const detailListing = await crawlDetail(url, source, requestConfig, requestedOperation).catch((error) => ({
      error: error.message
    }));

    const listing = finalizeListing(source.name, url, {
      ...cardListing,
      ...emptyToFallback(detailListing, cardListing)
    });

    if ((source.detailUrls || []).includes(url) || matchesFilters(listing, mergeFilters(globalFilters, source.filters || {}))) {
      listings.push(listing);
    }

    await sleep(requestConfig.delayMs || 1000);
  }

  return listings;
}

async function crawlRoblesCatalog(source, requestConfig, globalFilters) {
  const listings = [];
  const filters = mergeFilters(globalFilters, source.filters || {});

  for (const startUrl of source.startUrls || []) {
    const catalog = await fetchJson(startUrl, requestConfig);
    const items = Array.isArray(catalog?.data) ? catalog.data : [];

    for (const item of items) {
      const url = absolutizeUrl(`/propiedades/${item.slug}`, source.siteUrl || startUrl);
      const listing = finalizeListing(source.name, url, catalogFields(item));

      if (matchesFilters(listing, filters)) listings.push(listing);
    }
  }

  return uniqueBy(listings, (listing) => listing.url);
}

function extractListingsFromPage($, pageUrl, source) {
  const listings = [];
  const publicationRegex = source.publicationUrlRegex ? new RegExp(source.publicationUrlRegex, "i") : null;
  const cards = source.listingSelector ? $(source.listingSelector).toArray() : $("a[href]").toArray();
  const baseUrl = absolutizeUrl($("base[href]").first().attr("href"), pageUrl) || pageUrl;

  for (const card of cards) {
    const scope = $(card);
    const linkElement = source.linkSelector ? scope.find(source.linkSelector).first() : scope;
    const url = absolutizeUrl(linkElement.attr("href"), baseUrl);

    if (!url) continue;
    if (new URL(url).hostname.replace(/^www\./, "") !== new URL(baseUrl).hostname.replace(/^www\./, "")) continue;
    if (publicationRegex && !publicationRegex.test(url)) continue;

    listings.push({
      url,
      ...extractPropertyFields(cheerio.load($.html(card)), { detailFields: source.fields || {} })
    });
  }

  return uniqueBy(listings, (listing) => listing.url);
}

async function crawlDetail(url, source, requestConfig, requestedOperation) {
  if (!source.detailFields) return {};

  const html = await fetchHtml(url, requestConfig);
  return extractDetailListing(html, source, url, requestedOperation);
}

export function extractDetailListing(html, source, url = "", requestedOperation = "") {
  const $ = cheerio.load(html);
  const jsonLdListing = extractJsonLdListing($, url);
  $("script, style, noscript, template").remove();
  // These are other properties, never fallback values for the current one.
  $(".item-listing-wrap, .similar-properties, .related-properties, .prop-similar").remove();

  const result = extractPropertyFields($, source, url, requestedOperation);
  for (const field of ["address", "areaRaw", "priceRaw", "propertyType", "title", "roomsRaw"]) {
    if (!result[field] && jsonLdListing[field] && !(field === "priceRaw" && (result.priceAmbiguous || result.priceWithheld))) {
      result[field] = jsonLdListing[field];
      result.evidence[field] = { selector: "JSON-LD", value: result[field] };
    }
  }
  return result;
}

async function fetchHtml(url, requestConfig, listingRequest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestConfig.timeoutMs || 20000);

  try {
    const response = await fetch(url, {
      ...(listingRequest?.method === "POST" ? {
        method: "POST",
        body: new URLSearchParams({ ...listingRequest.form, ...Object.fromEntries(new URL(url).searchParams) })
      } : {}),
      signal: controller.signal,
      headers: {
        "user-agent": requestConfig.userAgent || "Mozilla/5.0 (compatible; CasasCrawler/0.1)",
        "accept": "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} al descargar ${url}`);
    }

    if (listingRequest?.responseHtmlField) {
      const payload = await response.json();
      const html = payload[listingRequest.responseHtmlField];
      if (typeof html !== "string") throw new Error("El listado JSON no contiene HTML");
      return html;
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, requestConfig) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestConfig.timeoutMs || 20000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": requestConfig.userAgent || "Mozilla/5.0 (compatible; CasasCrawler/0.1)",
        "accept": "application/json,text/plain,*/*"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} al descargar ${url}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function buildQueryPageUrl(startUrl, pagination, pageNumber) {
  if (!pagination?.pageParam) return "";

  const url = new URL(startUrl);
  for (const [key, value] of Object.entries(pagination.params || {})) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set(pagination.pageParam, String(pageNumber));
  return url.toString();
}

function extractJsonLdListing($, pageUrl = "") {
  for (const element of $("script[type='application/ld+json']").toArray()) {
    const text = $(element).contents().text();
    const parsed = safeJsonParse(text);
    const nodes = Array.isArray(parsed) ? parsed : [parsed];

    for (const node of flattenJsonLd(nodes)) {
      const type = Array.isArray(node?.["@type"]) ? node["@type"].join(" ") : node?.["@type"];
      if (!/Offer|Product|Residence|Apartment|House|RealEstateListing/i.test(type || "")) continue;
      if (pageUrl && node.url) {
        const candidateUrl = absolutizeUrl(node.url, pageUrl).split("#")[0].replace(/\/$/, "");
        if (candidateUrl !== pageUrl.split("#")[0].replace(/\/$/, "")) continue;
      }

      const offer = node.offers || node.offer || {};
      const address = typeof node.address === "string"
        ? node.address
        : [node.address?.streetAddress, node.address?.addressLocality].filter(Boolean).join(", ");

      return {
        roomsRaw: node.numberOfRooms?.value ?? node.numberOfRooms ?? "",
        address: normalizeText(address),
        areaRaw: node.floorSize?.value
          ? (!node.floorSize.unitCode || /^(MTK|M2|m²)$/i.test(node.floorSize.unitCode) ? `${node.floorSize.value} m2` : "")
          : normalizeText(node.floorSize || node.area || ""),
        priceRaw: normalizeText([offer.priceCurrency || node.priceCurrency, offer.price || node.price].filter(Boolean).join(" ")),
        title: normalizeText(node.name),
        propertyType: /Apartment/i.test(type) ? "Departamento" : /House/i.test(type) ? "Casa" : ""
      };
    }
  }

  return {};
}

function flattenJsonLd(nodes) {
  const result = [];

  for (const node of nodes.filter(Boolean)) {
    result.push(node);
    if (Array.isArray(node["@graph"])) result.push(...flattenJsonLd(node["@graph"]));
  }

  return result;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function emptyToFallback(primary, fallback) {
  const result = {};

  for (const key of ["address", "areaRaw", "roomsRaw", "parkingRaw", "priceRaw", "propertyType", "title", "summary", "rawText", "operation", "neighborhood", "city", "priceAmbiguous", "priceWithheld", "error"]) {
    result[key] = primary?.[key] || fallback?.[key] || "";
  }
  result.evidence = { ...fallback?.evidence, ...primary?.evidence };
  if (primary?.priceAmbiguous || primary?.priceWithheld) result.priceRaw = "";

  return result;
}

function mergeFilters(globalFilters, sourceFilters) {
  return {
    ...globalFilters,
    ...sourceFilters,
    price: {
      ...(globalFilters.price || {}),
      ...(sourceFilters.price || {})
    }
  };
}

