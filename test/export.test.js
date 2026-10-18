import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, unlink, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ExcelJS from "exceljs";
import { finalizeListing } from "../src/listing.js";
import { writeListingsJson } from "../src/json.js";
import { writeListingsWorkbook } from "../src/excel.js";

test("JSON and Excel export the same normalized fields without re-reading page prose", async () => {
  const directory = await mkdtemp(join(tmpdir(), "casas-export-test-"));
  const json = join(directory, "listings.json");
  const excel = join(directory, "listings.xlsx");
  try {
    const listing = finalizeListing("Example", "https://agency.com/casa-venta-los-troncos", {
      address: "Rawson 842", operation: "Venta", neighborhood: "Los Troncos", propertyType: "Casa",
      priceRaw: "US$129,000", areaRaw: "Cubierta: 115.7 m²", roomsRaw: "Ambientes: 4", parkingRaw: "Cochera: 1", summary: "Cerca de Guemes, ideal alquiler", rawText: "Venta Alquiler Playa Grande"
    });
    await writeListingsJson([listing], json);
    await writeListingsWorkbook([listing], excel);
    const item = JSON.parse(await readFile(json, "utf8")).listings[0];
    assert.equal(item.operacion, "Venta");
    assert.equal(item.barrio, "Los Troncos");
    assert.equal(item.precio, 129000);
    assert.equal(item.metros, 115.7);
    assert.equal(item.ambientes, 4);
    assert.equal(item.cochera, "Sí");
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(excel);
    const sheet = book.worksheets[0];
    const headers = sheet.getRow(1).values;
    for (const name of ["operacion", "barrio", "precio", "moneda", "metros", "ambientes", "cochera", "tipo", "direccion"]) {
      assert.equal(sheet.getRow(2).getCell(headers.indexOf(name)).value, item[name]);
    }
  } finally {
    await unlink(json).catch(() => {});
    await unlink(excel).catch(() => {});
    await rmdir(directory);
  }
});
