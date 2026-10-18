export function normalizeField(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function urlPath(value) {
  try { return decodeURIComponent(new URL(value).pathname).replace(/[-_]/g, " "); }
  catch { return ""; }
}

export function parseOperation(value) {
  const text = normalizeField(value);
  const sale = /\b(venta|vende|comprar|for sale)\b/.test(text);
  const rent = /\b(alquiler|alquila|alquilar|alquileres|for rent)\b/.test(text);
  if (sale && rent) return "Venta / Alquiler";
  if (sale) return "Venta";
  if (rent) return /\b(temporario|temporada|temporal)\b/.test(text) ? "Alquiler temporario" : "Alquiler";
  return "";
}

export function operationFor(listing) {
  return parseOperation(listing.operation || listing.operacion)
    || parseOperation(urlPath(listing.url || listing.link))
    || parseOperation(listing.title || listing.titulo);
}

const neighborhoods = [
  ["Loma de Stella Maris", ["loma de stella maris", "lomas de stella maris", "loma stella maris"]],
  ["Stella Maris", ["stella maris"]],
  ["Los Troncos", ["los troncos"]],
  ["Guemes", ["guemes"]],
  ["Playa Grande", ["playa grande"]],
  ["Divino Rostro", ["divino rostro"]]
];

export function neighborhoodIn(value) {
  const text = normalizeField(value).replace(/[-_]/g, " ");
  // Match longer names first: Lomas de Stella Maris is not Stella Maris.
  const matches = [];
  let remaining = text;
  for (const [name, aliases] of neighborhoods) {
    for (const alias of aliases) {
      const pattern = new RegExp(`\\b${alias}\\b`, "g");
      if (pattern.test(remaining)) {
        matches.push(name);
        remaining = remaining.replace(pattern, " ");
        break;
      }
    }
  }
  return matches.length === 1 ? matches[0] : "";
}

export function neighborhoodFor(listing) {
  const explicit = String(listing.neighborhood || listing.barrio || "").trim();
  if (explicit && explicit.length <= 80 && !/[<>@]/.test(explicit)) {
    if (/[|/;]/.test(explicit)) return "";
    const canonical = neighborhoodIn(explicit);
    if (canonical) return canonical;
    if (neighborhoods.filter(([, aliases]) => aliases.some((a) => normalizeField(explicit).includes(a))).length > 1) return "";
    return explicit.replace(/^(?:barrio|zona|localidad)(?:\s*:\s*|\s+)/i, "");
  }
  for (const value of [listing.address || listing.direccion, urlPath(listing.url || listing.link), listing.title || listing.titulo]) {
    const name = neighborhoodIn(value);
    if (name) return name;
  }
  return "";
}

export function propertyTypeFor(value) {
  const text = normalizeField(value).replace(/^tipo(?: de (?:inmueble|propiedad))?\s*:?\s*/, "");
  const types = [
    ["Departamento", /\b(departamento|departamentos|apartamento|apartment|depto|dto)\b/],
    ["Chalet", /\bchalet\b/], ["Casa", /\b(casa|casas|house)\b/],
    ["PH", /\bph\b/], ["Dúplex", /\bduplex\b/],
    ["Terreno", /\bterrenos?\b/], ["Lote", /\blotes?\b/], ["Local", /\blocal\b/],
    ["Oficina", /\boficina\b/], ["Galpón", /\bgalpon\b/]
  ];
  const matches = types.filter(([, pattern]) => pattern.test(text));
  if (matches.length === 2 && matches.every(([name]) => ["Terreno", "Lote"].includes(name))) return "Lote";
  if (matches.length === 2 && matches.every(([name]) => ["Casa", "Chalet"].includes(name))) return "Chalet";
  return matches.length === 1 ? matches[0][0] : "";
}
