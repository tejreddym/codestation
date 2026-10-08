import { File } from "node:buffer";
import ExcelJS from "exceljs";
import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { LIMITS, validateXlsx } from "./archive";
import { inspectSpreadsheet, runSpreadsheet } from "./engine";
import type { SpreadsheetResult, SpreadsheetValues } from "./types";

const run = (id: string, values: SpreadsheetValues) => runSpreadsheet(id, values);

async function workbook(rows: ExcelJS.CellValue[][] = [["Name", "Number", "Flag", "Date", "Formula"], ["雪 😀", -12, true, new Date("2024-02-29T12:34:00Z"), { formula: "B2*2", result: -24 }], ["second", 5, false, null, { formula: "B3*2", result: 10 }]], extra = true): Promise<globalThis.File> {
  const book = new ExcelJS.Workbook(), sheet = book.addWorksheet("Data");
  for (const row of rows) sheet.addRow(row);
  sheet.getCell("A2").font = { bold: true, color: { argb: "FF112233" } };
  sheet.getColumn(1).width = 22; sheet.getRow(2).height = 30;
  if (extra) { book.addWorksheet("Other").addRows([["X"], ["Y"]]); book.addWorksheet("Empty"); }
  return new File([new Uint8Array(await book.xlsx.writeBuffer())], "fixture.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) as unknown as globalThis.File;
}

async function read(result: SpreadsheetResult, index = 0): Promise<ExcelJS.Workbook> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(new Uint8Array(await result.files![index].blob.arrayBuffer()) as unknown as ExcelJS.Buffer);
  return book;
}
function values(file: globalThis.File, additions: SpreadsheetValues = {}): SpreadsheetValues { return { file, sheet: "Data", ...additions }; }

describe("real XLSX contracts", () => {
  it("inspects Unicode, typed/date/formula, multisheet and empty workbook bytes", async () => {
    const file = await workbook(), info = await inspectSpreadsheet(file);
    expect(info.sheetNames).toEqual(["Data", "Other", "Empty"]);
    expect(info.sheets[0]).toMatchObject({ headers: ["Name", "Number", "Flag", "Date", "Formula"], rowCount: 2, columnCount: 5, formulaCount: 2 });
    expect(info.sheets[2]).toMatchObject({ rowCount: 0, columnCount: 0, formulaCount: 0 });
  });

  it("csv-to-excel parses quoted delimiters/newlines literally and roundtrips bytes", async () => {
    const result = await run("csv-to-excel", { source: 'Name,Text\n雪,"a,b"\n😀,"quote ""here""\nline"', sheetName: "Imported" });
    expect(result.data).toEqual({ rowCount: 2, columnCount: 2 });
    const sheet = (await read(result)).worksheets[0];
    expect(sheet.name).toBe("Imported");
    expect(sheet.getCell("B3").value).toBe('quote "here"\nline');
    expect(sheet.getCell("A2").value).toBe("雪");
  });

  it("CSV/TSV UTF-8 file alternative rejects malformed bytes and oversized files", async () => {
    const textFile = new File(["\uFEFFH,V\n雪,1"], "data.csv");
    const result = await run("csv-to-excel", { textFile, source: "ignored", sheetName: "File" });
    expect((await read(result)).worksheets[0].getCell("A2").value).toBe("雪");
    await expect(run("csv-to-excel", { textFile: new File([new Uint8Array([0xff])], "bad.csv"), sheetName: "File" })).rejects.toThrow("UTF-8");
    await expect(run("csv-to-excel", { textFile: new File([new Uint8Array(LIMITS.fileBytes + 1)], "big.csv") })).rejects.toThrow("16 MiB");
  });

  it("excel-to-csv uses cached formulas, dates, booleans and leaves native negative numbers unchanged", async () => {
    const result = await run("excel-to-csv", values(await workbook()));
    expect(result.data).toEqual({ rowCount: 2, columnCount: 5 });
    expect(result.text).toContain("雪 😀,-12,true,2024-02-29T12:34:00.000Z,-24");
    expect(result.text).not.toContain("B2*2");
    expect(await result.files![0].blob.text()).toBe(result.text);
    expect(result.warnings?.join(" ")).toContain("cached");
  });

  it("json-to-excel preserves scalars, union headers, nested JSON strings and prototype-looking keys", async () => {
    const result = await run("json-to-excel", { source: '[{"__proto__":"雪","n":2,"b":true,"nested":{"x":[1]}},{"n":null,"extra":"=literal"}]', sheetName: "JSON" });
    const sheet = (await read(result)).worksheets[0];
    expect(result.data).toEqual({ rowCount: 2, columnCount: 5 });
    expect(sheet.getCell("B2").value).toBe(2);
    expect(sheet.getCell("C2").value).toBe(true);
    expect(sheet.getCell("D2").value).toBe('{"x":[1]}');
    expect(sheet.getCell("E3").value).toBe("=literal");
    expect(sheet.getCell("E3").type).toBe(3);
  });

  it("excel-to-json creates deterministic duplicate/blank/colliding headers and formatted typed values", async () => {
    const file = await workbook([["A", "A", "A_2", "", "__proto__"], ["雪", 2, true, { formula: "1+2", result: 3 }, "ok"]], false);
    const result = await run("excel-to-json", values(file));
    expect(JSON.parse(result.text!)).toEqual([{ A: "雪", A_2: 2, A_2_2: true, "Column 4": 3, ["__proto__"]: "ok" }]);
    expect(result.text).toContain("\n  {");
    expect(result.data).toEqual({ rowCount: 1, columnCount: 5 });
  });

  it("tsv-to-excel and excel-to-tsv handle tabs/newlines/quotes with only contracted output", async () => {
    const result = await run("tsv-to-excel", { source: 'A\tB\n雪\t"tab\there\nnew"', sheetName: "TSV" });
    expect(result.data).toEqual({});
    const output = result.files![0];
    const file = new File([new Uint8Array(await output.blob.arrayBuffer())], output.name) as unknown as globalThis.File;
    const inverse = await run("excel-to-tsv", { file, sheet: "TSV" });
    expect(inverse.data).toEqual({}); expect(inverse.text).toBe('A\tB\n雪\t"tab\there\nnew"');
    expect(inverse.files![0].name).toMatch(/\.tsv$/);
  });

  it("xlsx-to-html emits escaped inert cells with no active markup/hyperlinks", async () => {
    const file = await workbook([["<script>"], [{ text: '<img src=x onerror="x">', hyperlink: "javascript:alert(1)" }]], false);
    const result = await run("xlsx-to-html", values(file));
    expect(result.text).toContain("&lt;script&gt;");
    expect(result.text).toContain("&lt;img src=x onerror=&quot;x&quot;&gt;");
    expect(result.text).not.toContain("javascript:"); expect(result.text).not.toContain("<script>");
    expect(result.data).toEqual({ rowCount: 1, columnCount: 1 });
  });

  it("spreadsheet-viewer selects actual sheets and reports full counts/empty sheets", async () => {
    const file = await workbook();
    const result = await run("spreadsheet-viewer", values(file, { sheet: "Other" }));
    expect(result.preview).toEqual({ sheetNames: ["Data", "Other", "Empty"], name: "Other", rows: [["X"], ["Y"]] });
    expect(result.data).toEqual({ rowCount: 1, columnCount: 1, selectedSheet: "Other" });
    expect((await run("spreadsheet-viewer", values(file, { sheet: "Empty" }))).preview?.rows).toEqual([]);
  });

  it("sheet-extractor retains cell styles/date/formula/cache and sizing in real output", async () => {
    const result = await run("sheet-extractor", values(await workbook()));
    const book = await read(result), sheet = book.worksheets[0];
    expect(book.worksheets).toHaveLength(1);
    expect(sheet.getCell("A2").font.bold).toBe(true); expect(sheet.getColumn(1).width).toBe(22);
    expect(sheet.getRow(2).height).toBe(30);
    expect(sheet.getCell("D2").value).toEqual(new Date("2024-02-29T12:34:00Z"));
    expect(sheet.getCell("E2").value).toEqual({ formula: "B2*2", result: -24 });
    expect(result.warnings?.join(" ")).toContain("not retained");
  });

  it("workbook-inspector reports actual file and every-sheet dimensions/formulas", async () => {
    const file = await workbook(), result = await run("workbook-inspector", { file });
    expect(result.data).toEqual({ fileName: "fixture.xlsx", fileSize: file.size, sheetCount: 3, sheetNames: ["Data", "Other", "Empty"], perSheetDimensions: [{ name: "Data", rowCount: 3, columnCount: 5 }, { name: "Other", rowCount: 2, columnCount: 1 }, { name: "Empty", rowCount: 0, columnCount: 0 }], formulaCount: 2 });
  });

  it("spreadsheet-transposer transposes values/styles/formulas and explicitly warns unchanged references", async () => {
    const result = await run("spreadsheet-transposer", values(await workbook()));
    const sheet = (await read(result)).worksheets[0];
    expect(result.data).toEqual({ originalDimensions: { rows: 3, columns: 5 }, newDimensions: { rows: 5, columns: 3 } });
    expect(sheet.getCell("B1").value).toBe("雪 😀"); expect(sheet.getCell("B1").font.bold).toBe(true);
    expect(sheet.getCell("B5").value).toEqual({ formula: "B2*2", result: -24 });
    expect(result.warnings?.join(" ")).toContain("not rewritten");
  });

  it("spreadsheet-column-reorderer requires a complete permutation and retains formulas", async () => {
    const file = await workbook(), result = await run("spreadsheet-column-reorderer", values(file, { order: ["4", "3", "2", "1", "0"] }));
    const sheet = (await read(result)).worksheets[0];
    expect(sheet.getCell("A1").value).toBe("Formula"); expect(sheet.getCell("E2").value).toBe("雪 😀");
    expect(sheet.getCell("A2").value).toEqual({ formula: "B2*2", result: -24 });
    for (const order of [["0", "1"], ["0", "0", "2", "3", "4"], ["0", "1", "2", "3", "5"], [0, 1, 2, 3, 4]]) await expect(run("spreadsheet-column-reorderer", values(file, { order }))).rejects.toThrow("column");
  });

  it.each([
    ["Equals", "beta", 1], ["Not equals", "beta", 3], ["Contains", "alp", 2], ["Starts with", "alp", 2], ["Ends with", "ha", 1],
    ["Greater than", "2", 2], ["Greater than or equal", "2", 3], ["Less than", "2", 1], ["Less than or equal", "2", 2],
  ])("spreadsheet-row-filter %s uses the exact operator", async (operator, value, matched) => {
    const numeric = operator.includes("than");
    const file = await workbook([["Name", "N"], ["alpha", 1], ["beta", 2], ["alpine", 3], ["", 4]], false);
    const result = await run("spreadsheet-row-filter", values(file, { column: numeric ? "1" : "0", operator, value }));
    expect(result.data).toEqual({ matched, excluded: 4 - Number(matched) });
    const sheet = (await read(result)).worksheets[0]; expect(sheet.rowCount).toBe(Number(matched) + 1);
    expect(sheet.getCell("A1").value).toBe("Name");
  });

  it("numeric filtering excludes nonnumeric/blank values rather than coercing them", async () => {
    const file = await workbook([["N"], [""], ["abc"], [true], [2], ["3"]], false);
    expect((await run("spreadsheet-row-filter", values(file, { column: "0", operator: "Greater than", value: "1" }))).data).toEqual({ matched: 2, excluded: 3 });
    await expect(run("spreadsheet-row-filter", values(file, { column: "0", operator: "Greater than", value: "" }))).rejects.toThrow("finite");
    await expect(run("spreadsheet-row-filter", values(file, { column: "0", operator: "unknown", value: "1" }))).rejects.toThrow("operator");
  });

  it("spreadsheet-deduplicator retains first occurrences with typed cached key values", async () => {
    const file = await workbook([["Key", "Value"], [1, "first"], [1, "second"], ["1", "text"], [{ formula: "1", result: 1 }, "formula"]], false);
    const result = await run("spreadsheet-deduplicator", values(file, { keys: ["0"] }));
    expect(result.data).toEqual({ original: 4, removed: 2, final: 2 });
    const sheet = (await read(result)).worksheets[0]; expect(sheet.getCell("B2").value).toBe("first"); expect(sheet.getCell("B3").value).toBe("text");
    await expect(run("spreadsheet-deduplicator", values(file, { keys: ["0", "0"] }))).rejects.toThrow("repeat");
  });

  it("spreadsheet-column-analyzer emits numeric statistics only for numeric nonempty data", async () => {
    const file = await workbook([["N", "Text"], [1, "a"], [3, "b"], [null, ""], ["5", "a"], [{ formula: "7", result: 7 }, "c"]], false);
    expect((await run("spreadsheet-column-analyzer", values(file, { column: "0" }))).data).toEqual({ rows: 5, empty: 1, nonempty: 4, unique: 5, detectedType: "numeric", min: 1, max: 7, avg: 4 });
    expect((await run("spreadsheet-column-analyzer", values(file, { column: "1" }))).data).toEqual({ rows: 5, empty: 1, nonempty: 4, unique: 4, detectedType: "text" });
  });

  it("empty row/column cleaners remove empty axes, retain formulas and whitespace", async () => {
    const file = await workbook([["A", null, "C"], [null, null, null], [" ", null, { formula: '""', result: "" }], ["end", null, "v"]], false);
    const rows = await run("spreadsheet-empty-row-cleaner", values(file));
    expect(rows.data).toEqual({ removed: 1 }); expect((await read(rows)).worksheets[0].getCell("A3").value).toBe("end");
    const cols = await run("spreadsheet-empty-column-cleaner", values(file));
    expect(cols.data).toEqual({ removed: 1 }); expect((await read(cols)).worksheets[0].getCell("B1").value).toBe("C");
  });

  it("workbook-merger keeps all sheets with deterministic collision-safe names", async () => {
    const file = await workbook(), second = await workbook([["h"], ["second"]]);
    const result = await run("workbook-merger", { files: [file, second] });
    const book = await read(result);
    expect(book.worksheets.map(sheet => sheet.name)).toEqual(["Data", "Other", "Empty", "Data_2", "Other_2", "Empty_2"]);
    expect(book.getWorksheet("Data_2")!.getCell("A2").value).toBe("second");
    expect(book.getWorksheet("Data")!.getCell("E2").formula).toBe("B2*2");
  });

  it("workbook-splitter creates genuine XLSX per sheet including empty and file list", async () => {
    const result = await run("workbook-splitter", { file: await workbook() });
    expect(result.data.fileList).toEqual(["Data.xlsx", "Other.xlsx", "Empty.xlsx"]);
    expect(result.files).toHaveLength(3);
    for (let i = 0; i < 3; i++) expect((await read(result, i)).worksheets).toHaveLength(1);
    expect((await read(result, 2)).worksheets[0].rowCount).toBe(0);
  });

  it("spreadsheet-split-by-column keeps headers and typed groups, sanitizes collision-safe names", async () => {
    const file = await workbook([["Group", "N"], ["a/b", 1], ["a\\b", 2], ["a/b", 3], [null, 4], ["CON", 5], ["雪", 6], [1, 7], ["1", 8]], false);
    const result = await run("spreadsheet-split-by-column", values(file, { column: "0" }));
    expect(result.data.groupCount).toBe(7);
    expect(result.files!.map(output => output.name)).toEqual(["a_b.xlsx", "a_b_2.xlsx", "empty.xlsx", "_CON.xlsx", "雪.xlsx", "1.xlsx", "1_2.xlsx"]);
    const first = (await read(result)).worksheets[0]; expect(first.rowCount).toBe(3); expect(first.getCell("B3").value).toBe(3);
  });
});

describe("privacy, formula safety and boundaries", () => {
  it.each(["=1+1", "+SUM(A1)", "-string", "@cmd", " \t=cmd", "\n+cmd"])("text exports sanitize string prefix %j but never native negatives", async attack => {
    const file = await workbook([["V", "Native"], [attack, -5]], false);
    const csv = await run("excel-to-csv", values(file));
    expect(csv.text).toContain(`'${attack}`); expect(csv.text).toContain(",-5");
    const json = await run("excel-to-json", values(file)); expect(JSON.parse(json.text!)[0]).toEqual({ V: `'${attack}`, Native: -5 });
    const tsv = await run("excel-to-tsv", values(file)); expect(tsv.text).toContain(`'${attack}`);
    const html = await run("xlsx-to-html", values(file)); expect(html.text).toContain(`&#39;${attack}`); expect(html.text).toContain("<td>-5</td>");
    expect(csv.warnings?.join(" ")).toContain("apostrophe");
  });

  it("missing formula caches are empty/null and formulas remain present structurally", async () => {
    const file = await workbook([["A"], [{ formula: "1+2" }]], false);
    expect(JSON.parse((await run("excel-to-json", values(file))).text!)).toEqual([{ A: null }]);
    const extracted = await run("sheet-extractor", values(file));
    expect((await read(extracted)).worksheets[0].getCell("A2").formula).toBe("1+2");
  });

  it("retains shared formulas as explicit equivalent expressions and zero/boolean/error caches", async () => {
    const book = new ExcelJS.Workbook(), sheet = book.addWorksheet("Data");
    sheet.addRows([["N", "F"], [1], [2]]);
    sheet.getCell("B2").value = { formula: "A2*2", shareType: "shared", ref: "B2:B3", result: 0 } as ExcelJS.CellFormulaValue;
    sheet.getCell("B3").value = { sharedFormula: "B2", result: 4 };
    sheet.getCell("C2").value = { formula: "FALSE()", result: false };
    sheet.getCell("D2").value = { formula: "1/0", result: { error: "#DIV/0!" } };
    const file = new File([new Uint8Array(await book.xlsx.writeBuffer())], "shared.xlsx") as unknown as globalThis.File;
    const result = await run("sheet-extractor", values(file)), output = (await read(result)).worksheets[0];
    expect(output.getCell("B2").formula).toBe("A2*2"); expect(output.getCell("B2").result).toBe(0);
    expect(output.getCell("B3").value).toEqual({ formula: "A3*2", result: 4 });
    expect(output.getCell("C2").result).toBe(false); expect(output.getCell("D2").result).toEqual({ error: "#DIV/0!" });
    const csv = await run("excel-to-csv", values(file)); expect(csv.text).toContain("1,0,false,#DIV/0!");
    expect(JSON.parse((await run("excel-to-json", values(file))).text!)[0]).toMatchObject({ F: 0, "Column 3": false });
  });

  it("numeric averages avoid intermediate overflow", async () => {
    const file = await workbook([["N"], [1e308], [-1e308]], false);
    expect((await run("spreadsheet-column-analyzer", values(file, { column: "0" }))).data).toMatchObject({ min: -1e308, max: 1e308, avg: 0 });
  });

  it("JSON header injection is prefixed without collapsing case-distinct headers", async () => {
    const file = await workbook([["=H", "A", "a"], ["x", "y", "z"]], false);
    expect(JSON.parse((await run("excel-to-json", values(file))).text!)).toEqual([{ "'=H": "x", A: "y", a: "z" }]);
  });

  it("external hyperlinks and HYPERLINK formulas are flattened in serialized workbooks", async () => {
    const file = await workbook([["L", "F"], [{ text: "display", hyperlink: "javascript:alert(1)" }, { formula: 'HYPERLINK("https://evil.test","cached")', result: "cached" }]], false);
    const result = await run("sheet-extractor", values(file)), sheet = (await read(result)).worksheets[0];
    expect(sheet.getCell("A2").value).toBe("display"); expect(sheet.getCell("B2").value).toBe("cached");
    const archive = unzipSync(new Uint8Array(await result.files![0].blob.arrayBuffer()));
    expect(Object.keys(archive).some(name => /worksheets.*\.rels/.test(name))).toBe(false);
    expect(result.warnings?.join(" ")).toContain("HYPERLINK");
  });

  it("aborted/stale engine operations never resolve a result", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(runSpreadsheet("csv-to-excel", { source: "A\nB" }, controller.signal)).rejects.toThrow("cancelled");
    await expect(inspectSpreadsheet(await workbook(), controller.signal)).rejects.toThrow("cancelled");
  });

  it.each(["", "bad/name", "bad:name", "x".repeat(32), "'edge", "History"])("invalid sheet name %j is rejected", async sheetName => {
    await expect(run("csv-to-excel", { source: "A\nB", sheetName })).rejects.toThrow("Sheet names");
  });

  it.each(["{", "{}", "[1]", "[null]", "[[]]", '[{"n":1e999}]'])("malformed/nonobject/nonfinite JSON %j is rejected", async source => {
    await expect(run("json-to-excel", { source })).rejects.toThrow();
  });

  it("rejects ragged/malformed CSV, overlong strings/cells and invalid selections", async () => {
    for (const source of ['A,B\n"bad', "A,B\n1", ""]) await expect(run("csv-to-excel", { source })).rejects.toThrow();
    await expect(run("csv-to-excel", { source: "x".repeat(LIMITS.textCharacters + 1) })).rejects.toThrow("2,000,000");
    await expect(run("csv-to-excel", { source: `H\n${"x".repeat(LIMITS.cellCharacters + 1)}` })).rejects.toThrow("32,767");
    await expect(run("csv-to-excel", { source: new Array(514).join("h,") })).rejects.toThrow("columns");
    await expect(run("spreadsheet-viewer", values(await workbook(), { sheet: "missing" }))).rejects.toThrow("worksheet");
    await expect(run("spreadsheet-column-analyzer", values(await workbook(), { column: "-1" }))).rejects.toThrow("zero-based");
    await expect(run("not-a-tool", {})).rejects.toThrow("Unknown");
  });

  it("empty JSON creates a valid empty workbook", async () => {
    const result = await run("json-to-excel", { source: "[]", sheetName: "Empty" });
    expect(result.data).toEqual({ rowCount: 0, columnCount: 0 });
    expect((await read(result)).worksheets[0].rowCount).toBe(0);
  });

  it("null-only JSON records remain real rows rather than disappearing from XLSX", async () => {
    const result = await run("json-to-excel", { source: '[{"A":null},{"A":null}]', sheetName: "Data" });
    const output = result.files![0], file = new File([new Uint8Array(await output.blob.arrayBuffer())], output.name) as unknown as globalThis.File;
    expect((await read(result)).worksheets[0].rowCount).toBe(3);
    expect(JSON.parse((await run("excel-to-json", values(file))).text!)).toEqual([{ A: null }, { A: null }]);
    await expect(run("json-to-excel", { source: "[{}]" })).rejects.toThrow("object key");
  });

  it("rejects legacy/nonzip/empty/oversized inputs", async () => {
    for (const bytes of [new Uint8Array(), strToU8("not excel"), new Uint8Array(LIMITS.fileBytes + 1)]) await expect(inspectSpreadsheet(new File([bytes], "bad.xlsx") as unknown as globalThis.File)).rejects.toThrow();
  });

  it("preflights huge sparse ranges before ExcelJS and rejects unbounded transposes", async () => {
    const book = new ExcelJS.Workbook(); book.addWorksheet("Data").getCell("XFD1048576").value = "sparse";
    const file = new File([new Uint8Array(await book.xlsx.writeBuffer())], "sparse.xlsx") as unknown as globalThis.File;
    await expect(inspectSpreadsheet(file)).rejects.toThrow("ranges");
    const narrow = await workbook([["H"], ...Array.from({ length: 513 }, () => ["v"])], false);
    await expect(run("spreadsheet-transposer", values(narrow))).rejects.toThrow("ranges");
  });

  it("rejects excessive split groups without partial files", async () => {
    const file = await workbook([["H"], ...Array.from({ length: 65 }, (_, i) => [i])], false);
    await expect(run("spreadsheet-split-by-column", values(file, { column: "0" }))).rejects.toThrow("64 groups");
  });

  it("rejects macro/external/embedded-object archive entries", async () => {
    const raw = unzipSync(new Uint8Array(await (await workbook()).arrayBuffer()));
    for (const name of ["xl/vbaProject.bin", "xl/externalLinks/externalLink1.xml", "xl/embeddings/object.bin", "xl/activeX/activeX1.xml"]) {
      const bytes = zipSync({ ...raw, [name]: strToU8("unsupported") });
      expect(() => validateXlsx(bytes)).toThrow("unsupported");
    }
  });

  it("rejects XML entities, nesting, malformed content and external-link relationships", async () => {
    const raw = unzipSync(new Uint8Array(await (await workbook()).arrayBuffer()));
    const attacks = [
      '<!DOCTYPE x [<!ENTITY a "boom">]><x>&a;</x>',
      "<x>".repeat(129) + "</x>".repeat(129),
      "<x><broken></x>",
      '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink" Target="file.xlsx"/></Relationships>',
    ];
    for (const attack of attacks) expect(() => validateXlsx(zipSync({ ...raw, "attack.xml": strToU8(attack) }))).toThrow();
  });

  it("rejects ZIP path traversal, case duplicate names and entry-count bombs", async () => {
    const raw = unzipSync(new Uint8Array(await (await workbook()).arrayBuffer()));
    const extras: Record<string, Uint8Array>[] = [{ "../escape.xml": strToU8("<x/>") }, { "XL/WORKBOOK.XML": raw["xl/workbook.xml"] }];
    for (const extra of extras) expect(() => validateXlsx(zipSync({ ...raw, ...extra }))).toThrow();
    const tooMany = Object.fromEntries(Array.from({ length: 1025 }, (_, i) => [`junk/${i}`, new Uint8Array()]));
    expect(() => validateXlsx(zipSync({ ...raw, ...tooMany }))).toThrow("1,024");
  });

  it("aggregate sparse worksheet areas are rejected before ExcelJS", async () => {
    const raw = unzipSync(new Uint8Array(await (await workbook()).arrayBuffer()));
    const xml = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:Z10000"/><sheetData/></worksheet>';
    expect(() => validateXlsx(zipSync({ ...raw, "xl/worksheets/sheet1.xml": strToU8(xml) }))).toThrow("ranges");
    const within = xml.replace("Z10000", "M10000");
    expect(() => validateXlsx(zipSync({ ...raw, "xl/worksheets/sheet1.xml": strToU8(within), "xl/worksheets/sheet2.xml": strToU8(within) }))).toThrow("Combined");
  });

  it("rejects malformed CRC, encrypted flags, unsupported compression and declared zip bombs", async () => {
    const raw = new Uint8Array(await (await workbook()).arrayBuffer());
    const firstCentral = (bytes: Uint8Array) => {
      const view = new DataView(bytes.buffer); for (let i = 0; i < bytes.length - 46; i++) if (view.getUint32(i, true) === 0x02014b50) return i;
      throw new Error("missing central");
    };
    for (const kind of ["crc", "encrypted", "method", "size"] as const) {
      const bytes = raw.slice(), view = new DataView(bytes.buffer), central = firstCentral(bytes);
      const local = view.getUint32(central + 42, true);
      if (kind === "crc") { view.setUint32(central + 16, 0, true); view.setUint32(local + 14, 0, true); }
      if (kind === "encrypted") view.setUint16(central + 8, view.getUint16(central + 8, true) | 1, true);
      if (kind === "method") view.setUint16(central + 10, 12, true);
      if (kind === "size") view.setUint32(central + 24, LIMITS.entryBytes + 1, true);
      expect(() => validateXlsx(bytes)).toThrow();
    }
    const corrupt = raw.slice(); corrupt[100] ^= 0xff; expect(() => validateXlsx(corrupt)).toThrow();
  });

  it("rejects actual decompressed content larger than declared without whole-entry allocation", async () => {
    const raw = unzipSync(new Uint8Array(await (await workbook()).arrayBuffer()));
    const bytes = zipSync({ ...raw, "bomb.txt": strToU8("A".repeat(2_000_000)) }), view = new DataView(bytes.buffer);
    for (let p = 0; p < bytes.length - 46; p++) {
      if (view.getUint32(p, true) !== 0x02014b50) continue;
      const nameLength = view.getUint16(p + 28, true);
      if (new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLength)) !== "bomb.txt") continue;
      view.setUint32(p + 24, 1, true);
      view.setUint32(view.getUint32(p + 42, true) + 22, 1, true);
    }
    expect(() => validateXlsx(bytes)).toThrow("Actual decompressed");
  });
});
