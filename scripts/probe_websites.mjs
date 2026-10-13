import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { TextDecoder } from "node:util";

const inputPath = process.argv[2] || "inmobiliarias_0.csv";
const outputPath = process.argv[3] || "outputs/inmobiliarias_con_web.csv";
const timeoutMs = Number(process.argv.find((arg) => arg.startsWith("--timeout-ms="))?.split("=")[1] || "3000");
const limit = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || "0");

const allRows = parseCsv(await readText(inputPath));
const rows = limit > 0 ? allRows.slice(0, limit) : allRows;
const enriched = [];

for (let index = 0; index < rows.length; index += 1) {
  const row = rows[index];
  const name = cleanName(row.descripcion || "");
  const phone = row["Teléfono 1,"] || row["Tel�fono 1,"] || "";

  console.error(`[${index + 1}/${rows.length}] ${name}`);

  const result = await probeWebsite(name);
  enriched.push({
    ...row,
    nombre_buscado: name,
    telefono_buscado: phone,
    sitio_web: result.website,
    confianza: result.confidence,
    evidencia: result.evidence,
    metodo: result.method
  });

  if ((index + 1) % 25 === 0) await saveCsv(outputPath, enriched);
}

await saveCsv(outputPath, enriched);
console.error(`CSV generado: ${outputPath}`);

async function probeWebsite(name) {
  const results = (await Promise.all(buildCandidates(name).map((candidate) => tryUrl(candidate, name))))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const result = results[0];
  if (result) {
    delete result.score;
    return result;
  }

  return {
    website: "",
    confidence: "sin_resultado",
    evidence: "",
    method: "domain_probe"
  };
}

async function tryUrl(url, name) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36",
        "accept": "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) return null;
    const finalUrl = response.url.replace(/\/$/, "");
    const html = await response.text();
    const title = stripHtml((html.match(/<title[^>]*>(.*?)<\/title>/is) || [])[1] || "");
    const text = normalizeSearch(`${title} ${html.slice(0, 12000)}`);
    const score = scorePage(finalUrl, text, name);

    if (score < 5) return null;

    return {
      website: finalUrl,
      confidence: score >= 8 ? "alta" : "media",
      evidence: title,
      method: "domain_probe",
      score
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildCandidates(name) {
  const tokens = normalizeSearch(name)
    .replace(/\b(inmobiliaria|propiedades|propiedad|bienes|raices|negocios|estudio|consultores|consultora|administracion|servicios|asociados|asoc|cia|y)\b/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);

  const bases = unique([
    tokens.join(""),
    tokens.slice(0, 2).join(""),
    tokens[0],
    `${tokens.join("")}propiedades`,
    `${tokens.join("")}inmobiliaria`,
    `${tokens[0] || ""}propiedades`,
    `${tokens[0] || ""}inmobiliaria`
  ].filter(Boolean));

  const domains = [];
  for (const base of bases) {
    for (const suffix of [".com.ar", ".com", ".net.ar"]) {
      domains.push(`https://www.${base}${suffix}`);
      domains.push(`https://${base}${suffix}`);
    }
  }

  return unique(domains);
}

function scorePage(url, text, name) {
  const host = normalizeSearch(new URL(url).hostname);
  const propertyContext = ["inmobiliaria", "propiedades", "propiedad", "bienes raices", "real estate"]
    .some((term) => text.includes(term));

  if (!propertyContext) return 0;

  const tokens = normalizeSearch(name)
    .split(/\s+/)
    .filter((token) => token.length > 3 && !["inmobiliaria", "propiedades", "negocios", "estudio"].includes(token));

  let score = 0;
  for (const token of tokens) {
    if (host.includes(token)) score += 3;
    if (text.includes(token)) score += 2;
  }

  if (text.includes("mar del plata")) score += 2;
  if (text.includes("argentina") || host.endsWith("com ar")) score += 1;
  if (!text.includes("mar del plata") && !host.endsWith("com ar")) score -= 4;
  if (text.includes("inmobiliaria")) score += 2;
  if (text.includes("propiedades")) score += 2;
  if (text.includes("venta") || text.includes("alquiler")) score += 1;
  if (text.includes("tokkobroker") || text.includes("wasi") || text.includes("houzez")) score += 1;
  if (text.includes("domain for sale") || text.includes("parking")) score -= 8;

  return score;
}

async function readText(path) {
  const buffer = await readFile(path);
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const replacementCount = (utf8.match(/\uFFFD/g) || []).length;
  if (replacementCount < 5) return utf8;
  return new TextDecoder("windows-1252").decode(buffer);
}

function cleanName(value) {
  return normalizeSpaces(value).replace(/\s+-\s+.*$/, "").trim();
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
  return decodeHtml(String(value).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function normalizeSearch(value) {
  return normalizeSpaces(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase();
}

function normalizeSpaces(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values) {
  return [...new Set(values)];
}

async function saveCsv(path, rows) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stringifyCsv(rows), "utf8");
}
