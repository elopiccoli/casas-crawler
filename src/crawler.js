import * as cheerio from "cheerio";
import {
  absolutizeUrl,
  inferOperation,
  matchesFilters,
  normalizeText,
  parseArea,
  parsePrice,
  parseRooms,
  sleep,
  uniqueBy
} from "./utils.js";

export async function crawlSources(config, options = {}) {
  const requestConfig = config.request || {};
  const logger = options.logger || null;
  const listings = [];

  for (const source of config.sources || []) {
    if (source.enabled === false) continue;

    logger?.(`Revisando ${source.name}...`);
    try {
      const sourceListings = await crawlSource(source, requestConfig, config.filters || {});
      logger?.(`  ${source.name}: ${sourceListings.length} publicaciones`);
      listings.push(...sourceListings);
    } catch (error) {
      logger?.(`  ${source.name}: error (${error.message})`);
    }
  }

  return uniqueBy(listings, (listing) => `${listing.url}|${listing.operation}`);
}

async function crawlSource(source, requestConfig, globalFilters) {
  if (source.format === "roblesCatalog") {
    return crawlRoblesCatalog(source, requestConfig, globalFilters);
  }

  const visitedPages = new Set();
  const detailUrls = new Map();
  const listings = [];

  for (const startUrl of source.startUrls || []) {
    let pageUrl = startUrl;
    let pageCount = 0;
    const maxPages = source.pagination?.maxPages || 1;
    let nextPageNumber = source.pagination?.firstPage || 2;

    while (pageUrl && !visitedPages.has(pageUrl) && pageCount < maxPages) {
      visitedPages.add(pageUrl);
      pageCount += 1;

      const html = await fetchHtml(pageUrl, requestConfig);
      const $ = cheerio.load(html);
      removeNonContentNodes($);

      for (const cardListing of extractListingsFromPage($, pageUrl, source)) {
        if (!detailUrls.has(cardListing.url)) detailUrls.set(cardListing.url, cardListing);
      }

      const nextHref = source.pagination?.nextSelector
        ? $(source.pagination.nextSelector).first().attr("href")
        : "";
      pageUrl = nextHref
        ? absolutizeUrl(nextHref, pageUrl)
        : buildQueryPageUrl(startUrl, source.pagination, nextPageNumber);
      nextPageNumber += 1;

      if (pageUrl) await sleep(requestConfig.delayMs || 1000);
    }
  }

  for (const [url, cardListing] of detailUrls.entries()) {
    const detailListing = await crawlDetail(url, source, requestConfig).catch((error) => ({
      error: error.message
    }));

    const listing = finalizeListing(source.name, url, {
      ...cardListing,
      ...emptyToFallback(detailListing, cardListing)
    });

    if (matchesFilters(listing, mergeFilters(globalFilters, source.filters || {}))) {
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
      const operations = Array.isArray(item.operations) && item.operations.length
        ? item.operations
        : [{}];
      const url = absolutizeUrl(`/propiedades/${item.slug}`, source.siteUrl || startUrl);
      const address = [
        item.address,
        item.location?.name,
        filters.city || source.city
      ].filter(Boolean).join(", ");

      for (const operationEntry of operations) {
        const operationName = operationEntry.type || operationEntry.operation || operationEntry.name || "";
        const priceRaw = operationEntry.price
          ? `${operationEntry.currency || ""} ${Math.trunc(Number(operationEntry.price))}`
          : "";
        const listing = finalizeListing(source.name, url, {
          operation: operationName,
          address,
          areaRaw: item.surface ? `${Number(item.surface)} m2` : "",
          roomsRaw: item.rooms || item.ambiences || item.ambientes || "",
          priceRaw,
          propertyType: item.property_type?.name || "",
          title: item.publication_title || "",
          summary: item.description || "",
          rawText: normalizeText(JSON.stringify({
            address,
            item,
            operation: operationEntry
          }))
        });

        if (matchesFilters(listing, filters)) listings.push(listing);
      }
    }
  }

  return uniqueBy(listings, (listing) => `${listing.url}|${listing.operation}`);
}

function extractListingsFromPage($, pageUrl, source) {
  const listings = [];
  const publicationRegex = source.publicationUrlRegex ? new RegExp(source.publicationUrlRegex, "i") : null;
  const cards = source.listingSelector ? $(source.listingSelector).toArray() : $("a[href]").toArray();

  for (const card of cards) {
    const scope = $(card);
    const linkElement = source.linkSelector ? scope.find(source.linkSelector).first() : scope;
    const url = absolutizeUrl(linkElement.attr("href"), pageUrl);

    if (!url) continue;
    if (publicationRegex && !publicationRegex.test(url)) continue;

    const listing = {
      url,
      address: pickText($, scope, source.fields?.address),
      areaRaw: pickText($, scope, source.fields?.area),
      roomsRaw: pickText($, scope, source.fields?.rooms),
      priceRaw: pickText($, scope, source.fields?.price),
      propertyType: pickText($, scope, source.fields?.propertyType),
      title: pickText($, scope, source.fields?.title),
      summary: pickText($, scope, source.fields?.summary),
      rawText: normalizeText(scope.text())
    };
    listing.operation = pickText($, scope, source.fields?.operation)
      || inferOperation({ ...listing, contextUrl: pageUrl });
    listings.push(listing);
  }

  return uniqueBy(listings, (listing) => listing.url);
}

async function crawlDetail(url, source, requestConfig) {
  if (!source.detailFields) return {};

  const html = await fetchHtml(url, requestConfig);
  const $ = cheerio.load(html);
  const jsonLdListing = extractJsonLdListing($);
  removeNonContentNodes($);
  const title = pickText($, $.root(), source.detailFields.title);
  const summary = pickText($, $.root(), source.detailFields.summary);
  const rawText = normalizeText($.root().text());

  return {
    operation: pickText($, $.root(), source.detailFields.operation)
      || inferOperation({ title, summary, rawText, url }),
    address: pickText($, $.root(), source.detailFields.address) || jsonLdListing.address,
    areaRaw: pickText($, $.root(), source.detailFields.area) || jsonLdListing.areaRaw,
    roomsRaw: pickText($, $.root(), source.detailFields.rooms) || jsonLdListing.roomsRaw,
    priceRaw: pickText($, $.root(), source.detailFields.price) || jsonLdListing.priceRaw,
    propertyType: pickText($, $.root(), source.detailFields.propertyType),
    title,
    summary,
    rawText
  };
}

function removeNonContentNodes($) {
  $("script, style, noscript, iframe, svg, template").remove();
}

async function fetchHtml(url, requestConfig) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestConfig.timeoutMs || 20000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": requestConfig.userAgent || "Mozilla/5.0 (compatible; CasasCrawler/0.1)",
        "accept": "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} al descargar ${url}`);
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

function pickText($, scope, selector) {
  if (!selector) return "";
  return normalizeText(splitSelectors(selector).flatMap((part) => {
    const attrMatch = part.match(/^(.*?)::attr\(([^)]+)\)$/);
    if (attrMatch) {
      const cssSelector = attrMatch[1].trim();
      const attrName = attrMatch[2].trim();
      return scope.find(cssSelector).toArray().map((element) => $(element).attr(attrName) || "");
    }
    return scope.find(part).toArray().map((element) => $(element).text());
  }).join(" "));
}

function splitSelectors(selector) {
  const selectors = [];
  let current = "";
  let depth = 0;

  for (const char of selector) {
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth -= 1;
    if (char === "," && depth === 0) {
      selectors.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) selectors.push(current.trim());
  return selectors;
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

function extractJsonLdListing($) {
  for (const element of $("script[type='application/ld+json']").toArray()) {
    const text = $(element).contents().text();
    const parsed = safeJsonParse(text);
    const nodes = Array.isArray(parsed) ? parsed : [parsed];

    for (const node of flattenJsonLd(nodes)) {
      const type = Array.isArray(node?.["@type"]) ? node["@type"].join(" ") : node?.["@type"];
      if (!/Offer|Product|Residence|Apartment|House|RealEstateListing/i.test(type || "")) continue;

      const offer = node.offers || node.offer || {};
      const address = typeof node.address === "string"
        ? node.address
        : [node.address?.streetAddress, node.address?.addressLocality].filter(Boolean).join(", ");

      return {
        address: normalizeText(address),
        areaRaw: normalizeText(node.floorSize?.value || node.floorSize || node.area || ""),
        roomsRaw: normalizeText(node.numberOfRooms?.value || node.numberOfRooms || ""),
        priceRaw: normalizeText(offer.price || node.price || "")
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

  for (const key of [
    "operation",
    "address",
    "areaRaw",
    "roomsRaw",
    "priceRaw",
    "propertyType",
    "title",
    "summary",
    "rawText"
  ]) {
    result[key] = primary?.[key] || fallback?.[key] || "";
  }

  return result;
}

function finalizeListing(sourceName, url, listing) {
  const price = parsePrice(listing.priceRaw);
  const operation = inferOperation({ ...listing, url });
  const roomsCount = parseRooms([
    listing.roomsRaw,
    listing.title,
    listing.summary,
    listing.rawText
  ].join(" "));

  return {
    sourceName,
    operation,
    address: listing.address || "",
    neighborhood: "",
    areaM2: parseArea(listing.areaRaw),
    roomsCount,
    priceAmount: price.amount,
    currency: price.currency,
    url,
    propertyType: listing.propertyType || "",
    title: listing.title || "",
    summary: listing.summary || "",
    searchText: normalizeText([
      sourceName,
      operation,
      listing.address,
      listing.propertyType,
      listing.title,
      listing.summary,
      listing.rawText,
      url
    ].join(" ")),
    scrapedAt: new Date()
  };
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
