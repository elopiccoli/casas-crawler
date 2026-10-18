import { readFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

export async function loadConfig(filename) {
  const config = yaml.load(await readFile(filename, "utf8"));
  const extraPath = path.join(path.dirname(filename), "config.extra.yml");
  const text = await readFile(extraPath, "utf8").catch(error => {
    if (error.code === "ENOENT") return "sources: []";
    throw error;
  });
  const extra = yaml.load(text) || {};
  for (const source of extra.sources || []) {
    const existing = config.sources.find(item => item.name === source.name);
    if (!existing) config.sources.push(source);
    else for (const key of ["startUrls", "detailUrls"]) {
      existing[key] = [...new Set([...(existing[key] || []), ...(source[key] || [])])];
    }
  }
  return config;
}
