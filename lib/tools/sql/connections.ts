import type { SqlResult, SqlValues } from "./types";
import { sqlText } from "./literals";

type DatabaseType = "PostgreSQL" | "MySQL" | "SQL Server";
type Parameter = { key: string; value: string };
const defaults: Record<DatabaseType, string> = { PostgreSQL: "5432", MySQL: "3306", "SQL Server": "1433" };
const mask = "••••••••";
const normalize = (key: string): string => key.toLowerCase().replace(/[\s_-]/g, "");
const coreNames = new Set(["host", "hostname", "server", "datasource", "address", "addr", "networkaddress", "port", "database", "dbname", "initialcatalog", "username", "user", "userid", "uid", "password", "pwd", "pass"]);
const privateName = (key: string): boolean => /password|pwd|passphrase|token|secret|credential|auth|(?:^|[\s_-])key|accesskey|privatekey|sslkey|clientkey|certificate|signature|sastoken/i.test(key) || /^(pass|apikey|key)$/i.test(normalize(key));

function text(value: unknown, label: string, required = false): string {
  const result = sqlText(value, label);
  if (/[\x00-\x1f\x7f]/.test(result)) throw new Error(`${label} cannot contain control characters.`);
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(result)) throw new Error(`${label} must contain valid Unicode.`);
  if (required && !result.trim()) throw new Error(`${label} is required.`);
  return result;
}

function port(value: string, type: DatabaseType): string {
  if (!value) return defaults[type];
  if (!/^[1-9]\d{0,4}$/.test(value) || Number(value) > 65535) throw new Error("Port must be an integer from 1 to 65,535, or blank for the database default.");
  return value;
}

function host(value: string): string {
  if (!value || value !== value.trim() || /[\s/?@#\\]/u.test(value)) throw new Error("Host must be a hostname, IP address, or IPv6 address without a scheme, path, or credentials.");
  if (value.includes(":")) {
    const bracketed = value.startsWith("[") && value.endsWith("]") ? value : `[${value}]`;
    try {
      const url = new URL(`http://${bracketed}/`);
      if (!url.hostname.startsWith("[")) throw new Error();
      return url.hostname;
    } catch { throw new Error("Enter a valid IPv6 address; zone identifiers and host:port syntax are unsupported."); }
  }
  if (!/^[\p{L}\p{N}._-]+$/u.test(value) || value.length > 253) throw new Error("Enter a valid hostname or IP address.");
  try { return new URL(`http://${value}/`).hostname; }
  catch { throw new Error("Enter a valid hostname or IP address."); }
}

function decode(value: string, query = false): string {
  try { return decodeURIComponent(query ? value.replace(/\+/g, " ") : value); }
  catch { throw new Error("Connection string contains invalid percent encoding."); }
}

function validateParameters(parameters: Parameter[], rejectCore: boolean): Parameter[] {
  if (parameters.length > 100) throw new Error("Parameters exceed the 100-entry limit.");
  const seen = new Set<string>();
  return parameters.map(({ key, value }) => {
    if (!/^[A-Za-z][A-Za-z0-9 ._-]{0,127}$/.test(key)) throw new Error("Parameter names must start with a letter and contain only letters, numbers, spaces, dots, underscores, or hyphens.");
    const normalized = normalize(key);
    if (seen.has(normalized)) throw new Error("Duplicate connection parameter names are unsupported.");
    seen.add(normalized);
    if (rejectCore && coreNames.has(normalized)) throw new Error("Parameters cannot override host, port, database, username, or password fields.");
    return { key, value: text(value, "Parameter value") };
  });
}

/** Parameters: newline-separated key=value, or an optional-? URL query string. */
function parameters(value: string): Parameter[] {
  if (!value.trim()) return [];
  if (value.startsWith("?") || (value.includes("&") && !/[\r\n]/.test(value))) return queryParameters(value.replace(/^\?/, ""));
  return validateParameters(value.split(/\r\n|\r|\n/).filter(line => line.trim() !== "").map(line => {
    const equals = line.indexOf("=");
    if (equals < 1) throw new Error("Parameters must use one key=value per line, or URL query syntax beginning with ?.");
    return { key: line.slice(0, equals).trim(), value: line.slice(equals + 1) };
  }), true);
}

function queryParameters(query: string, rejectCore = true): Parameter[] {
  if (!query) return [];
  return validateParameters(query.split("&").map(pair => {
    const equals = pair.indexOf("=");
    if (equals < 1) throw new Error("Each URL parameter must use key=value syntax.");
    return { key: decode(pair.slice(0, equals), true), value: decode(pair.slice(equals + 1), true) };
  }), rejectCore);
}

function adoQuote(value: string): string { return `"${value.replace(/"/g, '""')}"`; }

function build(values: SqlValues): SqlResult {
  const type = values.databaseType;
  if (type !== "PostgreSQL" && type !== "MySQL" && type !== "SQL Server") throw new Error("Choose PostgreSQL, MySQL, or SQL Server.");
  const hostname = host(text(values.host, "Host", true));
  const serverPort = port(text(values.port, "Port"), type);
  const database = text(values.database, "Database", true);
  const username = text(values.username, "Username", true);
  const password = text(values.password, "Password");
  const extra = parameters(values.parameters === undefined ? "" : sqlText(values.parameters, "Parameters"));
  let connection: string;
  if (type === "SQL Server") {
    connection = `Data Source=${adoQuote(`${hostname},${serverPort}`)};Initial Catalog=${adoQuote(database)};User ID=${adoQuote(username)};Password=${adoQuote(password)};${extra.map(item => `${item.key}=${adoQuote(item.value)};`).join("")}`;
  } else {
    const query = extra.length ? `?${extra.map(item => `${encodeURIComponent(item.key)}=${encodeURIComponent(item.value)}`).join("&")}` : "";
    connection = `${type === "PostgreSQL" ? "postgresql" : "mysql"}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostname}:${serverPort}/${encodeURIComponent(database)}${query}`;
  }
  if (connection.length > 2_000_000) throw new Error("Connection string exceeds the output limit.");
  return { rows: [{ label: "Connection string", value: connection }] };
}

function redacted(item: Parameter): Parameter {
  // Redact complete values when they contain a nested credential URL or secret assignment.
  let inspection = item.value;
  for (let round = 0; round < 2; round++) {
    try { inspection = decodeURIComponent(inspection); } catch { break; }
  }
  const secretValue = /[a-z][a-z\d+.-]*:\/\/[^\s/]*@/i.test(inspection)
    || /(?:password|pwd|token|secret|credential|auth|access.?key|private.?key|api.?key|signature)\s*(?:=|:)/i.test(inspection);
  return { key: item.key, value: privateName(item.key) || secretValue ? mask : item.value };
}

function output(type: DatabaseType, hostname: string, serverPort: string, database: string, username: string, extra: Parameter[]): SqlResult {
  return { rows: [
    { label: "Database type", value: type }, { label: "Host", value: hostname },
    { label: "Port", value: serverPort }, { label: "Database name", value: database },
    { label: "Username", value: username }, { label: "Masked password", value: mask },
    { label: "Parameters", value: extra.length ? extra.map(redacted).map(item => `${item.key}=${item.value}`).join("\n") : "None" },
  ] };
}

function parseUri(input: string): SqlResult {
  const scheme = /^(postgresql|postgres|mysql):\/\//i.exec(input);
  if (!scheme) throw new Error("Use a PostgreSQL/MySQL URI or a SQL Server ADO.NET connection string.");
  const type: DatabaseType = scheme[1].toLowerCase() === "mysql" ? "MySQL" : "PostgreSQL";
  const authority = input.slice(scheme[0].length).split(/[/?#]/, 1)[0];
  if ((authority.match(/@/g) ?? []).length > 1) throw new Error("Encode @ inside URI credentials; multiple userinfo separators are ambiguous.");
  if (input.includes("#")) throw new Error("Connection URI fragments are unsupported; encode # inside field values.");
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Invalid database connection URI."); }
  // URL parsing permits malformed escapes in some components; decode all explicitly.
  const username = text(decode(url.username), "Username");
  text(decode(url.password), "Password");
  const database = text(decode(url.pathname.replace(/^\//, "")), "Database", true);
  if (url.pathname.slice(1).includes("/")) throw new Error("Database paths must be one encoded path segment.");
  const hostname = host(url.hostname);
  const serverPort = port(url.port, type);
  const extra = queryParameters(url.search.replace(/^\?/, ""));
  return output(type, hostname, serverPort, database, username, extra);
}

/** ADO.NET quoted values support doubled quote characters and embedded semicolons. */
function adoParameters(input: string): Parameter[] {
  const pairs: Parameter[] = [];
  let position = 0;
  while (position < input.length) {
    while (/[\s;]/.test(input[position] ?? "") && position < input.length) position++;
    if (position === input.length) break;
    const start = position;
    while (position < input.length && input[position] !== "=" && input[position] !== ";") position++;
    if (input[position] !== "=") throw new Error("ADO.NET connection entries must use key=value syntax.");
    const key = input.slice(start, position++).trim();
    while (input[position] === " ") position++;
    let value = "";
    const quote = input[position];
    if (quote === '"' || quote === "'") {
      position++;
      let closed = false;
      while (position < input.length) {
        const character = input[position++];
        if (character !== quote) { value += character; continue; }
        if (input[position] === quote) { value += quote; position++; }
        else { closed = true; break; }
      }
      if (!closed) throw new Error("ADO.NET connection string has an unclosed quoted value.");
      while (input[position] === " ") position++;
      if (position < input.length && input[position] !== ";") throw new Error("Unexpected text after a quoted ADO.NET value.");
    } else {
      const startValue = position;
      while (position < input.length && input[position] !== ";") position++;
      value = input.slice(startValue, position).trim();
      if (/["']/.test(value)) throw new Error("Quote the entire ADO.NET value when it contains quotes.");
    }
    pairs.push({ key, value });
    if (input[position] === ";") position++;
    if (pairs.length > 100) throw new Error("Connection entries exceed the 100-entry limit.");
  }
  return validateParameters(pairs, false);
}

function parseAdo(input: string): SqlResult {
  const pairs = adoParameters(input);
  const aliases: Record<string, string> = {
    server: "host", datasource: "host", address: "host", addr: "host", networkaddress: "host", host: "host",
    initialcatalog: "database", database: "database", dbname: "database",
    userid: "username", uid: "username", user: "username", username: "username",
    password: "password", pwd: "password", pass: "password", port: "port",
  };
  const core = new Map<string, string>();
  const extra: Parameter[] = [];
  for (const pair of pairs) {
    const normalized = normalize(pair.key);
    const key = Object.prototype.hasOwnProperty.call(aliases, normalized) ? aliases[normalized] : undefined;
    if (!key) { extra.push(pair); continue; }
    if (core.has(key)) throw new Error("Connection string contains duplicate aliases for a core field.");
    core.set(key, pair.value);
  }
  const source = (core.get("host") ?? "").replace(/^tcp:/i, "");
  const parts = source.split(",");
  if (parts.length > 2 || (parts.length === 2 && core.has("port"))) throw new Error("SQL Server host and port are ambiguous; supply one port.");
  const hostname = host(parts[0].trim());
  const serverPort = port((parts[1] ?? core.get("port") ?? "").trim(), "SQL Server");
  const database = text(core.get("database") ?? "", "Database", true);
  return output("SQL Server", hostname, serverPort, database, core.get("username") ?? "", extra);
}

export function runConnection(toolId: string, values: SqlValues): SqlResult {
  if (toolId === "database-connection-string-builder") return build(values);
  if (toolId !== "database-connection-string-parser") throw new Error("Unsupported connection string tool.");
  const input = sqlText(values.connectionString, "Connection string").trim();
  if (!input) throw new Error("Enter a connection string.");
  if (/[\x00-\x1f\x7f]/.test(input)) throw new Error("Connection strings cannot contain control characters.");
  return /^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(input) ? parseUri(input) : parseAdo(input);
}
