import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import yaml from "js-yaml";
import { loadConfig } from "../src/config.js";
import { crawlSources } from "../src/crawler.js";
import { writeListingsJson } from "../src/json.js";
import { writeListingsWorkbook } from "../src/excel.js";
import { parseUrls, planSources, importListings, mergeListings, registerSources, incrementalReport } from "../src/incremental.js";

async function main() {
const config = await loadConfig("config.yml");
const urls = parseUrls(process.env.CRAWLER_URLS || process.argv.slice(2).join("\n"));
const kind = process.env.CRAWLER_URL_KIND || "Inmobiliarias";
const sources = planSources(config, urls, kind);
// In Actions, start with the currently published results, including prior manual runs.
// A failed download must stop the run instead of silently overwriting newer data.
const baseline = process.env.CRAWLER_BASELINE_URL
  ? await fetch(process.env.CRAWLER_BASELINE_URL, { signal: AbortSignal.timeout(60000), cache: "no-store" }).then(response => {
    if (!response.ok) throw new Error(`No se pudieron cargar los resultados actuales: HTTP ${response.status}`);
    return response.json();
  })
  : JSON.parse(await readFile("web/publicaciones.json", "utf8"));
const previous = importListings(baseline);
console.log(`Se consultarán sólo ${sources.length} fuentes seleccionadas; se conservan ${previous.length} publicaciones.`);
const messages = [];
const crawled = await crawlSources({ ...config, sources }, { logger: message => { messages.push(message); console.log(message); } });
const results = crawled.filter(item => item.title && (item.propertyType || item.address) && !item.issues?.some(issue => issue.startsWith("page:")));
if (results.length !== crawled.length) console.log(`Se descartaron ${crawled.length - results.length} fichas sin datos suficientes o con errores de descarga.`);
await mkdir("outputs", { recursive: true });
const report = incrementalReport(sources, results, messages);
await writeFile("outputs/incremental-summary.json", JSON.stringify({ urls, sources: sources.map(s=>s.name), extracted: results.length, errors: report.errors }, null, 2));
await writeFile("outputs/incremental-report.md", report.text);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report.text);
if (!results.length) throw new Error(report.blocked
  ? "HTTP 403: el sitio rechazó el acceso desde esta ejecución. No se extrajeron publicaciones ni se modificaron resultados. Revisá el resumen; si el sitio responde en tu computadora, usá npm run crawl:add -- URL."
  : "No se extrajeron publicaciones. Se conservan los resultados y fuentes anteriores. Revisá las URLs o los selectores de la nueva inmobiliaria.");
const listings = mergeListings(previous, results);
const successful = sources.filter(source => results.some(item => item.sourceName === source.name));
const extra = yaml.load(await readFile("config.extra.yml", "utf8"));
await writeFile("config.extra.yml", yaml.dump(registerSources(extra, successful), { lineWidth: -1, noRefs: true }));
const updatedConfig = await loadConfig("config.yml");
await writeFile("outputs/publicaciones-before-incremental.json", JSON.stringify(baseline, null, 2));
await writeListingsWorkbook(listings, "outputs/publicaciones.xlsx", config.excel);
await writeListingsJson(listings, "web/publicaciones.json", updatedConfig);
console.log(`Extraídas: ${results.length}. Total combinado: ${listings.length}. No se consultaron otras fuentes.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
