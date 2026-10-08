/** Browser-independent JSON & Data metadata, shared by the route and station UI. */
export type DataFieldName = "input" | "secondary" | "expression" | "direction" | "key" | "column" | "order" | "operator" | "value" | "keys";
export type DataInputField = {
  name: DataFieldName;
  label: string;
  control: "textarea" | "text" | "select";
  placeholder?: string;
  hint?: string;
  required?: boolean;
  defaultValue?: string;
  options?: readonly { value: string; label: string }[];
};
export type DataToolContract = {
  fields: readonly DataInputField[];
  action: string;
  output: { label: string; format: string; extension?: string; mimeType?: string; kind: "data" | "report" | "tree" };
  examples: readonly { label: string; inputs: Readonly<Record<string, string>> }[];
  notes: readonly string[];
};

const JSON_SAMPLE = '{"name":"Ada","active":true,"scores":[9,7],"profile":{"city":"London"}}';
const RECORDS = '[{"id":"a1","name":"Ada","score":9},{"id":"b2","name":"Lin","score":7}]';
const CSV_SAMPLE = 'id,name,score\na1,Ada,9\nb2,Lin,7';
const YAML_SAMPLE = 'name: Ada\nactive: true\nscores:\n  - 9\n  - 7\n';
const XML_SAMPLE = '<person><name>Ada</name><active>true</active></person>';
const TOML_SAMPLE = 'name = "Ada"\nactive = true\nscores = [9, 7]\n';
const JSONL_SAMPLE = '{"id":"a1","name":"Ada"}\n{"id":"b2","name":"Lin"}';

const samples: Record<string, string> = {
  JSON: JSON_SAMPLE, "JSON array": RECORDS, "JSON object": '{"a1":{"name":"Ada"},"b2":{"name":"Lin"}}',
  CSV: CSV_SAMPLE, "Tabular text": 'id;name;score\na1;Ada;9\nb2;Lin;7', TSV: 'id\tname\tscore\na1\tAda\t9\nb2\tLin\t7',
  YAML: YAML_SAMPLE, XML: XML_SAMPLE, TOML: TOML_SAMPLE, "JSON Lines": JSONL_SAMPLE,
  Text: 'Hello "Ada"\nWelcome to Code Station.', "JSON string literal": '"Hello \\"Ada\\"\\nWelcome to Code Station."',
};

function input(format: string, label = `${format} input`): DataInputField {
  return { name: "input", label, control: "textarea", placeholder: samples[format], required: true };
}
function text(name: DataFieldName, label: string, placeholder: string, hint?: string, required = true): DataInputField {
  return { name, label, placeholder, hint, required, control: "text" };
}
const extensions: Record<string, [string, string]> = {
  JSON: ["json", "application/json"], YAML: ["yaml", "application/yaml"], CSV: ["csv", "text/csv"],
  TSV: ["tsv", "text/tab-separated-values"], XML: ["xml", "application/xml"], TOML: ["toml", "application/toml"],
  "JSON Lines": ["jsonl", "application/x-ndjson"], Markdown: ["md", "text/markdown"], HTML: ["html", "text/html"],
  Text: ["txt", "text/plain"], "JSON string literal": ["json", "application/json"],
};

type CatalogOptions = {
  slug?: string;
  fields?: readonly DataInputField[];
  example?: Record<string, string>;
  notes?: readonly string[];
  kind?: "data" | "report" | "tree";
  outputLabel?: string;
  relatedTools?: readonly string[];
  featured?: boolean;
  pairId?: string;
  direction?: "forward" | "reverse";
  pairedTool?: "json-to-yaml" | "yaml-to-json" | "json-to-csv" | "csv-to-json" | "json-escape" | "json-unescape" | "json-array-to-object" | "json-object-to-array" | "json-to-jsonl" | "jsonl-to-json" | "csv-to-tsv" | "tsv-to-csv" | "json-to-xml" | "xml-to-json" | "json-to-toml" | "toml-to-json";
};

function define<const Id extends string>(id: Id, name: string, description: string, inputFormat: string, outputFormat: string, action: string, options: CatalogOptions = {}) {
  const kind = options.kind ?? "data";
  const file = kind === "data" ? extensions[outputFormat] : undefined;
  const fields = options.fields ?? [input(inputFormat)];
  const dataContract: DataToolContract = {
    fields, action,
    output: { label: options.outputLabel ?? `${outputFormat} output`, format: outputFormat, kind, ...(file ? { extension: file[0], mimeType: file[1] } : {}) },
    examples: [{ label: "Load example", inputs: { input: samples[inputFormat], ...options.example } }],
    notes: options.notes ?? [],
  };
  return {
    id, slug: options.slug ?? id, name, description, category: "JSON & Data" as const,
    keywords: [...new Set([inputFormat.toLowerCase(), outputFormat.toLowerCase(), ...name.toLowerCase().split(/\s+/)])],
    inputFormat, outputFormat, inputType: inputFormat, outputType: outputFormat,
    featured: options.featured, pairId: options.pairId, direction: options.direction, pairedTool: options.pairedTool,
    relatedTools: options.relatedTools ?? (inputFormat.startsWith("JSON") ? ["json-formatter", "json-validator", "json-tree-viewer"].filter((related) => related !== id) : inputFormat === "CSV" ? ["csv-formatter", "csv-validator", "csv-to-json"].filter((related) => related !== id) : ["json-formatter", "json-validator"]),
    dataContract,
  };
}

export const jsonDataTools = [
  define("json-formatter", "JSON Formatter", "Format JSON with readable two-space indentation in your browser.", "JSON", "JSON", "Format JSON", { featured: true }),
  define("json-validator", "JSON Validator", "Check JSON syntax and locate invalid input locally.", "JSON", "Validation report", "Validate JSON", { kind: "report", outputLabel: "Validation result", featured: true }),
  define("json-minifier", "JSON Minifier", "Remove insignificant JSON whitespace without changing its structure.", "JSON", "JSON", "Minify JSON", { featured: true }),
  define("json-to-yaml", "JSON to YAML", "Convert JSON into readable YAML locally.", "JSON", "YAML", "Convert to YAML", { pairId: "json-yaml", direction: "forward", pairedTool: "yaml-to-json", featured: true }),
  define("yaml-to-json", "YAML to JSON", "Convert a YAML document into JSON-compatible data.", "YAML", "JSON", "Convert to JSON", { pairId: "json-yaml", direction: "reverse", pairedTool: "json-to-yaml", notes: ["Use one document with string mapping keys and JSON-compatible values."] }),
  define("json-to-csv", "JSON to CSV", "Convert a JSON array of records into quoted CSV text.", "JSON array", "CSV", "Convert to CSV", { pairId: "json-csv", direction: "forward", pairedTool: "csv-to-json", featured: true }),
  define("csv-to-json", "CSV to JSON", "Convert CSV headers and rows into a JSON array of records.", "CSV", "JSON", "Convert to JSON", { pairId: "json-csv", direction: "reverse", pairedTool: "json-to-csv", notes: ["The first row supplies column names; cell values remain strings."] }),
  define("json-diff", "JSON Diff", "Compare two JSON documents by structure and changed values.", "JSON", "Diff report", "Compare JSON", { kind: "report", outputLabel: "JSON differences", fields: [input("JSON", "JSON A"), { ...input("JSON", "JSON B"), name: "secondary" }], example: { secondary: '{"name":"Ada","active":false,"scores":[9,8],"profile":{"city":"London"}}' } }),
  define("json-tree-viewer", "JSON Tree Viewer", "Explore JSON keys, array indexes, types, and values in an expandable tree.", "JSON", "JSON tree", "View tree", { kind: "tree", outputLabel: "JSON tree" }),
  define("json-schema-validator", "JSON Schema Validator", "Validate JSON data against a supplied local JSON Schema.", "JSON", "Validation report", "Validate against schema", { kind: "report", outputLabel: "Schema validation result", fields: [input("JSON", "JSON data"), { name: "secondary", label: "JSON Schema", control: "textarea", required: true, placeholder: '{"type":"object","required":["name"]}' }], example: { secondary: '{"type":"object","required":["name","active"],"properties":{"name":{"type":"string"},"active":{"type":"boolean"}}}' }, notes: ["Schema references must be local; remote schemas are not fetched."] }),
  define("json-schema-generator", "JSON Schema Generator", "Infer a starting JSON Schema from a representative JSON sample.", "JSON", "JSON", "Generate schema", { outputLabel: "Generated JSON Schema", featured: true, notes: ["Inferred constraints reflect this sample, not every valid future document."] }),
  define("jsonpath-tester", "JSONPath Tester", "Select matching JSON values with a local, non-executing JSONPath expression.", "JSON", "JSON", "Run JSONPath", { outputLabel: "Matched values", fields: [input("JSON"), text("expression", "JSONPath expression", "$.scores[*]", "Use property access, array indexes, wildcards, slices, or recursive descent. Script expressions are not executed.")], example: { expression: "$.scores[*]" } }),
  define("json-escape", "JSON Escape", "Encode text as a quoted JSON string literal.", "Text", "JSON string literal", "Escape text", { fields: [{ ...input("Text", "Raw text"), required: false }], pairId: "json-string", direction: "forward", pairedTool: "json-unescape", notes: ["The output includes the enclosing JSON quotation marks. Empty text produces an empty string literal."] }),
  define("json-unescape", "JSON Unescape", "Decode a quoted JSON string literal into plain text.", "JSON string literal", "Text", "Unescape string", { pairId: "json-string", direction: "reverse", pairedTool: "json-escape", notes: ["Paste the entire JSON string, including its enclosing double quotes."] }),
  define("json-key-sorter", "JSON Key Sorter", "Sort object keys recursively while retaining array order.", "JSON", "JSON", "Sort keys", { fields: [input("JSON"), { name: "direction", label: "Sort direction", control: "select", defaultValue: "ascending", options: [{ value: "ascending", label: "Ascending" }, { value: "descending", label: "Descending" }] }], example: { direction: "ascending" } }),
  define("json-array-to-object", "JSON Array to Object", "Index JSON records by a chosen unique property.", "JSON array", "JSON", "Convert to object", { pairId: "json-array-object", direction: "forward", pairedTool: "json-object-to-array", fields: [input("JSON array"), text("key", "Key property", "id", "Each record must have a unique value for this property.")], example: { key: "id" } }),
  define("json-object-to-array", "JSON Object to Array", "Convert object entries into an array of key/value records.", "JSON object", "JSON", "Convert to array", { pairId: "json-array-object", direction: "reverse", pairedTool: "json-array-to-object" }),
  define("jsonl-formatter", "JSON Lines Formatter", "Normalize each JSON Lines record to one compact JSON value per line.", "JSON Lines", "JSON Lines", "Format JSON Lines", { slug: "json-lines-formatter" }),
  define("jsonl-validator", "JSON Lines Validator", "Validate newline-delimited JSON and identify invalid record lines.", "JSON Lines", "Validation report", "Validate JSON Lines", { slug: "json-lines-validator", kind: "report", outputLabel: "JSON Lines validation result" }),
  define("jsonl-to-json", "JSON Lines to JSON", "Collect JSON Lines records into a JSON array.", "JSON Lines", "JSON", "Convert to JSON", { slug: "json-lines-to-json", pairId: "json-lines", direction: "reverse", pairedTool: "json-to-jsonl" }),
  define("json-to-jsonl", "JSON to JSON Lines", "Write a JSON array as one JSON value per line.", "JSON array", "JSON Lines", "Convert to JSON Lines", { slug: "json-to-json-lines", pairId: "json-lines", direction: "forward", pairedTool: "jsonl-to-json" }),
  define("json-structure-inspector", "JSON Structure Inspector", "Inspect JSON paths and types without displaying scalar values.", "JSON", "Structure report", "Inspect structure", { kind: "report", outputLabel: "JSON structure", notes: ["Reports paths and types only; property names are still visible."] }),
  define("json-statistics-analyzer", "JSON Statistics Analyzer", "Count JSON nodes, types, keys, and nesting depth.", "JSON", "Statistics report", "Analyze JSON", { kind: "report", outputLabel: "JSON statistics" }),
  define("csv-formatter", "CSV Formatter", "Normalize CSV quoting and record separators.", "CSV", "CSV", "Format CSV"),
  define("csv-validator", "CSV Validator", "Check CSV quoting and consistent row widths.", "CSV", "Validation report", "Validate CSV", { kind: "report", outputLabel: "CSV validation result" }),
  define("csv-column-analyzer", "CSV Column Analyzer", "Inspect empty, unique, and inferred value types in one CSV column.", "CSV", "Column report", "Analyze column", { kind: "report", outputLabel: "Column analysis", fields: [input("CSV"), text("column", "Column name", "score", "Enter the exact header name.")], example: { column: "score" } }),
  define("csv-delimiter-detector", "CSV Delimiter Detector", "Compare comma, tab, semicolon, and pipe separators in tabular text.", "Tabular text", "Delimiter report", "Detect delimiter", { kind: "report", outputLabel: "Detected delimiter" }),
  define("csv-to-tsv", "CSV to TSV", "Convert comma-separated records into tab-separated values.", "CSV", "TSV", "Convert to TSV", { pairId: "csv-tsv", direction: "forward", pairedTool: "tsv-to-csv" }),
  define("tsv-to-csv", "TSV to CSV", "Convert tab-separated records into quoted CSV.", "TSV", "CSV", "Convert to CSV", { pairId: "csv-tsv", direction: "reverse", pairedTool: "csv-to-tsv" }),
  define("csv-to-markdown", "CSV to Markdown", "Convert CSV into a Markdown table with escaped cell content.", "CSV", "Markdown", "Create Markdown table"),
  define("csv-to-html", "CSV to HTML Table", "Generate escaped HTML table source from CSV records.", "CSV", "HTML", "Create HTML table", { slug: "csv-to-html-table", notes: ["The result is HTML source, displayed as text rather than rendered markup."] }),
  define("csv-cleaner", "CSV Cleaner", "Trim cell edges and remove empty CSV rows while preserving meaningful content.", "CSV", "CSV", "Clean CSV", { example: { input: 'id,name,score\na1, Ada ,9\nb2, Lin ,7' } }),
  define("csv-column-reorderer", "CSV Column Reorderer", "Reorder CSV columns using an explicit list of header names.", "CSV", "CSV", "Reorder columns", { fields: [input("CSV"), { name: "order", label: "Column order (one header per line)", control: "textarea", required: true, placeholder: "name\nscore\nid", hint: "Enter existing headers once each, separated by newlines; only requested columns are output. Header names may contain commas. Use a JSON array for names containing newlines." }], example: { order: "name\nscore\nid" } }),
  define("csv-row-filter", "CSV Row Filter", "Keep CSV rows matching a text or numeric column comparison.", "CSV", "CSV", "Filter rows", { fields: [input("CSV"), text("column", "Column name", "score"), { name: "operator", label: "Comparison", control: "select", defaultValue: "Equals", options: [{ value: "Equals", label: "Equals" }, { value: "Not equals", label: "Not equals" }, { value: "Contains", label: "Contains" }, { value: "Starts with", label: "Starts with" }, { value: "Ends with", label: "Ends with" }, { value: "Greater than", label: "Greater than" }, { value: "Greater than or equal", label: "Greater than or equal" }, { value: "Less than", label: "Less than" }, { value: "Less than or equal", label: "Less than or equal" }] }, text("value", "Comparison value", "8", "Text comparisons are case-sensitive. Ordered comparisons require numeric values.", false)], example: { column: "score", operator: "Greater than", value: "8" } }),
  define("csv-deduplicator", "CSV Data Deduplicator", "Remove duplicate CSV rows while preserving the first occurrence.", "CSV", "CSV", "Remove duplicates", { slug: "csv-data-deduplicator", fields: [input("CSV"), { name: "keys", label: "Key columns (optional; one header per line)", control: "textarea", placeholder: "id\nname", hint: "Leave empty to compare whole rows, or enter exact header names separated by newlines." }], example: { input: `${CSV_SAMPLE}\na1,Ada,9`, keys: "" } }),
  define("csv-transposer", "CSV Transposer", "Swap CSV rows and columns, including the header row.", "CSV", "CSV", "Transpose CSV"),
  define("json-to-xml", "JSON to XML", "Convert JSON into XML using a fixed root element.", "JSON", "XML", "Convert to XML", { pairId: "json-xml", direction: "forward", pairedTool: "xml-to-json", example: { input: '{"person":{"name":"Ada","active":true}}' }, notes: ["Output uses a root element and item elements for array entries. Keys must be valid unprefixed XML names. Primitive values, including null, become text; JSON types are not preserved in an XML round trip."] }),
  define("xml-to-json", "XML to JSON", "Parse XML elements and attributes into JSON locally.", "XML", "JSON", "Convert to JSON", { pairId: "json-xml", direction: "reverse", pairedTool: "json-to-xml", notes: ["The root element becomes a key; attributes use @attributes and repeated elements become arrays. Leaf text is a string; text alongside children or attributes uses #text. Comments and processing instructions are omitted; mixed text is joined and sibling order across different names is not retained."] }),
  define("json-to-toml", "JSON to TOML", "Serialize a compatible JSON configuration object as TOML.", "JSON object", "TOML", "Convert to TOML", { pairId: "json-toml", direction: "forward", pairedTool: "toml-to-json", example: { input: '{"name":"Ada","active":true,"scores":[9,7]}' }, notes: ["TOML has no null value; incompatible JSON values are rejected."] }),
  define("toml-to-json", "TOML to JSON", "Parse TOML configuration into structured JSON.", "TOML", "JSON", "Convert to JSON", { pairId: "json-toml", direction: "reverse", pairedTool: "json-to-toml" }),
  define("yaml-diff", "YAML Diff", "Compare two YAML documents as structured data.", "YAML", "Diff report", "Compare YAML", { kind: "report", outputLabel: "YAML differences", fields: [input("YAML", "YAML A"), { ...input("YAML", "YAML B"), name: "secondary" }], example: { secondary: 'name: Ada\nactive: false\nscores:\n  - 9\n  - 8\n' } }),
  define("yaml-formatter", "YAML Formatter", "Parse and normalize a YAML document with readable indentation.", "YAML", "YAML", "Format YAML"),
  define("yaml-validator", "YAML Validator", "Check YAML syntax locally and report parser errors.", "YAML", "Validation report", "Validate YAML", { kind: "report", outputLabel: "YAML validation result" }),
  define("xml-formatter", "XML Formatter", "Format XML structure while preserving significant text content.", "XML", "XML", "Format XML"),
  define("xml-validator", "XML Validator", "Check XML well-formedness with a local XML parser.", "XML", "Validation report", "Validate XML", { kind: "report", outputLabel: "XML validation result", notes: ["This checks well-formedness, not XSD or DTD schema validity."] }),
  define("xml-minifier", "XML Minifier", "Remove formatting whitespace from XML while preserving significant text.", "XML", "XML", "Minify XML"),
] as const;

export type JsonDataToolId = (typeof jsonDataTools)[number]["id"];
export type JsonDataDefinition = (typeof jsonDataTools)[number];

export function isJsonDataToolId(id: string): id is JsonDataToolId {
  return jsonDataTools.some((tool) => tool.id === id);
}

export function getJsonDataDefinition(idOrSlug: string): JsonDataDefinition | undefined {
  return jsonDataTools.find((tool) => tool.id === idOrSlug || tool.slug === idOrSlug);
}
