import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import yaml from "js-yaml";
import { extractDetailListing } from "../src/crawler.js";
import { finalizeListing } from "../src/listing.js";
import { writeListingsJson } from "../src/json.js";
import { matchesFilters } from "../src/utils.js";

const config = yaml.load(await readFile("config.yml", "utf8"));
const previous = JSON.parse(await readFile("web/publicaciones.json", "utf8"));
const refresh = process.argv.includes("--refresh");
const fetchMissing = process.argv.includes("--fetch-missing");
const update = process.argv.includes("--update");
await mkdir("outputs/pages", { recursive: true });
const samples = JSON.parse(await readFile("outputs/source-samples.json", "utf8").catch(() => "[]"));
const results = new Array(previous.listings.length);
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < previous.listings.length) {
    const index = cursor++;
    const old = previous.listings[index];
    const source = config.sources.find((s) => s.name === old.inmobiliaria);
    const file = `outputs/pages/${createHash("sha256").update(old.link).digest("hex")}.html`;
    let fields;
    try {
      let html = await readFile(file, "utf8").catch(() => "");
      if (refresh || fetchMissing && !html) {
        const response = await fetch(old.link, { signal: AbortSignal.timeout(config.request?.timeoutMs || 20000) });
        if (!response.ok) {
          await writeFile(file + ".error.json", JSON.stringify({ error: `HTTP ${response.status}`, checkedAt: new Date().toISOString() }));
          throw new Error(`HTTP ${response.status}`);
        }
        html = await response.text();
        await writeFile(file, html);
      }
      if (!html) {
        const cachedError = JSON.parse(await readFile(file + ".error.json", "utf8").catch(() => "{}"));
        throw new Error(cachedError.error || "No cached page; run with --refresh");
      }
      fields = extractDetailListing(html, source || {}, old.link);
      if (!fields.title && !fields.address) throw new Error("No property content found");
    } catch (error) { fields = { error: error.message }; }
    const listing = finalizeListing(old.inmobiliaria, old.link, fields);
    const eligible = matchesFilters(listing, config.filters);
    const changes = {};
    for (const [external, internal] of Object.entries({ direccion: "address", barrio: "neighborhood", operacion: "operation", precio: "priceAmount", moneda: "currency", metros: "areaM2", tipo: "propertyType" })) {
      if ((old[external] ?? "") !== (listing[internal] ?? "")) changes[external] = { before: old[external] ?? null, after: listing[internal] ?? null };
    }
    results[index] = { listing, eligible, changes };
    console.log(`${index + 1}/${previous.listings.length}: ${old.inmobiliaria}: ${listing.issues.length ? "review" : "parsed"}`);
  }
}));

const report = {
  checkedAt: new Date().toISOString(),
  examined: results.length,
  retained: results.length,
  outsideConfiguredFilters: results.filter((r) => !r.eligible).length,
  recordsWithCorrections: results.filter((r) => Object.keys(r.changes).length).length,
  recordsNeedingReview: results.filter((r) => r.listing.issues.length).length,
  sources: config.sources.map((s) => {
    const records = results.filter((r) => r.listing.sourceName === s.name);
    const sample = samples.find((p) => p.name === s.name);
    return {
      name: s.name, enabled: s.enabled !== false,
      examined: records.length, matchingFilters: records.filter((r) => r.eligible).length,
      needsReview: records.filter((r) => r.listing.issues.length).length,
      status: s.enabled === false ? "disabled" : records.length ? "listing fields audited; see per-field evidence" : "unverified: no current listing sample",
      sampleHttpStatus: sample?.status ?? null,
      missingFields: Object.fromEntries(["address", "neighborhood", "operation", "priceAmount", "currency", "areaM2", "propertyType"].map((field) => [field, records.filter((r) => !r.listing[field]).length]))
    };
  }),
  records: results.map(({ listing, eligible, changes }) => ({ source: listing.sourceName, url: listing.url, eligible, changes, issues: listing.issues, evidence: listing.evidence }))
};
await writeFile("outputs/field-audit.json", JSON.stringify(report, null, 2) + "\n");
if (update) {
  // Keep a recoverable copy before replacing the old, incorrectly parsed export.
  await writeFile("outputs/publicaciones-before-field-audit.json", JSON.stringify(previous, null, 2) + "\n", { flag: "wx" }).catch((error) => { if (error.code !== "EEXIST") throw error; });
  await writeListingsJson(results.map((r) => r.listing), "web/publicaciones.json", config);
  await writeFile("web/auditoria.json", JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ examined: report.examined, retained: report.retained, outsideFilters: report.outsideConfiguredFilters, corrected: report.recordsWithCorrections, review: report.recordsNeedingReview }));
