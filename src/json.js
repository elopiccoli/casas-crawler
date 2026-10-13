import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeListingsJson(listings, outputPath, config = {}) {
  const neighborhoods = config.filters?.neighborhoods || [];
  const payload = {
    generatedAt: new Date().toISOString(),
    count: listings.length,
    listings: listings.map((listing) => ({
      inmobiliaria: listing.sourceName,
      direccion: listing.address,
      barrio: inferNeighborhood(listing, neighborhoods),
      metros: listing.areaM2,
      precio: listing.priceAmount,
      moneda: listing.currency,
      link: listing.url,
      fechaExtraccion: listing.scrapedAt,
      operacion: inferOperation(listing),
      tipo: listing.propertyType,
      titulo: listing.title,
      resumen: listing.summary
    }))
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function inferNeighborhood(listing, neighborhoods) {
  const text = normalizeForMatch([
    listing.address,
    listing.title,
    listing.summary,
    listing.searchText,
    listing.url
  ].join(" "));

  return neighborhoods.find((neighborhood) => text.includes(normalizeForMatch(neighborhood))) || "";
}

function inferOperation(listing) {
  const text = normalizeForMatch([
    listing.operation,
    listing.title,
    listing.summary,
    listing.searchText,
    listing.url
  ].join(" "));

  if (text.includes("alquiler")) return "Alquiler";
  if (text.includes("venta") || text.includes("comprar")) return "Venta";
  return "";
}

function normalizeForMatch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
