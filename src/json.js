import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { inferNeighborhood, inferOperation } from "./utils.js";

export async function writeListingsJson(listings, outputPath, config = {}) {
  const neighborhoods = config.filters?.neighborhoods || [];
  const payload = {
    generatedAt: new Date().toISOString(),
    count: listings.length,
    listings: listings.map((listing) => {
      const zone = inferNeighborhood(listing, neighborhoods);
      return {
        operacion: listing.operation || inferOperation(listing),
        direccion: listing.address,
        zona: zone,
        barrio: zone,
        ambientes: listing.roomsCount,
        metros_cuadrados: listing.areaM2,
        metros: listing.areaM2,
        precio: listing.priceAmount,
        moneda: listing.currency,
        link: listing.url,
        inmobiliaria: listing.sourceName,
        fechaExtraccion: listing.scrapedAt,
        tipo: listing.propertyType,
        titulo: listing.title,
        resumen: listing.summary
      };
    })
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
