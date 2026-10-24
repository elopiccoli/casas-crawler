import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { neighborhoodFor, operationFor } from "../web/property-fields.js";

export async function writeListingsJson(listings, outputPath, config = {}) {
  const payload = {
    generatedAt: new Date().toISOString(),
    count: listings.length,
    quality: {
      needingReview: listings.filter((listing) => listing.issues?.length).length,
      byAgency: (config.sources || []).map((source) => ({
        name: source.name,
        listings: listings.filter((listing) => listing.sourceName === source.name).length,
        needingReview: listings.filter((listing) => listing.sourceName === source.name && listing.issues?.length).length
      }))
    },
    listings: listings.map((listing) => ({
      inmobiliaria: listing.sourceName,
      direccion: listing.address,
      barrio: neighborhoodFor(listing),
      metros: listing.areaM2,
      metrosTotales: listing.totalAreaM2 ?? null,
      ambientes: listing.rooms ?? null,
      cochera: listing.parking || "No informado",
      superficieTipo: listing.areaKind || "",
      precio: listing.priceAmount,
      moneda: listing.currency,
      link: listing.url,
      fechaExtraccion: listing.scrapedAt,
      operacion: operationFor(listing),
      tipo: listing.propertyType,
      titulo: listing.title,
      resumen: listing.summary,
      revision: listing.issues || [],
      evidencia: listing.evidence || {}
    }))
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
