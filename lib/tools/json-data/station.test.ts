import { describe, expect, it } from "vitest";
import { jsonDataTools } from "@/config/json-data-tools";
import { runDataTool } from "./index";
import { parseCsv, stringifyCsv } from "./csv";

const run = (slug: string, input: string, extra: Record<string, string> = {}) => runDataTool(slug, { input, ...extra });
const parsed = async (slug: string, input: string, extra: Record<string, string> = {}) => JSON.parse((await run(slug, input, extra)).text);

describe("CSV corrections", () => {
  it("preserves quoted delimiters, embedded newlines, Unicode and empty fields", () => {
    for (const delimiter of [",", "\t", ";", "|"]) {
      const rows = [["a", "b"], ["a,b\t;|", 'line\n"two"'], ["", "漢字"]];
      expect(parseCsv(stringifyCsv(rows, delimiter), delimiter)).toEqual(rows);
    }
    expect(parseCsv('a,b\n,\n,')).toEqual([["a", "b"], ["", ""], ["", ""]]);
  });
  it.each(['a,b\na"b,c', 'a,b\n"x"tail,c', 'a,b\n"unclosed,c', 'a,b\n1'])('rejects malformed CSV %s', async (input) => {
    expect((await run("csv-validator", input)).invalid).toBe(true);
    await expect(run("csv-to-json", input)).rejects.toThrow(/Row \d+, column \d+/);
  });
  it("preserves nested JSON cells and first-object column order", async () => {
    expect((await run("json-to-csv", "[]")).text).toBe("");
    const output = (await run("json-to-csv", '[{"b":{"x":1},"a":[true,null]},{"a":[],"b":null}]')).text;
    expect(parseCsv(output)).toEqual([["b", "a"], ['{"x":1}', '[true,null]'], ["null", "[]"]]);
    expect(await parsed("csv-to-json", '__proto__,value\nsafe,"a,b"')).toEqual([JSON.parse('{"__proto__":"safe","value":"a,b"}')]);
    await expect(run("json-to-csv", '[{"a":1},{"b":2}]')).rejects.toThrow(/incompatible/);
    await expect(run("csv-to-json", 'a,a\n1,2')).rejects.toThrow(/Duplicate/);
  });
  it("detects quoted delimiters without extra diagnostic output", async () => {
    expect(await parsed("csv-delimiter-detector", 'a;b\n"a,b";2')).toEqual({ delimiter: "semicolon", columnCount: 2 });
    await expect(run("csv-delimiter-detector", 'a,b;c\nx,y;z')).rejects.toThrow(/ambiguous/);
  });
  it("analyzes only the requested column", async () => {
    const analysis = await parsed("csv-column-analyzer", 'name,score\nAda,1\nLin,2.5\nSam,', { column: "score" });
    expect(analysis).toMatchObject({ rowCount: 3, nonempty: 2, empty: 1, unique: 3, predominantType: "decimal", minimum: 1, maximum: 2.5 });
    await expect(run("csv-column-analyzer", 'name\nAda', { column: "missing" })).rejects.toThrow(/Unknown/);
  });
  it("reorders exactly requested columns with exact names and rejects duplicates/missing names", async () => {
    expect((await run("csv-column-reorderer", '"last, first",id\nAda,1', { order: "last, first" })).text).toBe('"last, first"\nAda');
    expect((await run("csv-column-reorderer", 'a,b,c\n1,2,3', { order: "c\na" })).text).toBe('c,a\n3,1');
    await expect(run("csv-column-reorderer", 'a,b\n1,2', { order: "a\na" })).rejects.toThrow(/Duplicate/);
    await expect(run("csv-column-reorderer", 'a,b\n1,2', { order: "c" })).rejects.toThrow(/Unknown/);
  });
  it.each([
    ["Equals", "2", ["2"]], ["Not equals", "2", ["1", "3"]], ["Contains", "2", ["2"]],
    ["Starts with", "2", ["2"]], ["Ends with", "2", ["2"]], ["Greater than", "2", ["3"]],
    ["Greater than or equal", "2", ["2", "3"]], ["Less than", "2", ["1"]], ["Less than or equal", "2", ["1", "2"]],
  ])("supports %s and retains header/order", async (operator, value, expected) => {
    const output = await run("csv-row-filter", 'n\n1\n2\n3', { column: "n", operator: operator as string, value: value as string });
    expect(parseCsv(output.text)).toEqual([["n"], ...(expected as string[]).map(cell => [cell])]);
  });
  it("keeps headers for no-match/no-data, first duplicate, and meaningful whitespace", async () => {
    expect((await run("csv-row-filter", 'n\n1', { column: "n", operator: "Equals", value: "9" })).text).toBe("n");
    expect((await run("csv-data-deduplicator", 'n,v\n1,a\n1,b\n2,c', { keys: "n" })).text).toBe('n,v\n1,a\n2,c');
    expect((await run("csv-data-deduplicator", 'n,v\n1,a\n1,a', { keys: "" })).text).toBe('n,v\n1,a');
    expect((await run("csv-cleaner", 'a,b\n\n  x y  ," z  w "\n,')).text).toBe('a,b\nx y,z  w');
    expect((await run("csv-transposer", 'a,b\n1,2')).text).toBe('a,1\nb,2');
  });
  it("escapes HTML and Markdown without executing user markup", async () => {
    const html = (await run("csv-to-html-table", 'name\n<script>alert(1)</script>')).text;
    expect(html).toContain('<thead>'); expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>');
    expect((await run("csv-to-markdown", 'a\n"x|y *z*"')).text).toContain('x\\|y \\*z\\*');
  });
});

describe("YAML XML TOML contracts", () => {
  it("preserves YAML-compatible JSON types and compares structure", async () => {
    const json = '{"array":[1,"é",false,null,{"x":"001"}]}';
    const yaml = (await run("json-to-yaml", json)).text;
    expect(await parsed("yaml-to-json", yaml)).toEqual(JSON.parse(json));
    expect((await parsed("yaml-diff", 'a: 1\nb: [2, 3]', { secondary: 'b:\n  - 2\n  - 3\na: 1' })).status).toBe("unchanged");
    await expect(run("yaml-to-json", '---\na: 1\n---\nb: 2')).rejects.toThrow();
    await expect(run("yaml-to-json", 'a: &a [*a]')).rejects.toThrow(/cyclic/i);
    expect((await run("yaml-validator", 'a: [')).invalid).toBe(true);
  });
  it("strictly validates XML with useful errors and no external entities", async () => {
    for (const input of ['<a><b></a>', '<a x="1" x="2"/>', '<a>&missing;</a>', '<a/><b/>', '<a x=unquoted/>', '<a>\u0001</a>', '<!DOCTYPE a SYSTEM "https://example.com"><a/>']) {
      expect((await run("xml-validator", input)).invalid).toBe(true);
      await expect(run("xml-to-json", input)).rejects.toThrow();
    }
  });
  it("preserves mixed XML text, attributes, CDATA, comments and significant whitespace", async () => {
    const input = '<root a="&amp;">before <b>bold</b> after<![CDATA[<raw>]]><!-- keep --></root>';
    const output = (await run("xml-formatter", input)).text;
    expect(output).toContain('before <b>bold</b> after'); expect(output).toContain('<![CDATA[<raw>]]>'); expect(output).toContain('<!-- keep -->');
    expect((await run("xml-minifier", ' \n<r xml:space="preserve"> <a/> </r> \n')).text).toBe('<r xml:space="preserve"> <a/> </r>');
    expect((await run("xml-minifier", '<r>\n  <a>one</a>\n  <b/>\n</r>')).text).toBe('<r><a>one</a><b/></r>');
    expect((await run("xml-minifier", '<r><a/> <b/></r>')).text).toBe('<r><a/> <b/></r>');
    expect(await parsed("xml-to-json", '<r a="&amp;"><x n="1">one</x><x>two</x></r>')).toEqual({ r: { "@attributes": { a: "&" }, x: [{ "@attributes": { n: "1" }, "#text": "one" }, "two"] } });
  });
  it("uses fixed root/item XML and rejects invalid names/characters", async () => {
    const xml = (await run("json-to-xml", '[{"name":"<é>"},false]')).text;
    expect(xml).toContain('<root>'); expect(xml).toContain('<item>'); expect(xml).toContain('&lt;é&gt;');
    expect((await run("xml-validator", xml)).invalid).not.toBe(true);
    await expect(run("json-to-xml", '{"bad key":1}')).rejects.toThrow(/name/i);
    await expect(run("json-to-xml", '"\\u0000"')).rejects.toThrow();
  });
  it("supports real TOML nested tables, arrays, quoted hashes, and strict errors", async () => {
    const input = '{"name":"# not comment","nested":{"deeper":{"x":1}},"items":[{"x":1},{"x":2}]}';
    const toml = (await run("json-to-toml", input)).text;
    expect(await parsed("toml-to-json", toml)).toEqual(JSON.parse(input));
    await expect(run("json-to-toml", '{"x":null}')).rejects.toThrow(/null/);
    await expect(run("toml-to-json", 'x = bare text')).rejects.toThrow();
    await expect(run("toml-to-json", 'x = 2026-10-03')).rejects.toThrow(/date|time/);
  });
});

describe("every JSON & Data tool contract", () => {
  it.each(jsonDataTools)("$slug executes its supplied example", async (tool) => {
    const result = await runDataTool(tool.slug, { ...tool.dataContract.examples[0].inputs });
    expect(result.invalid).not.toBe(true);
    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
  });
  it.each(jsonDataTools)("$slug handles empty input explicitly", async (tool) => {
    if (tool.slug === "json-escape") return expect((await run(tool.slug, "")).text).toBe('""');
    const outcome = await runDataTool(tool.slug, { ...tool.dataContract.examples[0].inputs, input: "" }).then(result => ({ invalid: result.invalid, message: result.text }), error => ({ invalid: true, message: String(error) }));
    expect(outcome.invalid).toBe(true);
    expect(outcome.message).toMatch(/empty|JSON value|Invalid|document/i);
  });
  it.each(jsonDataTools)("$slug handles invalid format without stacks or silent repair", async (tool) => {
    if (tool.slug === "json-escape") return; // Every text string is valid raw text.
    const invalid = tool.inputFormat === "YAML" ? "x: [" : tool.inputFormat === "XML" ? "<x>" : tool.inputFormat === "TOML" ? "x = [" : tool.inputFormat === "CSV" || tool.inputFormat === "TSV" || tool.inputFormat === "Tabular text" ? 'a,b\n"unclosed' : "{bad";
    const outcome = await runDataTool(tool.slug, { ...tool.dataContract.examples[0].inputs, input: invalid }).then(result => ({ invalid: result.invalid, message: result.text }), error => ({ invalid: true, message: (error as Error).message }));
    expect(outcome.invalid).toBe(true);
    expect(outcome.message).not.toMatch(/\n\s+at /);
  });
  it.each(jsonDataTools)("$slug accepts Unicode in its format", async (tool) => {
    const inputs = Object.fromEntries(Object.entries(tool.dataContract.examples[0].inputs).map(([key, value]) => [key, value.replaceAll("Ada", "తేజ 🚀 é")]));
    expect((await runDataTool(tool.slug, inputs)).invalid).not.toBe(true);
  });
  it.each(jsonDataTools)("$slug bounds oversized input", async (tool) => {
    await expect(runDataTool(tool.slug, { ...tool.dataContract.examples[0].inputs, input: "x".repeat(1_000_001) })).rejects.toThrow(/1,000,000/);
  });
  it.each(jsonDataTools)("$slug processes a larger valid text value", async (tool) => {
    const inputs = Object.fromEntries(Object.entries(tool.dataContract.examples[0].inputs).map(([key, value]) => [key, value.replaceAll("Ada", "漢".repeat(5000))]));
    expect((await runDataTool(tool.slug, inputs)).invalid).not.toBe(true);
  });
});

describe("JSON semantics", () => {
  it("formats at two spaces, preserves large number lexemes and duplicate syntax without rounding", async () => {
    const input = '{"a":9007199254740993,"b":1e400,"a":-0}';
    expect((await run("json-formatter", input)).text).toBe('{\n  "a": 9007199254740993,\n  "b": 1e400,\n  "a": -0\n}');
    expect((await run("json-minifier", ` \n${input} `)).text).toBe(input);
    expect((await parsed("json-validator", input)).valid).toBe(true);
    await expect(run("json-to-csv", '[{"a":9007199254740993}]')).rejects.toThrow(/precision/);
    await expect(run("json-to-yaml", '{"a":0.12345678901234567890}')).rejects.toThrow(/precision/);
  });
  it("locates invalid JSON and every invalid physical JSONL line", async () => {
    const validation = await parsed("json-validator", '{\n "a": }');
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toMatchObject({ line: 2, column: 7 });
    const lines = await parsed("json-lines-validator", '{}\n\nwrong\n[]\n{');
    expect(lines.errors.map((error: { line: number }) => error.line)).toEqual([3, 5]);
    expect((await run("json-lines-formatter", ' {"a": 1} \n\n[2, 3]')).text).toBe('{"a":1}\n[2,3]');
    expect(await parsed("json-lines-to-json", 'null\nfalse\n"é"')).toEqual([null, false, "é"]);
    expect((await run("json-to-json-lines", '[null,false,"é"]')).text).toBe('null\nfalse\n"é"');
  });
  it("compares structure and gives precise paths, not formatting changes", async () => {
    expect((await parsed("json-diff", '{"b":2,"a":1}', { secondary: '{"a":1,"b":2}' })).status).toBe("unchanged");
    expect((await parsed("json-diff", '{"a.b":[1,2],"x":null}', { secondary: '{"a.b":[3],"z":true}' })).changes).toEqual([
      { path: '$["a.b"][0]', status: "changed", before: 1, after: 3 },
      { path: '$["a.b"][1]', status: "removed", before: 2 },
      { path: '$["x"]', status: "removed", before: null },
      { path: '$["z"]', status: "added", after: true },
    ]);
  });
  it("escapes and unescapes complete literals only", async () => {
    const raw = '"line"\n\\ 🚀';
    const escaped = (await run("json-escape", raw)).text;
    expect(escaped).toBe(JSON.stringify(raw));
    expect((await run("json-unescape", escaped)).text).toBe(raw);
    await expect(run("json-unescape", "{}")).rejects.toThrow(/string literal/);
  });
  it("sorts textual numeric keys recursively without reordering arrays", async () => {
    expect((await run("json-key-sorter", '{"2":0,"10":1,"a":[{"a":1,"z":2},3]}', { direction: "Descending" })).text).toBe('{\n  "a": [\n    {\n      "z": 2,\n      "a": 1\n    },\n    3\n  ],\n  "2": 0,\n  "10": 1\n}');
  });
  it("preserves object insertion order and prevents overwrite/prototype bugs", async () => {
    expect(await parsed("json-object-to-array", '{"2":"first","1":"second"}')).toEqual([{ key: "2", value: "first" }, { key: "1", value: "second" }]);
    expect(await parsed("json-array-to-object", '[{"id":"__proto__","value":1}]', { key: "id" })).toEqual(JSON.parse('{"__proto__":{"id":"__proto__","value":1}}'));
    await expect(run("json-array-to-object", '[{"id":1},{"id":"1"}]', { key: "id" })).rejects.toThrow(/Duplicate/);
    await expect(run("json-array-to-object", '[{}]', { key: "toString" })).rejects.toThrow(/own/);
  });
  it("infers every mixed array item and validates real schema constraints", async () => {
    const sample = '[{"a":1},{"b":null},false,"text"]';
    const schema = (await run("json-schema-generator", sample)).text;
    expect((await parsed("json-schema-validator", sample, { secondary: schema })).valid).toBe(true);
    expect((await parsed("json-schema-validator", '3', { secondary: '{"type":"number","minimum":4}' })).valid).toBe(false);
    expect((await parsed("json-schema-validator", '{"a":1}', { secondary: '{"type":"object","additionalProperties":false}' })).valid).toBe(false);
    await expect(run("json-schema-validator", '{}', { secondary: '{"type":123}' })).rejects.toThrow(/schema|type/i);
    await expect(run("json-schema-validator", '{}', { secondary: '{"$ref":"https://example.com/schema"}' })).rejects.toThrow(/remote|local|reference/i);
  });
  it("evaluates safe JSONPath selectors, filters, recursive descent and zero matches", async () => {
    const value = '{"users":[{"name":"Tej","age":21},{"name":"Alex","age":18}]}';
    expect(await parsed("jsonpath-tester", value, { expression: "$.users[?(@.age >= 21)].name" })).toEqual({ matches: ["Tej"], count: 1 });
    expect(await parsed("jsonpath-tester", value, { expression: "$..name" })).toEqual({ matches: ["Tej", "Alex"], count: 2 });
    expect(await parsed("jsonpath-tester", value, { expression: "$.missing" })).toEqual({ matches: [], count: 0 });
    await expect(run("jsonpath-tester", value, { expression: "$.users[?(globalThis.alert(1))]" })).rejects.toThrow();
  });
  it("reports structure without values and all nine statistics", async () => {
    const input = '{"private":"SECRET","list":[true,null,1]}';
    const structure = (await run("json-structure-inspector", input)).text;
    expect(structure).not.toContain("SECRET");
    expect(structure).toContain("string");
    expect(await parsed("json-statistics-analyzer", input)).toEqual({ objects: 1, arrays: 1, keys: 2, strings: 1, numbers: 1, booleans: 1, nulls: 1, nodes: 6, maxDepth: 2 });
  });
  it("processes a reasonable large document", async () => {
    const input = JSON.stringify(Array.from({ length: 5000 }, (_, id) => ({ id, value: "漢字" })));
    expect(JSON.parse((await run("json-minifier", input)).text)).toHaveLength(5000);
    expect((await parsed("json-statistics-analyzer", input)).nodes).toBe(15001);
  });
});
