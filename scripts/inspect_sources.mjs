import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import yaml from "js-yaml";

const cfg = yaml.load(await readFile("config.yml", "utf8"));
const sources = cfg.sources.filter((source) => source.enabled === false);
const results = [];

for (const source of sources) {
  const url = source.startUrls?.[0];
  console.error(source.name, url);
  const result = await inspect(source.name, url);
  results.push(result);
}

await mkdir("outputs", { recursive: true });
await writeFile("outputs/source_inspection.json", JSON.stringify(results, null, 2), "utf8");
console.log(JSON.stringify(results, null, 2));

async function inspect(name, url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36",
        "accept": "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(15000)
    });
    const html = await response.text();
    const links = [...html.matchAll(/href=["']([^"']+)["']/gi)]
      .map((match) => absolutize(match[1], response.url))
      .filter(Boolean);
    const propLinks = [...new Set(links.filter((link) => /venta|propiedad|propiedades|inmueble|casa|chalet|comprar|\/p\//i.test(link)))]
      .slice(0, 25);

    return {
      name,
      url,
      finalUrl: response.url,
      status: response.status,
      title: strip((html.match(/<title[^>]*>(.*?)<\/title>/is) || [])[1] || ""),
      platform: detectPlatform(html),
      counts: {
        tokkoCards: count(html, "card-prop-short-wide"),
        houzez: count(html, "item-listing-wrap") + count(html, "houzez"),
        wasi: count(html, "wasi.co") + count(html, "item-list"),
        sanz: count(html, "/propiedad/"),
        dante: count(html, "ficha_propiedad") + count(html, "propiedad"),
        usd: count(html, "USD")
      },
      propLinks
    };
  } catch (error) {
    return { name, url, error: error.message };
  }
}

function detectPlatform(html) {
  const lower = html.toLowerCase();
  if (lower.includes("tokkobroker") || lower.includes("card-prop-short-wide")) return "tokko";
  if (lower.includes("houzez") || lower.includes("item-listing-wrap")) return "houzez";
  if (lower.includes("wasi.co") || lower.includes("images.wasi.co")) return "wasi";
  if (lower.includes("/propiedad/") && lower.includes("sanz")) return "sanz";
  if (lower.includes("/n/publico/") || lower.includes("propiedad-en-venta")) return "dante-custom";
  return "unknown";
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

function strip(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function absolutize(href, base) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return "";
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}
