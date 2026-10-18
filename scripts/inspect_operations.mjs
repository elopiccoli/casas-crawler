import { readFile, writeFile, mkdir } from "node:fs/promises";
import yaml from "js-yaml";
import * as cheerio from "cheerio";

const config = yaml.load(await readFile("config.yml", "utf8"));
const sources = config.sources.filter(source => source.enabled !== false);
await mkdir("outputs/operations", { recursive: true });
const results = new Array(sources.length);
let cursor = 0;
await Promise.all(Array.from({ length: 5 }, async () => {
  while (cursor < sources.length) {
    const index = cursor++;
    const source = sources[index];
    const origin = new URL(source.startUrls[0]).origin;
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(15000) });
      const html = await response.text();
      await writeFile(`outputs/operations/${index}-home.html`, html);
      const $ = cheerio.load(html);
      const links = [...new Set($("a[href]").map((i, element) => {
        try { return new URL($(element).attr("href"), origin).href; } catch { return ""; }
      }).get())].filter(url => url.startsWith(origin) && /alquil|rent|departamento|propiedades|properties/i.test(url));
      results[index] = { name: source.name, origin, status: response.status, links };
    } catch (error) { results[index] = { name: source.name, origin, error: error.message }; }
    console.log(JSON.stringify(results[index]));
  }
}));
await writeFile("outputs/operations/sources.json", JSON.stringify(results, null, 2) + "\n");
