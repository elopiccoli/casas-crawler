import { readFile } from "node:fs/promises";
import { mergeSnapshots } from "../src/incremental.js";
import { loadConfig } from "../src/config.js";
import { writeListingsJson } from "../src/json.js";

const response = await fetch("https://casas-crawler.web.app/publicaciones.json", {
  signal: AbortSignal.timeout(60000), cache: "no-store"
});
if (!response.ok) throw new Error(`No se pudieron conservar las publicaciones actuales: HTTP ${response.status}`);
const payload = await response.json();
const saved = JSON.parse(await readFile("web/publicaciones.json", "utf8"));
const listings = mergeSnapshots(saved, payload);
await writeListingsJson(listings, "web/publicaciones.json", await loadConfig("config.yml"));
console.log(`Se conservan ${payload.listings.length} publicaciones de la web y se combinan las adiciones del repositorio. Total: ${listings.length}.`);
