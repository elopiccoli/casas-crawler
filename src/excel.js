import ExcelJS from "exceljs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { inferNeighborhood, inferOperation } from "./utils.js";

export async function writeListingsWorkbook(listings, outputPath, options = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Casas crawler";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(options.sheetName || "Publicaciones", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "operacion", key: "operation", width: 14 },
    { header: "direccion", key: "address", width: 44 },
    { header: "zona", key: "neighborhood", width: 22 },
    { header: "ambientes", key: "roomsCount", width: 12 },
    { header: "metros cuadrados", key: "areaM2", width: 18 },
    { header: "precio", key: "priceAmount", width: 18 },
    { header: "link", key: "url", width: 64 },
    { header: "inmobiliaria", key: "sourceName", width: 28 }
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" }
  };

  for (const listing of listings) {
    const row = sheet.addRow({
      operation: listing.operation || inferOperation(listing),
      address: listing.address,
      neighborhood: inferNeighborhood(listing, options.neighborhoods || []),
      roomsCount: listing.roomsCount,
      areaM2: listing.areaM2,
      priceAmount: listing.priceAmount,
      url: listing.url,
      sourceName: listing.sourceName
    });

    const currency = String(listing.currency || "").replace(/"/g, '""');
    row.getCell("priceAmount").numFmt = currency ? `"${currency}" #,##0` : "#,##0";
  }

  sheet.getColumn("roomsCount").numFmt = "0";
  sheet.getColumn("areaM2").numFmt = "#,##0.0";

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length }
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
}
