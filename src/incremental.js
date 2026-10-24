import { normalizeField } from "../web/property-fields.js";

const host = value => new URL(value).hostname.toLowerCase().replace(/^www\./, "");
const sourceUrls = source => [source.website, source.siteUrl, ...(source.startUrls || []), ...(source.detailUrls || [])].filter(Boolean);

export function parseUrls(text) {
  const urls = String(text || "").split(/[\s,;]+/).filter(Boolean).map(value => {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || !url.hostname.includes(".")) {
      throw new Error(`URL no valida: ${value}`);
    }
    url.hash = "";
    return url.href;
  });
  if (!urls.length) throw new Error("Ingresá al menos una URL.");
  return [...new Set(urls)];
}

export function planSources(config, urls, kind = "Inmobiliarias") {
  if (!["Inmobiliarias", "Publicaciones"].includes(kind)) throw new Error("Tipo de URLs no valido.");
  const selected = new Map();
  for (const url of urls) {
    const domain = host(url);
    const known = config.sources.find(source => sourceUrls(source).some(value => host(value) === domain));
    if (known?.enabled === false) throw new Error(`${known.name} está deshabilitada en la configuración.`);
    const name = known?.name || domain;
    if (!selected.has(name)) selected.set(name, {
      ...(known ? structuredClone(known) : {
        name, website: new URL(url).origin, listingSelector: "a[href]", discoverCatalogs: true,
        publicationUrlRegex: "/p/\\d+|/propiedad(?:es)?/[^/?]+|propiedad-inmobiliaria\\.html|(?:casa|chalet|departamento|terreno|lote)-(?:venta|alquiler)",
        fields: { title: "h2, h3, .property-title" }, detailFields: {}, pagination: { maxPages: 1 },
        notes: "Fuente agregada por URL; usa extractores generales. Puede requerir selectores específicos."
      }), startUrls: [], detailUrls: []
    });
    const source = selected.get(name);
    if (kind === "Publicaciones") {
      source.detailUrls.push(url);
      // A property URL must always use the HTML detail extractor.
      delete source.format;
      source.detailFields ||= {};
    } else {
      const isHome = new URL(url).pathname === "/" && !new URL(url).search;
      source.startUrls.push(...(known && isHome && known.startUrls?.length ? known.startUrls : [url]));
    }
  }
  return [...selected.values()].map(source => ({ ...source,
    startUrls: [...new Set(source.startUrls)], detailUrls: [...new Set(source.detailUrls)]
  }));
}

export function importListings(payload) {
  if (!Array.isArray(payload?.listings) || !payload.listings.every(item => item.link && item.inmobiliaria)) {
    throw new Error("El archivo de resultados existentes no es válido; no se reemplazará.");
  }
  return payload.listings.map(item => ({
    sourceName: item.inmobiliaria, url: item.link, address: item.direccion, neighborhood: item.barrio,
    operation: item.operacion, propertyType: item.tipo, rooms: item.ambientes ?? null,
    parking: item.cochera || "No informado", areaM2: item.metros, areaKind: item.superficieTipo,
    priceAmount: item.precio, currency: item.moneda, title: item.titulo, summary: item.resumen,
    issues: item.revision || [], evidence: item.evidencia || {}, scrapedAt: item.fechaExtraccion
  }));
}

function listingKey(item) {
  const url = new URL(item.url);
  url.hash = "";
  url.hostname = url.hostname.replace(/^www\./, "");
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return `${url.href.replace(/\/$/, "")}|${normalizeField(item.operation)}`;
}

export function mergeListings(previous, added) {
  const merged = new Map(previous.map(item => [listingKey(item), item]));
  for (const item of added) merged.set(listingKey(item), item);
  return [...merged.values()];
}

export function mergeSnapshots(saved, published) {
  // A UI deployment may carry local additions while the live site has newer
  // complete runs. Keep both, choosing the newest extraction for each property.
  const ordered = [...importListings(saved), ...importListings(published)]
    .sort((a, b) => (Date.parse(a.scrapedAt) || 0) - (Date.parse(b.scrapedAt) || 0));
  return mergeListings([], ordered);
}

export function normalizeAgencyNames(listings, sources) {
  const names = new Map();
  for (const source of sources) for (const url of sourceUrls(source)) names.set(host(url), source.name);
  return listings.map(item => {
    const domain = String(item.sourceName || "").toLowerCase().replace(/^www\./, "");
    return names.has(domain) ? { ...item, sourceName: names.get(domain) } : item;
  });
}

export function incrementalReport(sources, results, messages) {
  const errors = messages.filter(message => /HTTP \d{3}|error \(/.test(message));
  const blocked = errors.some(message => /HTTP 403\b/.test(message));
  const text = ["## Carga de URLs", "",
    ...sources.map(source => `- ${source.name}: ${results.filter(item => item.sourceName === source.name).length} publicaciones extraídas.`),
    "", ...errors.map(message => `- ${message.replace(/[\r\n]/g, " ")}`),
    ...(blocked ? ["", "El sitio rechazó el acceso con HTTP 403. Puede estar restringiendo el acceso desde GitHub Actions. No se modifica ninguna publicación por ese rechazo.",
      "Si el sitio es accesible desde tu computadora, podés ejecutar localmente `npm run crawl:add -- URL`."] : []),
    ...(!results.length ? ["", "No se guardaron cambios ni se reemplazaron los resultados existentes."] : [])
  ].join("\n") + "\n";
  return { errors, blocked, text };
}

export function registerSources(extra, selected) {
  const sources = structuredClone(extra.sources || []);
  for (const source of selected) {
    const existing = sources.find(item => item.name === source.name);
    if (!existing) sources.push(source);
    else for (const key of ["startUrls", "detailUrls"]) {
      existing[key] = [...new Set([...(existing[key] || []), ...(source[key] || [])])];
    }
  }
  return { ...extra, sources };
}
