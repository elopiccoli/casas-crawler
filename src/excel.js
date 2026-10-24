import ExcelJS from "exceljs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeListingsWorkbook(listings, outputPath, options = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Casas crawler";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(options.sheetName || "Publicaciones", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "inmobiliaria", key: "sourceName", width: 28 },
    { header: "direccion", key: "address", width: 44 },
    { header: "barrio", key: "neighborhood", width: 24 },
    { header: "operacion", key: "operation", width: 20 },
    { header: "tipo", key: "propertyType", width: 18 },
    { header: "ambientes", key: "rooms", width: 12 },
    { header: "cochera", key: "parking", width: 18 },
    { header: "metros", key: "areaM2", width: 12 },
    { header: "metros_totales", key: "totalAreaM2", width: 16 },
    { header: "superficie_tipo", key: "areaKind", width: 18 },
    { header: "precio", key: "priceAmount", width: 16 },
    { header: "moneda", key: "currency", width: 10 },
    { header: "link", key: "url", width: 64 },
    { header: "fecha_extraccion", key: "scrapedAt", width: 22 }
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" }
  };

  for (const listing of listings) {
    sheet.addRow({
      sourceName: listing.sourceName,
      address: listing.address,
      neighborhood: listing.neighborhood || "",
      operation: listing.operation || "",
      propertyType: listing.propertyType || "",
      rooms: listing.rooms ?? null,
      parking: listing.parking || "No informado",
      areaM2: listing.areaM2,
      totalAreaM2: listing.totalAreaM2 ?? null,
      areaKind: listing.areaKind || "",
      priceAmount: listing.priceAmount,
      currency: listing.currency,
      url: listing.url,
      scrapedAt: listing.scrapedAt
    });
  }

  sheet.getColumn("areaM2").numFmt = "#,##0.0";
  sheet.getColumn("totalAreaM2").numFmt = "#,##0.0";
  sheet.getColumn("priceAmount").numFmt = "#,##0";
  sheet.getColumn("scrapedAt").numFmt = "yyyy-mm-dd hh:mm";

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length }
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
}
