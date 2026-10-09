export type MockTemplate = "users" | "products" | "orders" | "custom";
export type MockFieldType =
  | "uuid"
  | "name"
  | "firstName"
  | "lastName"
  | "email"
  | "number"
  | "price"
  | "boolean"
  | "date"
  | "status"
  | "role"
  | "city"
  | "country"
  | "sku"
  | "phone";

export type SqlDialect = "postgresql" | "mysql" | "sqlite";

export interface ColumnDefinition {
  name: string;
  type: MockFieldType;
  nullable?: boolean;
  unique?: boolean;
  enum?: string[];
  defaultValue?: any;
  foreignKey?: { table: string; column: string };
}

export interface TableSchema {
  name: string;
  columns: ColumnDefinition[];
  dependencies?: string[];
}

export interface MockDataOptions {
  template?: MockTemplate;
  count?: number;
  format?: "json" | "sql" | "csv";
  tableName?: string;
  dialect?: SqlDialect;
  customSchema?: Record<string, MockFieldType>;
  jsonSchema?: string | Record<string, any>;
  sqlDdl?: string;
  csvHeaders?: string;
  seed?: number;
  tables?: TableSchema[];
}

export interface MockDatasetResult {
  data: Record<string, any>[];
  json: string;
  sql?: string;
  csv?: string;
  count: number;
  tables?: Record<string, Record<string, any>[]>;
}

// Deterministic Linear Congruential Generator
class Prng {
  private state: number;

  constructor(seed?: number) {
    this.state = seed !== undefined ? (seed >>> 0) || 1 : Math.floor(Math.random() * 2147483647) || 1;
  }

  next(): number {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  uuid(): string {
    const hex = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        s += "-";
      } else if (i === 14) {
        s += "4";
      } else if (i === 19) {
        s += hex[(Math.floor(this.next() * 4) + 8)];
      } else {
        s += hex[Math.floor(this.next() * 16)];
      }
    }
    return s;
  }
}

const FIRST_NAMES = [
  "Ada", "Alan", "Linus", "Grace", "Tim", "Margaret", "Donald", "Barbara", "Guido", "Ken",
  "Dennis", "Bjarne", "James", "Brendan", "Sophie", "Leslie", "Edsger", "Claude", "Radia", "Katherine"
];

const LAST_NAMES = [
  "Lovelace", "Turing", "Torvalds", "Hopper", "Berners-Lee", "Hamilton", "Knuth", "Liskov", "van Rossum",
  "Thompson", "Ritchie", "Stroustrup", "Gosling", "Eich", "Wilson", "Lamport", "Dijkstra", "Shannon", "Perlman", "Johnson"
];

const DOMAINS = ["example.com", "codestation.in", "acme.dev", "testmail.org", "infra.net"];
const CITIES = ["San Francisco", "London", "Bengaluru", "Berlin", "Tokyo", "Seattle", "Toronto", "Sydney", "Singapore", "Amsterdam"];
const COUNTRIES = ["United States", "United Kingdom", "India", "Germany", "Japan", "Canada", "Australia", "Singapore", "Netherlands", "France"];

const PRODUCT_PREFIXES = ["Pro", "Cloud", "Hyper", "Ultra", "Tactile", "Quantum", "Nexus", "Dev", "Micro", "Turbo"];
const PRODUCT_NOUNS = ["Station", "Terminal", "Gateway", "Engine", "Workspace", "Proxy", "Optimizer", "Parser", "Vault", "Pipeline"];
const CATEGORIES = ["Developer Tools", "Cloud Services", "Security & Auth", "Database", "Networking", "Analytics"];

const ROLES = ["admin", "developer", "maintainer", "viewer", "operator"];
const STATUSES = ["active", "pending", "suspended", "archived"];
const ORDER_STATUSES = ["completed", "processing", "shipped", "refunded"];
const PAYMENT_METHODS = ["card", "upi", "netbanking", "wire"];

function inferTypeFromName(name: string): MockFieldType {
  const lower = name.toLowerCase();
  if (lower === "id" || lower.endsWith("_id") || lower.endsWith("id")) return "uuid";
  if (lower.includes("email")) return "email";
  if (lower.includes("first_name") || lower.includes("firstname")) return "firstName";
  if (lower.includes("last_name") || lower.includes("lastname")) return "lastName";
  if (lower.includes("name")) return "name";
  if (lower.includes("price") || lower.includes("amount") || lower.includes("total") || lower.includes("salary")) return "price";
  if (lower.includes("count") || lower.includes("age") || lower.includes("qty") || lower.includes("number")) return "number";
  if (lower.startsWith("is_") || lower.startsWith("has_") || lower.includes("active") || lower.includes("enabled")) return "boolean";
  if (lower.includes("date") || lower.includes("created_at") || lower.includes("updated_at") || lower.includes("time")) return "date";
  if (lower.includes("status")) return "status";
  if (lower.includes("role")) return "role";
  if (lower.includes("city")) return "city";
  if (lower.includes("country")) return "country";
  if (lower.includes("sku") || lower.includes("code")) return "sku";
  if (lower.includes("phone")) return "phone";
  return "name";
}

export function parseJsonSchema(schemaInput: string | Record<string, any>): TableSchema {
  let schema: Record<string, any>;
  if (typeof schemaInput === "string") {
    try {
      schema = JSON.parse(schemaInput);
    } catch {
      throw new Error("Invalid JSON schema: Malformed JSON string.");
    }
  } else {
    schema = schemaInput;
  }

  if (!schema || typeof schema !== "object") {
    throw new Error("Invalid JSON schema: Schema must be an object.");
  }

  const tableName = schema.title || "records";
  const properties = schema.properties || {};
  const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);

  const columns: ColumnDefinition[] = [];

  for (const [propName, propDef] of Object.entries<any>(properties)) {
    if (!propDef || typeof propDef !== "object") continue;

    let type: MockFieldType = "name";
    if (propDef.enum && Array.isArray(propDef.enum)) {
      type = "status";
    } else if (propDef.type === "integer" || propDef.type === "number") {
      type = propDef.format === "price" || propName.toLowerCase().includes("price") ? "price" : "number";
    } else if (propDef.type === "boolean") {
      type = "boolean";
    } else if (propDef.format === "date-time" || propDef.format === "date") {
      type = "date";
    } else if (propDef.format === "uuid") {
      type = "uuid";
    } else if (propDef.format === "email") {
      type = "email";
    } else {
      type = inferTypeFromName(propName);
    }

    columns.push({
      name: propName,
      type,
      nullable: !required.has(propName),
      enum: propDef.enum && Array.isArray(propDef.enum) ? propDef.enum : undefined,
      defaultValue: propDef.default,
      unique: propName.toLowerCase() === "id" || propDef.unique === true,
    });
  }

  if (columns.length === 0) {
    throw new Error("Invalid JSON schema: No properties found in schema definition.");
  }

  return { name: tableName, columns };
}

export function parseSqlDdl(ddl: string): TableSchema {
  const trimmed = ddl.trim();
  const match = trimmed.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([A-Za-z0-9_]+)["`]?\s*\(([\s\S]+)\)/i);
  if (!match) {
    throw new Error("Invalid SQL DDL: Expected `CREATE TABLE table_name (...)` statement.");
  }

  const tableName = match[1];
  const body = match[2];
  const lines = body.split(",\n").map(l => l.trim()).filter(Boolean);

  const columns: ColumnDefinition[] = [];

  for (const line of lines) {
    // Skip table constraints like PRIMARY KEY (id)
    if (/^(?:PRIMARY\s+KEY|FOREIGN\s+KEY|CONSTRAINT|UNIQUE|INDEX)\b/i.test(line)) {
      continue;
    }

    const colMatch = line.match(/^["`]?([A-Za-z0-9_]+)["`]?\s+([A-Za-z0-9_()]+)(.*)$/);
    if (!colMatch) continue;

    const colName = colMatch[1];
    const rawType = colMatch[2].toUpperCase();
    const rest = colMatch[3].toUpperCase();

    const notNull = rest.includes("NOT NULL") || rest.includes("PRIMARY KEY");
    const unique = rest.includes("UNIQUE") || rest.includes("PRIMARY KEY");

    let type: MockFieldType = "name";
    if (rawType.includes("UUID")) type = "uuid";
    else if (rawType.includes("INT") || rawType.includes("SERIAL")) type = "number";
    else if (rawType.includes("NUMERIC") || rawType.includes("DECIMAL") || rawType.includes("FLOAT") || rawType.includes("DOUBLE")) type = "price";
    else if (rawType.includes("BOOL")) type = "boolean";
    else if (rawType.includes("DATE") || rawType.includes("TIME")) type = "date";
    else type = inferTypeFromName(colName);

    columns.push({
      name: colName,
      type,
      nullable: !notNull,
      unique,
    });
  }

  if (columns.length === 0) {
    throw new Error("Invalid SQL DDL: No valid column definitions parsed.");
  }

  return { name: tableName, columns };
}

export function parseCsvHeaders(headerLine: string): TableSchema {
  const headers = headerLine.split(",").map(h => h.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  if (headers.length === 0) {
    throw new Error("Invalid CSV header input: At least one column header is required.");
  }

  const columns: ColumnDefinition[] = headers.map(h => ({
    name: h,
    type: inferTypeFromName(h),
    unique: h.toLowerCase() === "id",
    nullable: false,
  }));

  return { name: "dataset", columns };
}

function generateValue(
  col: ColumnDefinition,
  prng: Prng,
  rowIndex: number,
  usedUnique: Set<string>,
  context: Record<string, any>
): any {
  // Check nullability (10% chance if nullable and not first 2 rows)
  if (col.nullable && rowIndex > 1 && prng.next() < 0.1) {
    return null;
  }

  // Check default value
  if (col.defaultValue !== undefined && prng.next() < 0.15) {
    return col.defaultValue;
  }

  // Check enum values
  if (col.enum && col.enum.length > 0) {
    return prng.pick(col.enum);
  }

  let val: any;
  let attempts = 0;

  do {
    switch (col.type) {
      case "uuid":
        val = prng.uuid();
        break;
      case "firstName":
        val = prng.pick(FIRST_NAMES);
        break;
      case "lastName":
        val = prng.pick(LAST_NAMES);
        break;
      case "name": {
        const f = prng.pick(FIRST_NAMES);
        const l = prng.pick(LAST_NAMES);
        val = `${f} ${l}`;
        break;
      }
      case "email": {
        const f = (context.first_name || context.firstName || prng.pick(FIRST_NAMES)).toLowerCase();
        const l = (context.last_name || context.lastName || prng.pick(LAST_NAMES)).toLowerCase();
        const num = col.unique ? rowIndex + 1 : prng.int(10, 99);
        val = `${f}.${l}${num}@${prng.pick(DOMAINS)}`;
        break;
      }
      case "number":
        val = col.unique ? rowIndex + 1 : prng.int(1, 1000);
        break;
      case "price":
        val = parseFloat((prng.int(10, 500) + prng.int(0, 99) / 100).toFixed(2));
        break;
      case "boolean":
        val = prng.next() > 0.5;
        break;
      case "date": {
        const pastDays = prng.int(1, 180);
        const d = new Date(Date.now() - pastDays * 86400000);
        val = d.toISOString();
        break;
      }
      case "status":
        val = prng.pick(STATUSES);
        break;
      case "role":
        val = prng.pick(ROLES);
        break;
      case "city":
        val = prng.pick(CITIES);
        break;
      case "country":
        val = prng.pick(COUNTRIES);
        break;
      case "sku":
        val = `${prng.pick(PRODUCT_PREFIXES).toUpperCase().slice(0, 3)}-${col.unique ? (1000 + rowIndex) : prng.int(1000, 9999)}`;
        break;
      case "phone":
        val = `+1-555-${prng.int(100, 999)}-${(1000 + rowIndex)}`;
        break;
      default:
        val = "mock_value";
    }
    attempts++;
  } while (col.unique && usedUnique.has(`${col.name}:${val}`) && attempts < 10);

  if (col.unique) {
    usedUnique.add(`${col.name}:${val}`);
  }

  return val;
}

function escapeSqlValue(val: any, dialect: SqlDialect = "postgresql"): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") {
    if (dialect === "mysql") return val ? "1" : "0";
    return val ? "TRUE" : "FALSE";
  }
  if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function quoteIdentifier(id: string, dialect: SqlDialect = "postgresql"): string {
  if (dialect === "mysql") return `\`${id}\``;
  if (dialect === "postgresql") return `"${id}"`;
  return id;
}

function recordsToCsv(records: Record<string, any>[]): string {
  if (records.length === 0) return "";
  const columns = Object.keys(records[0]);
  const header = columns.join(",");
  const rows = records.map(r =>
    columns.map(c => {
      const val = r[c];
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",")
  );
  return [header, ...rows].join("\n");
}

export function generateMockDataset(options: MockDataOptions = {}): MockDatasetResult {
  const {
    template = "users",
    count = 10,
    format = "json",
    tableName = template,
    dialect = "postgresql",
    customSchema,
    jsonSchema,
    sqlDdl,
    csvHeaders,
    seed,
  } = options;

  // Strict validation of row count
  if (count < 1 || count > 5000) {
    throw new Error(`Requested row count out of bounds (${count}). Must be between 1 and 5000.`);
  }

  // Parse schema if provided
  let schema: TableSchema;
  if (jsonSchema) {
    schema = parseJsonSchema(jsonSchema);
  } else if (sqlDdl) {
    schema = parseSqlDdl(sqlDdl);
  } else if (csvHeaders) {
    schema = parseCsvHeaders(csvHeaders);
  } else if (template === "custom" && customSchema) {
    schema = {
      name: tableName,
      columns: Object.entries(customSchema).map(([col, type]) => ({
        name: col,
        type,
        unique: col.toLowerCase() === "id",
      })),
    };
  } else if (template === "products") {
    schema = {
      name: tableName === "products" ? "products" : tableName,
      columns: [
        { name: "id", type: "uuid", unique: true },
        { name: "sku", type: "sku", unique: true },
        { name: "title", type: "name" },
        { name: "category", type: "status", enum: CATEGORIES },
        { name: "price", type: "price" },
        { name: "stock", type: "number" },
        { name: "in_stock", type: "boolean" },
      ],
    };
  } else if (template === "orders") {
    schema = {
      name: tableName === "orders" ? "orders" : tableName,
      columns: [
        { name: "id", type: "uuid", unique: true },
        { name: "order_number", type: "sku", unique: true },
        { name: "customer_email", type: "email" },
        { name: "total", type: "price" },
        { name: "status", type: "status", enum: ORDER_STATUSES },
        { name: "payment_method", type: "status", enum: PAYMENT_METHODS },
        { name: "items_count", type: "number" },
        { name: "created_at", type: "date" },
      ],
    };
  } else {
    // Default: users
    schema = {
      name: tableName === "users" ? "users" : tableName,
      columns: [
        { name: "id", type: "uuid", unique: true },
        { name: "first_name", type: "firstName" },
        { name: "last_name", type: "lastName" },
        { name: "name", type: "name" },
        { name: "email", type: "email", unique: true },
        { name: "role", type: "role", enum: ROLES },
        { name: "status", type: "status", enum: STATUSES },
        { name: "created_at", type: "date" },
      ],
    };
  }

  const prng = new Prng(seed);
  const usedUnique = new Set<string>();
  const records: Record<string, any>[] = [];

  for (let i = 0; i < count; i++) {
    const row: Record<string, any> = {};
    for (const col of schema.columns) {
      row[col.name] = generateValue(col, prng, i, usedUnique, row);
    }
    records.push(row);
  }

  const jsonStr = JSON.stringify(records, null, 2);
  const csvStr = recordsToCsv(records);

  let sqlStr: string | undefined;
  if (format === "sql" || options.tableName || sqlDdl) {
    const effectiveTable = schema.name || tableName;
    const columns = schema.columns.map(c => c.name);
    const colList = columns.map(c => quoteIdentifier(c, dialect)).join(", ");
    const valueRows = records.map(r => {
      const rowVals = columns.map(c => escapeSqlValue(r[c], dialect)).join(", ");
      return `  (${rowVals})`;
    });
    sqlStr = `INSERT INTO ${quoteIdentifier(effectiveTable, dialect)} (${colList})\nVALUES\n${valueRows.join(",\n")};`;
  }

  return {
    data: records,
    json: jsonStr,
    sql: sqlStr,
    csv: csvStr,
    count: records.length,
  };
}
