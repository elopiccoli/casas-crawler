import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import yaml from "js-yaml";
import ExcelJS from "exceljs";
import { parseUrls, planSources, mergeListings, registerSources, mergeSnapshots, incrementalReport } from "../src/incremental.js";
import { loadConfig } from "../src/config.js";
import { crawlSources } from "../src/crawler.js";

test("URL selection isolates requested agencies and direct properties", () => {
  const config = { sources: [
    { name: "Old", startUrls: ["https://old.example/venta"] },
    { name: "New", startUrls: ["https://new.example/venta", "https://new.example/alquiler"], detailUrls: ["https://new.example/p/99"] }
  ] };
  assert.deepEqual(parseUrls("new.example, https://new.example/"), ["https://new.example/"]);
  const selected = planSources(config, parseUrls("new.example"));
  assert.deepEqual(selected.map(s=>s.name), ["New"]);
  assert.deepEqual(selected[0].startUrls, config.sources[1].startUrls);
  assert.deepEqual(selected[0].detailUrls, []);
  const direct = planSources(config, ["https://new.example/p/123"], "Publicaciones");
  assert.deepEqual(direct[0].startUrls, []);
  assert.deepEqual(direct[0].detailUrls, ["https://new.example/p/123"]);
  assert.deepEqual(config.sources[1].detailUrls, ["https://new.example/p/99"]);
  assert.throws(() => parseUrls(""));
  assert.throws(() => parseUrls("https://user:password@example.com"));
});

test("incremental merge preserves prior listings and both operations without URL tracking duplicates", () => {
  const old = [
    { url: "https://agency.example/p/1", operation: "Venta", priceAmount: 100 },
    { url: "https://agency.example/p/1", operation: "Alquiler", priceAmount: 10 },
    { url: "https://other.example/p/2", operation: "Venta", priceAmount: 200 }
  ];
  const result = mergeListings(old, [{ url: "https://www.agency.example/p/1?utm_source=test", operation: "Venta", priceAmount: 110 }]);
  assert.equal(result.length, 3);
  assert.equal(result[0].priceAmount, 110);
  assert.deepEqual(result.slice(1), old.slice(1));
});

test("new URLs persist for full refreshes and remain deduplicated", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "casas-config-"));
  try {
    const base = { sources: [{ name: "A", startUrls: ["https://a.example/venta"], detailFields: { title: "h1" } }] };
    const extra = registerSources({ sources: [] }, [{ name: "A", startUrls: ["https://a.example/alquiler"] }]);
    const twice = registerSources(extra, extra.sources);
    assert.equal(twice.sources.length, 1);
    await writeFile(path.join(dir, "config.yml"), yaml.dump(base));
    await writeFile(path.join(dir, "config.extra.yml"), yaml.dump(twice));
    const loaded = await loadConfig(path.join(dir, "config.yml"));
    assert.deepEqual(loaded.sources[0].startUrls, ["https://a.example/venta", "https://a.example/alquiler"]);
    assert.deepEqual(loaded.sources[0].detailFields, { title: "h1" });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("publishing local additions preserves live results and the newest version of duplicates", () => {
  const item = (id, date, price) => ({ link: `https://agency.example/p/${id}`, inmobiliaria: "A", operacion: "Venta", fechaExtraccion: date, precio: price });
  const saved = { listings: [item(1, "2026-10-19", 100), item(2, "2026-10-19", 200)] };
  const live = { listings: [item(1, "2026-10-18", 90), item(3, "2026-10-19", 300)] };
  const merged = mergeSnapshots(saved, live);
  assert.equal(merged.length, 3);
  assert.equal(merged.find(row=>row.url.endsWith("/1")).priceAmount, 100);
});

test("403 diagnostics explain the rejection and preservation of existing results", () => {
  const report = incrementalReport([{ name: "Bartolini" }], [], ["  Bartolini: listado https://example.com: HTTP 403 al descargar https://example.com"]);
  assert.equal(report.blocked, true);
  assert.equal(report.errors.length, 1);
  assert.match(report.text, /HTTP 403/);
  assert.match(report.text, /No se guardaron cambios/);
  assert.match(report.text, /npm run crawl:add/);
});

function runScript(cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL("../scripts/add_urls.mjs", import.meta.url))], {
      cwd, env: { ...process.env, CRAWLER_BASELINE_URL: "", ...env }
    });
    let output = "";
    child.stdout.on("data", data => output += data);
    child.stderr.on("data", data => output += data);
    child.on("error", reject);
    child.on("close", code => resolve({ code, output }));
  });
}

test("incremental command crawls only selected URLs, exports merged Excel, and preserves data on empty runs", async () => {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push(req.url);
    if (req.url === "/blocked") res.statusCode = 403;
    res.setHeader("Content-Type", "text/html");
    res.end(req.url === "/p/1" ? '<h1>Departamento en Alquiler en Centro</h1><span class="property-type">Departamento</span><span class="item-address">Colon 123</span>' : "<h1>Sin resultados</h1>");
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const dir = await mkdtemp(path.join(tmpdir(), "casas-add-"));
  try {
    await mkdir(path.join(dir, "web"));
    const config = { request: { delayMs: 1 }, filters: { city: "Mar del Plata" }, sources: [
      { name: "Unselected", startUrls: ["https://never-request.example/"] },
      { name: "Selected", startUrls: [`${origin}/catalog`], detailFields: {} }
    ] };
    const baseline = { count: 1, listings: [{ inmobiliaria: "Unselected", link: "https://never-request.example/p/10", operacion: "Venta", tipo: "Casa", direccion: "Old 100", fechaExtraccion: "2026-10-18T10:00:00.000Z" }] };
    await writeFile(path.join(dir, "config.yml"), yaml.dump(config));
    await writeFile(path.join(dir, "config.extra.yml"), "sources: []\n");
    await writeFile(path.join(dir, "web/publicaciones.json"), JSON.stringify(baseline));
    const result = await runScript(dir, { CRAWLER_URLS: `${origin}/p/1`, CRAWLER_URL_KIND: "Publicaciones" });
    assert.equal(result.code, 0, result.output);
    assert.deepEqual(requests, ["/p/1"]);
    const payload = JSON.parse(await readFile(path.join(dir, "web/publicaciones.json"), "utf8"));
    assert.equal(payload.count, 2);
    assert.equal(payload.listings[0].link, baseline.listings[0].link);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(dir, "outputs/publicaciones.xlsx"));
    assert.equal(workbook.worksheets[0].rowCount, 3);
    const fullConfig = await loadConfig(path.join(dir, "config.yml"));
    fullConfig.sources = fullConfig.sources.filter(source => source.name === "Selected");
    const refreshed = await crawlSources(fullConfig);
    assert.equal(refreshed.length, 1, "future full refreshes must retain explicitly added property URLs without a city field");
    const before = await readFile(path.join(dir, "web/publicaciones.json"), "utf8");
    const extraBefore = await readFile(path.join(dir, "config.extra.yml"), "utf8");
    const failed = await runScript(dir, { CRAWLER_URLS: `${origin}/empty`, CRAWLER_URL_KIND: "Publicaciones" });
    assert.notEqual(failed.code, 0);
    assert.match(failed.output, /No se extrajeron publicaciones/);
    assert.equal(await readFile(path.join(dir, "web/publicaciones.json"), "utf8"), before);
    assert.equal(await readFile(path.join(dir, "config.extra.yml"), "utf8"), extraBefore);
    const blocked = await runScript(dir, { CRAWLER_URLS: `${origin}/blocked`, CRAWLER_URL_KIND: "Publicaciones" });
    assert.notEqual(blocked.code, 0);
    assert.match(blocked.output, /HTTP 403: el sitio rechazó/);
    assert.doesNotMatch(blocked.output, /at file:\/\//);
    assert.equal(await readFile(path.join(dir, "web/publicaciones.json"), "utf8"), before);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
