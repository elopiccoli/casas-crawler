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
    { header: "metros", key: "areaM2", width: 12 },
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
      areaM2: listing.areaM2,
      priceAmount: listing.priceAmount,
      currency: listing.currency,
      url: listing.url,
      scrapedAt: listing.scrapedAt
    });
  }

  sheet.getColumn("areaM2").numFmt = "#,##0.0";
  sheet.getColumn("priceAmount").numFmt = "#,##0";
  sheet.getColumn("scrapedAt").numFmt = "yyyy-mm-dd hh:mm";

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length }
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
}
