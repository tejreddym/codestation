/**
 * Authoritative, metadata-only capability map for real format converters.
 * Components use it for target filtering and route resolution; engines remain lazy.
 */
export type ConversionCapability = {
  family: string;
  source: string;
  target: string;
  route: string;
  inputKind: "text" | "file" | "workbook";
  outputKind: "text" | "file" | "workbook";
  mime?: string;
  extension?: string;
  runtime?: string;
  limitations?: readonly string[];
  /** Stable-route numeric tools may intentionally expose an identity conversion. */
  routeMode?: "directional" | "stable-numeric";
  discoveryCategory?: string;
};

export const conversionCapabilities: readonly ConversionCapability[] = [
  { family: "image-raster", source: "png", target: "jpg", route: "/tools/png-to-jpg", inputKind: "file", outputKind: "file", mime: "image/jpeg", extension: "jpg" },
  { family: "image-raster", source: "png", target: "webp", route: "/tools/png-to-webp", inputKind: "file", outputKind: "file", mime: "image/webp", extension: "webp" },
  { family: "image-raster", source: "jpg", target: "png", route: "/tools/jpg-to-png", inputKind: "file", outputKind: "file", mime: "image/png", extension: "png" },
  { family: "image-raster", source: "jpg", target: "webp", route: "/tools/jpg-to-webp", inputKind: "file", outputKind: "file", mime: "image/webp", extension: "webp" },
  { family: "image-raster", source: "webp", target: "png", route: "/tools/webp-to-png", inputKind: "file", outputKind: "file", mime: "image/png", extension: "png" },
  { family: "image-raster", source: "webp", target: "jpg", route: "/tools/webp-to-jpg", inputKind: "file", outputKind: "file", mime: "image/jpeg", extension: "jpg" },
  { family: "image-raster", source: "avif", target: "png", route: "/tools/avif-to-png", inputKind: "file", outputKind: "file", mime: "image/png", extension: "png", runtime: "native-avif-decoder" },
  { family: "image-raster", source: "avif", target: "jpg", route: "/tools/avif-to-jpg", inputKind: "file", outputKind: "file", mime: "image/jpeg", extension: "jpg", runtime: "native-avif-decoder" },
  { family: "image-svg", source: "svg", target: "png", route: "/tools/svg-to-png", inputKind: "file", outputKind: "file", mime: "image/png", extension: "png", limitations: ["strict static SVG subset"] },
  { family: "image-svg", source: "svg", target: "jpg", route: "/tools/svg-to-jpg", inputKind: "file", outputKind: "file", mime: "image/jpeg", extension: "jpg", limitations: ["strict static SVG subset"] },
  { family: "image-svg", source: "svg", target: "webp", route: "/tools/svg-to-webp", inputKind: "file", outputKind: "file", mime: "image/webp", extension: "webp", limitations: ["strict static SVG subset"] },
  { family: "spreadsheet", source: "csv", target: "xlsx", route: "/tools/csv-to-excel", inputKind: "text", outputKind: "workbook", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" },
  { family: "spreadsheet", source: "xlsx", target: "csv", route: "/tools/excel-to-csv", inputKind: "workbook", outputKind: "text", mime: "text/csv", extension: "csv" },
  { family: "spreadsheet", source: "json", target: "xlsx", route: "/tools/json-to-excel", inputKind: "text", outputKind: "workbook", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" },
  { family: "spreadsheet", source: "xlsx", target: "json", route: "/tools/excel-to-json", inputKind: "workbook", outputKind: "text", mime: "application/json", extension: "json" },
  { family: "spreadsheet", source: "tsv", target: "xlsx", route: "/tools/tsv-to-excel", inputKind: "text", outputKind: "workbook", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" },
  { family: "spreadsheet", source: "xlsx", target: "tsv", route: "/tools/excel-to-tsv", inputKind: "workbook", outputKind: "text", mime: "text/tab-separated-values", extension: "tsv" },
  { family: "markdown", source: "markdown", target: "html", route: "/tools/markdown-to-html", inputKind: "text", outputKind: "text", mime: "text/html", extension: "html" },
  { family: "markdown", source: "html", target: "markdown", route: "/tools/html-to-markdown", inputKind: "text", outputKind: "text", mime: "text/markdown", extension: "md" },
  { family: "json-data", source: "json", target: "yaml", route: "/tools/json-to-yaml", inputKind: "text", outputKind: "text" },
  { family: "json-data", source: "yaml", target: "json", route: "/tools/yaml-to-json", inputKind: "text", outputKind: "text" },
  { family: "json-data", source: "json-array", target: "csv", route: "/tools/json-to-csv", inputKind: "text", outputKind: "text" },
  { family: "json-data", source: "csv", target: "json-array", route: "/tools/csv-to-json", inputKind: "text", outputKind: "text" },
  { family: "json-data", source: "json", target: "xml", route: "/tools/json-to-xml", inputKind: "text", outputKind: "text" },
  { family: "json-data", source: "xml", target: "json", route: "/tools/xml-to-json", inputKind: "text", outputKind: "text" },
  { family: "json-data", source: "json", target: "toml", route: "/tools/json-to-toml", inputKind: "text", outputKind: "text" },
  { family: "json-data", source: "toml", target: "json", route: "/tools/toml-to-json", inputKind: "text", outputKind: "text" },
  { family: "encoding", source: "text", target: "base64", route: "/tools/base64-encoder", inputKind: "text", outputKind: "text" },
  { family: "encoding", source: "base64", target: "text", route: "/tools/base64-decoder", inputKind: "text", outputKind: "text" },
  { family: "encoding", source: "text", target: "url", route: "/tools/url-encoder", inputKind: "text", outputKind: "text" },
  { family: "encoding", source: "url", target: "text", route: "/tools/url-decoder", inputKind: "text", outputKind: "text" },
  { family: "encoding", source: "text", target: "hex", route: "/tools/text-to-hex", inputKind: "text", outputKind: "text" },
  { family: "encoding", source: "hex", target: "text", route: "/tools/hex-to-text", inputKind: "text", outputKind: "text" },
  { family: "encoding", source: "text", target: "binary", route: "/tools/binary-encoder", inputKind: "text", outputKind: "text" },
  { family: "encoding", source: "binary", target: "text", route: "/tools/binary-decoder", inputKind: "text", outputKind: "text" },
  { family: "text", source: "tabs", target: "spaces", route: "/tools/tabs-to-spaces", inputKind: "text", outputKind: "text" },
  { family: "text", source: "spaces", target: "tabs", route: "/tools/spaces-to-tabs", inputKind: "text", outputKind: "text" },
  { family: "text", source: "lf", target: "crlf", route: "/tools/lf-to-crlf", inputKind: "text", outputKind: "text" },
  { family: "text", source: "crlf", target: "lf", route: "/tools/crlf-to-lf", inputKind: "text", outputKind: "text" },
  { family: "sql", source: "sql-insert", target: "json", route: "/tools/sql-to-json", inputKind: "text", outputKind: "text", limitations: ["supported literal INSERT subset"] },
  { family: "sql", source: "sql-insert", target: "csv", route: "/tools/sql-to-csv", inputKind: "text", outputKind: "text", limitations: ["supported literal INSERT subset"] },
  { family: "sql", source: "sql-insert", target: "markdown", route: "/tools/sql-to-markdown", inputKind: "text", outputKind: "text", limitations: ["supported literal INSERT subset"] },
  { family: "sql", source: "json", target: "sql-insert", route: "/tools/json-to-sql", inputKind: "text", outputKind: "text", limitations: ["dialect and literal mapping rules"] },
  { family: "api-code", source: "curl", target: "fetch", route: "/tools/curl-to-fetch", inputKind: "text", outputKind: "text", limitations: ["supported static cURL subset"] },
  { family: "api-code", source: "fetch", target: "curl", route: "/tools/fetch-to-curl", inputKind: "text", outputKind: "text", limitations: ["supported static Fetch subset"] },
  { family: "color", source: "hex", target: "rgb", route: "/tools/color-converter", inputKind: "text", outputKind: "text" },
  { family: "color", source: "hex", target: "hsl", route: "/tools/color-converter", inputKind: "text", outputKind: "text" },
  { family: "color", source: "rgb", target: "hex", route: "/tools/color-converter", inputKind: "text", outputKind: "text" },
  { family: "color", source: "rgb", target: "hsl", route: "/tools/color-converter", inputKind: "text", outputKind: "text" },
  { family: "color", source: "hsl", target: "hex", route: "/tools/color-converter", inputKind: "text", outputKind: "text" },
  { family: "color", source: "hsl", target: "rgb", route: "/tools/color-converter", inputKind: "text", outputKind: "text" },
  { family: "numeric-unit", source: "unit", target: "unit", route: "/tools/unit-converter", inputKind: "text", outputKind: "text", routeMode: "stable-numeric", discoveryCategory: "units-temperature" },
  { family: "numeric-temperature", source: "temperature", target: "temperature", route: "/tools/temperature-converter", inputKind: "text", outputKind: "text", routeMode: "stable-numeric", discoveryCategory: "units-temperature" },
  { family: "numeric-base", source: "number-base", target: "number-base", route: "/tools/number-base-converter", inputKind: "text", outputKind: "text", routeMode: "stable-numeric", discoveryCategory: "numbers" },
];

export function capabilitiesFor(family: string, source?: string) { return conversionCapabilities.filter(capability => capability.family === family && (!source || capability.source === source)); }
export function capabilityForRoute(route: string) { return conversionCapabilities.find(capability => capability.route === route); }
