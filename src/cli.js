#!/usr/bin/env node
import path from "node:path";
import { loadConfig } from "./config.js";
import { crawlSources } from "./crawler.js";
import { writeListingsWorkbook } from "./excel.js";
import { writeListingsJson } from "./json.js";
import { sleep } from "./utils.js";

const args = parseArgs(process.argv.slice(2));

if (!args.config || !args.output) {
  console.error("Uso: node src/cli.js --config config.yml --output outputs/publicaciones.xlsx [--daily | --interval-minutes 1440]");
  process.exit(1);
}

const configPath = path.resolve(args.config);
const outputPath = path.resolve(args.output);
const intervalMinutes = resolveIntervalMinutes(args);

do {
  await runOnce(configPath, outputPath);

  if (!intervalMinutes) break;
  await sleep(intervalMinutes * 60 * 1000);
} while (true);

async function runOnce(configPath, outputPath) {
  const config = await loadConfig(configPath);
  const operation = process.env.CRAWLER_OPERATION?.trim();
  const propertyType = process.env.CRAWLER_PROPERTY_TYPE?.trim();

  config.filters ||= {};

  if (operation && operation !== "Todos") {
    config.filters.operation = operation;
  } else if (operation === "Todos") {
    delete config.filters.operation;
  }

  if (propertyType && propertyType !== "Todos") {
    config.filters.propertyTypes = [propertyType];
  } else if (propertyType === "Todos") {
    delete config.filters.propertyTypes;
  }


  const listings = await crawlSources(config, {
    logger: (message) => console.log(message)
  });

  await writeListingsWorkbook(listings, outputPath, {
    ...(config.excel || {})
  });
  if (args["json-output"]) {
    await writeListingsJson(listings, path.resolve(args["json-output"]), config);
  }
  console.log(`Exportadas ${listings.length} publicaciones a ${outputPath}`);
  if (args["json-output"]) console.log(`JSON actualizado en ${path.resolve(args["json-output"])}`);
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }

  return parsed;
}

function resolveIntervalMinutes(args) {
  if (args.daily) return 24 * 60;
  if (!args["interval-minutes"]) return null;

  const minutes = Number(args["interval-minutes"]);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error("--interval-minutes debe ser un numero mayor a cero");
  }

  return minutes;
}
