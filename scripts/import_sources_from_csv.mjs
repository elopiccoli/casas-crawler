import { readFile, writeFile } from "node:fs/promises";

const inputPath = process.argv[2] || "inmobiliarias_con_web.csv";
const outputPath = process.argv[3] || "outputs/imported_sources.yml";

const text = await readFile(inputPath, "utf8");
const rows = parseCsv(text);
const seen = new Set();
const sources = [];

for (const row of rows) {
  const url = row.sitio_web?.trim();
  if (!url || !/^https?:\/\//i.test(url)) continue;

  const host = new URL(url).hostname.replace(/^www\./, "");
  if (seen.has(host)) continue;
  seen.add(host);

  const name = row.nombre_buscado || cleanName(row.descripcion || host);
  sources.push({ name, url, confidence: row.confianza || "" });
}

const yaml = sources.map((source) => [
  `  - name: ${quote(source.name)}`,
  "    enabled: false",
  `    notes: ${quote(`Importado desde ${inputPath}. Revisar plataforma/selectores antes de activarlo. Confianza: ${source.confidence || "n/a"}.`)}`,
  "    startUrls:",
  `      - ${quote(source.url)}`
].join("\n")).join("\n\n");

await writeFile(outputPath, `${yaml}\n`, "utf8");
console.log(JSON.stringify({ inputPath, outputPath, sources: sources.length, urls: sources }, null, 2));

function parseCsv(value) {
  const lines = value.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
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

function cleanName(value) {
  return String(value).replace(/\s+-\s+.*$/, "").trim();
}

function quote(value) {
  return JSON.stringify(String(value));
}
