import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeListingsJson(listings, outputPath) {
  const payload = {
    generatedAt: new Date().toISOString(),
    count: listings.length,
    listings: listings.map((listing) => ({
      inmobiliaria: listing.sourceName,
      direccion: listing.address,
      metros: listing.areaM2,
      precio: listing.priceAmount,
      moneda: listing.currency,
      link: listing.url,
      fechaExtraccion: listing.scrapedAt,
      tipo: listing.propertyType,
      titulo: listing.title,
      resumen: listing.summary
    }))
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
