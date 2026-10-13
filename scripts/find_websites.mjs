import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { TextDecoder } from "node:util";

const inputPath = process.argv[2] || "inmobiliarias_0.csv";
const outputPath = process.argv[3] || "outputs/inmobiliarias_con_web.csv";
const limit = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || "0");
const delayMs = Number(process.argv.find((arg) => arg.startsWith("--delay-ms="))?.split("=")[1] || "350");
const timeoutMs = Number(process.argv.find((arg) => arg.startsWith("--timeout-ms="))?.split("=")[1] || "8000");

const rows = parseCsv(await readText(inputPath));
const selectedRows = limit > 0 ? rows.slice(0, limit) : rows;
const enriched = [];

for (let index = 0; index < selectedRows.length; index += 1) {
  const row = selectedRows[index];
  const name = cleanName(row.descripcion || "");
  const phone = row["Teléfono 1,"] || row["Tel�fono 1,"] || "";
  const query = [name, "Mar del Plata inmobiliaria sitio web"].filter(Boolean).join(" ");

  console.error(`[${index + 1}/${selectedRows.length}] ${name}`);

  const result = await findWebsite(query, name, phone).catch((error) => ({
    website: "",
    confidence: "error",
    evidence: error.message,
    searchQuery: query
  }));

  enriched.push({
    ...row,
    nombre_buscado: name,
    telefono_buscado: phone,
    sitio_web: result.website,
    confianza: result.confidence,
    evidencia: result.evidence,
    consulta_busqueda: result.searchQuery
  });

  if ((index + 1) % 10 === 0) {
    await saveCsv(outputPath, enriched);
  }

  await sleep(delayMs);
}

await saveCsv(outputPath, enriched);
console.error(`CSV generado: ${outputPath}`);

async function readText(path) {
  const buffer = await readFile(path);
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const replacementCount = (utf8.match(/\uFFFD/g) || []).length;
  if (replacementCount < 5) return utf8;
  return new TextDecoder("windows-1252").decode(buffer);
}

async function findWebsite(query, name, phone) {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=ar-es`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(searchUrl, {
    signal: controller.signal,
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      "accept-language": "es-AR,es;q=0.9,en;q=0.5"
    }
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) throw new Error(`Busqueda HTTP ${response.status}`);

  const html = await response.text();
  const candidates = extractCandidates(html)
    .map((candidate) => scoreCandidate(candidate, name, phone))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best) {
    return {
      website: "",
      confidence: "sin_resultado",
      evidence: "",
      searchQuery: query
    };
  }

  return {
    website: best.url,
    confidence: best.score >= 8 ? "alta" : best.score >= 5 ? "media" : "baja",
    evidence: best.title,
    searchQuery: query
  };
}

async function saveCsv(path, rows) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stringifyCsv(rows), "utf8");
}

function extractCandidates(html) {
  const candidates = [];
  const regex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gis;
  let match;

  while ((match = regex.exec(html))) {
    const url = unwrapDuckDuckGoUrl(decodeHtml(match[1]));
    const title = stripHtml(match[2]);
    if (!url || !title) continue;
    if (isExcludedUrl(url)) continue;
    candidates.push({ url: normalizeWebsiteUrl(url), title });
  }

  return uniqueBy(candidates, (candidate) => candidate.url);
}

function unwrapDuckDuckGoUrl(url) {
  const withProtocol = url.startsWith("//") ? `https:${url}` : url;
  try {
    const parsed = new URL(withProtocol);
    const uddg = parsed.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : withProtocol;
  } catch {
    return "";
  }
}

function scoreCandidate(candidate, name, phone) {
  const normalizedName = normalizeSearch(name);
  const normalizedTitle = normalizeSearch(candidate.title);
  const normalizedHost = normalizeSearch(new URL(candidate.url).hostname.replace(/^www\./, ""));
  const phoneDigits = onlyDigits(phone);
  const haystack = `${normalizedTitle} ${normalizedHost}`;

  let score = 0;
  for (const token of normalizedName.split(" ").filter((token) => token.length > 3)) {
    if (haystack.includes(token)) score += 2;
  }

  if (haystack.includes("inmobiliaria")) score += 2;
  if (haystack.includes("propiedades")) score += 2;
  if (haystack.includes("mar del plata")) score += 1;
  if (phoneDigits && onlyDigits(candidate.title).includes(phoneDigits.slice(-6))) score += 4;
  if (candidate.url.includes(".com.ar") || candidate.url.includes(".com")) score += 1;

  return { ...candidate, score };
}

function cleanName(value) {
  return normalizeSpaces(value)
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWebsiteUrl(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/$/, "");
}

function isExcludedUrl(url) {
  const excluded = [
    "bing.com",
    "google.com",
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "youtube.com",
    "wa.me",
    "whatsapp.com",
    "zonaprop.com",
    "argenprop.com",
    "mercadolibre.com",
    "inmuebles.clarin.com",
    "infobel.com",
    "mapcarta.com",
    "misterwhat.com",
    "todosnegocios.com",
    "cylex.com",
    "cylex.com.ar",
    "cuitonline.com",
    "dateas.com",
    "datoscuit.com",
    "guialocal.com.ar",
    "guias.clarin.com",
    "guiacomercial.com.ar",
    "nicelocal.com.ar",
    "argentino.com.ar",
    "guia",
    "paginasamarillas"
  ];
  return excluded.some((blocked) => url.toLowerCase().includes(blocked));
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
  });
}

function splitCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === ";" && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell);
  return cells;
}

function stringifyCsv(rows) {
  const headers = Object.keys(rows[0] || {});
  return [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header] || "")).join(";"))
  ].join("\n");
}

function escapeCsv(value) {
  const text = String(value);
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function stripHtml(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeSearch(value) {
  return normalizeSpaces(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeSpaces(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
