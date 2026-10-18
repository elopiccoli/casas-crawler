import { readFile, writeFile } from "node:fs/promises";
import yaml from "js-yaml";
import * as cheerio from "cheerio";

const host = value => new URL(value).hostname.replace(/^www\./, "");
const known = new Map();
async function collect(file, base) {
  const html = await readFile(file, "utf8").catch(() => "");
  if (!html) return;
  const $ = cheerio.load(html);
  const origin = new URL(base).origin;
  const resolvedBase = new URL($("base[href]").attr("href") || base, base).href;
  const links = known.get(host(origin)) || new Set();
  for (const element of $("a[href]").toArray()) {
    try {
      const url = new URL($(element).attr("href"), resolvedBase);
      if (host(url.href) === host(origin)) links.add(url.href);
    } catch { /* Ignore non-URL links. */ }
  }
  known.set(host(origin), links);
}
for (const file of ["outputs/new-sources/manifest.json", "outputs/agency-batch/manifest.json"]) {
  const entries = JSON.parse(await readFile(file, "utf8").catch(() => "[]"));
  for (const entry of entries) if (entry.file) await collect(entry.file, entry.finalUrl || entry.url);
}
const originals = JSON.parse(await readFile("outputs/operations/sources.json", "utf8").catch(() => "[]"));
for (const [index, source] of originals.entries()) await collect(`outputs/operations/${index}-home.html`, source.origin);
const config = yaml.load(await readFile("config.yml", "utf8"));
config.filters.propertyTypes = [...new Set([...(config.filters.propertyTypes || []), "Terreno", "Lote"])];
const changes = [];
for (const source of config.sources.filter(s => s.enabled !== false)) {
  const before = source.publicationUrlRegex || "";
  source.publicationUrlRegex = before
    .replaceAll("casa---chalet|chalet|casa|departamento", "casa---chalet|chalet|casa|departamento|terreno|lote")
    .replaceAll("casa|chalet|departamento", "casa|chalet|departamento|terreno|lote");
  // Avoid adding redundant category requests when the source already queries
  // the complete catalog. Only broaden sources with type-specific discovery.
  if (before === source.publicationUrlRegex) continue;
  const links = [...(known.get(host(source.startUrls[0])) || [])];
  const land = links.filter(value => {
    const path = new URL(value).pathname;
    return /^\/[^/]*(?:terreno|lote)[^/]*-en-(?:venta|alquiler)\.html$/i.test(path)
      || /^\/s\/[^/]*(?:terreno|lote)[^/]*\/(?:ventas?|alquiler(?:es)?)$/i.test(path);
  });
  source.startUrls = [...new Set([...source.startUrls, ...land])];
  changes.push({ name: source.name, addedUrls: land });
}
await writeFile("config.yml", yaml.dump(config, { lineWidth: -1, noRefs: true }));
await writeFile("outputs/land-sources.json", JSON.stringify(changes, null, 2) + "\n");
console.log(JSON.stringify({ broadenedSources: changes.length, discoveredLandUrls: changes.reduce((n, item) => n + item.addedUrls.length, 0) }));
