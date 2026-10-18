import { normalizeField, propertyTypeFor } from "./property-fields.js";

export function neighborhoodOptions(listings) {
  const names = new Map();
  for (const item of listings) {
    const name = String(item.barrio || "").trim();
    if (name && !names.has(normalizeField(name))) names.set(normalizeField(name), name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, "es"));
}

export function matchesNeighborhoods(item, selected) {
  const value = normalizeField(item.barrio) || "unknown";
  return !selected.length || selected.some(name => normalizeField(name) === value);
}

export function matchesParking(item, selected) {
  return !selected || normalizeField(item.cochera || "No informado") === normalizeField(selected);
}

export function matchesPropertyType(item, selected) {
  if (!selected) return true;
  const type = propertyTypeFor(item.tipo || item.titulo || item.link);
  return selected === "Casa" ? ["Casa", "Chalet"].includes(type) : type === selected;
}
