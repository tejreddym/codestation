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

export interface MockDataOptions {
  template?: MockTemplate;
  count?: number;
  format?: "json" | "sql";
  tableName?: string;
  customSchema?: Record<string, MockFieldType>;
  seed?: number;
}

// Simple Linear Congruential Generator for reproducible pseudo-random numbers
class Prng {
  private state: number;

  constructor(seed?: number) {
    this.state = seed !== undefined ? seed : Math.floor(Math.random() * 2147483647);
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

function generateFieldValue(type: MockFieldType, prng: Prng, context: Record<string, any>): any {
  switch (type) {
    case "uuid":
      return prng.uuid();
    case "firstName":
      return prng.pick(FIRST_NAMES);
    case "lastName":
      return prng.pick(LAST_NAMES);
    case "name": {
      const f = prng.pick(FIRST_NAMES);
      const l = prng.pick(LAST_NAMES);
      return `${f} ${l}`;
    }
    case "email": {
      const f = (context.firstName || prng.pick(FIRST_NAMES)).toLowerCase();
      const l = (context.lastName || prng.pick(LAST_NAMES)).toLowerCase();
      const num = prng.int(10, 99);
      const domain = prng.pick(DOMAINS);
      return `${f}.${l}${num}@${domain}`;
    }
    case "number":
      return prng.int(1, 1000);
    case "price":
      return parseFloat((prng.int(10, 500) + prng.int(0, 99) / 100).toFixed(2));
    case "boolean":
      return prng.next() > 0.5;
    case "date": {
      const pastDays = prng.int(1, 180);
      const d = new Date(Date.now() - pastDays * 24 * 60 * 60 * 1000);
      return d.toISOString();
    }
    case "status":
      return prng.pick(STATUSES);
    case "role":
      return prng.pick(ROLES);
    case "city":
      return prng.pick(CITIES);
    case "country":
      return prng.pick(COUNTRIES);
    case "sku": {
      const prefix = prng.pick(PRODUCT_PREFIXES).toUpperCase().slice(0, 3);
      return `${prefix}-${prng.int(1000, 9999)}`;
    }
    case "phone":
      return `+1-555-${prng.int(100, 999)}-${prng.int(1000, 9999)}`;
    default:
      return "mock_value";
  }
}

function escapeSqlValue(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

export function generateMockDataset(options: MockDataOptions = {}): {
  data: Record<string, any>[];
  json: string;
  sql?: string;
  count: number;
} {
  const {
    template = "users",
    count = 10,
    format = "json",
    tableName = template,
    customSchema,
    seed,
  } = options;

  const validCount = Math.max(1, Math.min(count, 1000));
  const prng = new Prng(seed);
  const records: Record<string, any>[] = [];

  for (let i = 0; i < validCount; i++) {
    const row: Record<string, any> = {};

    if (template === "users") {
      const first = prng.pick(FIRST_NAMES);
      const last = prng.pick(LAST_NAMES);
      row.id = prng.uuid();
      row.first_name = first;
      row.last_name = last;
      row.name = `${first} ${last}`;
      row.email = `${first.toLowerCase()}.${last.toLowerCase()}${prng.int(10, 99)}@${prng.pick(DOMAINS)}`;
      row.role = prng.pick(ROLES);
      row.status = prng.pick(STATUSES);
      row.created_at = new Date(Date.now() - prng.int(1, 180) * 86400000).toISOString();
    } else if (template === "products") {
      const pName = `${prng.pick(PRODUCT_PREFIXES)} ${prng.pick(PRODUCT_NOUNS)}`;
      row.id = prng.uuid();
      row.sku = `SKU-${prng.int(1000, 9999)}`;
      row.title = pName;
      row.category = prng.pick(CATEGORIES);
      row.price = parseFloat((prng.int(19, 499) + 0.99).toFixed(2));
      row.stock = prng.int(0, 250);
      row.in_stock = row.stock > 0;
    } else if (template === "orders") {
      row.id = prng.uuid();
      row.order_number = `ORD-${prng.int(10000, 99999)}`;
      row.customer_email = `${prng.pick(FIRST_NAMES).toLowerCase()}@${prng.pick(DOMAINS)}`;
      row.total = parseFloat((prng.int(25, 1200) + prng.int(0, 99) / 100).toFixed(2));
      row.status = prng.pick(ORDER_STATUSES);
      row.payment_method = prng.pick(PAYMENT_METHODS);
      row.items_count = prng.int(1, 8);
      row.created_at = new Date(Date.now() - prng.int(1, 90) * 86400000).toISOString();
    } else if (template === "custom" && customSchema) {
      for (const [col, colType] of Object.entries(customSchema)) {
        row[col] = generateFieldValue(colType, prng, row);
      }
    } else {
      // Default fallback
      row.id = prng.uuid();
      row.name = `${prng.pick(FIRST_NAMES)} ${prng.pick(LAST_NAMES)}`;
    }

    records.push(row);
  }

  const jsonStr = JSON.stringify(records, null, 2);

  let sqlStr: string | undefined;
  if (format === "sql" || options.tableName) {
    if (records.length > 0) {
      const columns = Object.keys(records[0]);
      const colList = columns.join(", ");
      const valueRows = records.map((r) => {
        const rowVals = columns.map((c) => escapeSqlValue(r[c])).join(", ");
        return `  (${rowVals})`;
      });
      sqlStr = `INSERT INTO ${tableName} (${colList})\nVALUES\n${valueRows.join(",\n")};`;
    }
  }

  return {
    data: records,
    json: jsonStr,
    sql: sqlStr,
    count: records.length,
  };
}
