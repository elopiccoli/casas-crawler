import { readFile, writeFile } from "node:fs/promises";
import yaml from "js-yaml";

// Discovery manifest is produced by inspecting the public home pages.
const manifest = JSON.parse(await readFile("outputs/requested-batch/manifest.json", "utf8"));
const config = yaml.load(await readFile("config.yml", "utf8"));
const sources = [];
let added = 0;
for (const item of manifest) {
  const existing = config.sources.find(source => source.website && new URL(source.website).hostname.replace(/^www\./, "") === new URL(item.url).hostname.replace(/^www\./, ""));
  if (existing) {
    if (item.index === 3) {
      existing.startUrls = [item.url];
      existing.detailFields = { title: "h2.text-2xl:first", price: "h1", operation: "h1",
        propertyType: ".mb-6.mt-6 > p:first-child", address: ".mb-6.mt-6 > p.text-sm", city: ".mb-6.mt-6 > p.text-sm",
        rooms: ".flex.flex-col:has(> span:contains('Ambientes')) > span.font-semibold",
        area: ".flex.flex-col:has(> span:contains('Superficie Cubierta')) > span.font-semibold",
        parking: ".feature-badge:contains('Cochera') span", summary: ".prose" };
      existing.notes = "Extracción verificada desde las fichas enlazadas en inicio. El listado general requiere JavaScript; cobertura inicial parcial.";
    }
    sources.push(existing); continue;
  }
  const source = { name: item.name, website: item.url, enabled: true,
    startUrls: [item.url], pagination: { maxPages: 1 }, listingSelector: "a[href]", detailFields: {} };
  if ([0,7,8,9,10,11].includes(item.index)) {
    source.format = "mardelCatalog";
    source.pagination.maxPages = 80;
    if (item.index === 0) {
      source.portal = true;
      source.catalogUrl = "https://api.mardelinmueble.com/v3/mardelinmueble/inmuebles/";
      source.notes = "Portal de varias inmobiliarias; se extrae el catálogo público estructurado con paginación.";
    } else {
      const data = JSON.parse(await readFile(`outputs/requested-batch/${item.index}-api-config.json`, "utf8"));
      source.catalogUrl = `https://api.mardelinmueble.com/v3/inmobiliarias/${data.inmobiliaria.id}/inmuebles?id_inmobiliaria=${data.inmobiliaria.id}`;
      source.notes = "Catálogo público identificado mediante el dominio de la inmobiliaria en la plataforma Mar del Inmueble.";
    }
  } else if (item.index === 2) {
    source.startUrls = item.links.filter(url => url.includes("/propiedades.php?"));
    source.publicationUrlRegex = "/detalle-item\\.php\\?item_id=\\d+";
    source.detailFields = { title: "h2.text-left:contains('Departamento'), h2.text-left:contains('Casa'), h2.text-left",
      address: "h2.text-left:first", city: "h2.text-left:first", operation: "h2.color-red", price: "h2.text-right:contains('Precio')",
      rooms: ".largo:contains('ambientes')", area: ".largo:contains('Superficie Cubierta')",
      parking: ".row:has(> i.icon-f-cochera) > .largo", propertyType: "h2.text-left:contains('Departamento'), h2.text-left:contains('Casa')" };
    source.preferConfiguredFields = true;
    source.notes = "Listados y fichas verificados. Publica también propiedades fuera de Mar del Plata; se conserva el filtro de ciudad.";
  } else if (item.index === 5) {
    source.startUrls = item.links.filter(url => /\/(venta|alquiler)$/.test(url));
    source.publicationUrlRegex = "/propiedades/[a-z0-9]+(?:$|[?#])";
    source.preferConfiguredFields = true;
    source.detailFields = { title: ".tgpd-title", address: ".tgpd-title", price: ".tgpd-price",
      operation: ".tgpd-tags .tgpd-tag-venta, .tgpd-tags .tgpd-tag-alquiler", propertyType: ".tgpd-tags .tgpd-tag-outline",
      neighborhood: ".tgpd-loc", rooms: ".tgpd-extra-row:contains('ambientes') p", area: ".tgpd-extra-row:contains('cubiertos') p",
      parking: ".tgpd-extra-row:contains('cochera') p", summary: ".tgpd-description, .tgpd-description-text, .tgpd-desc" };
    source.filters = { city: null };
    source.notes = "Fichas verificadas. La ubicación estructurada indica barrio, sin ciudad separada; no se infiere ciudad desde el pie de página.";
  } else if (item.index === 6) {
    source.startUrls = [new URL("/listing?purpose=rent", item.url).href, new URL("/listing?purpose=sale", item.url).href];
    source.publicationUrlRegex = "/ad/[^/?]+";
    source.preferConfiguredFields = true;
    source.detailFields = { title: ".detail__title", address: ".detail__address", city: ".detail__address", price: ".detail__price",
      operation: ".detail__badges .tag--op", propertyType: ".detail__badges .tag--type", rooms: ".detail__main .feats li:contains('Ambientes') strong",
      parking: ".detail__main .feats li:contains('Cochera') strong", area: ".detail__main .kv:contains('cubierta')", summary: ".detail__text" };
  }
  config.sources.push(source); sources.push(source); added++;
}
await writeFile("config.yml", yaml.dump(config, { lineWidth: -1, noRefs: true }));
await writeFile("outputs/requested-batch/sources.json", JSON.stringify(sources, null, 2));
console.log(JSON.stringify({ requested: sources.length, added }));
