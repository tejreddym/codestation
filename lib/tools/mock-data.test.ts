import { describe, it, expect } from "vitest";
import { generateMockDataset, parseJsonSchema, parseSqlDdl, parseCsvHeaders } from "./mock-data";

describe("generateMockDataset", () => {
  it("generates user dataset with UUIDs and emails", () => {
    const res = generateMockDataset({ template: "users", count: 5 });
    expect(res.count).toBe(5);
    expect(res.data.length).toBe(5);
    expect(res.data[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(res.data[0].email).toContain("@");
    expect(res.data[0].role).toBeDefined();
  });

  it("generates SQL INSERT statements across dialects", () => {
    const resPg = generateMockDataset({
      template: "products",
      count: 3,
      format: "sql",
      tableName: "catalog_items",
      dialect: "postgresql",
    });
    expect(resPg.sql).toContain('INSERT INTO "catalog_items"');
    expect(resPg.sql).toContain('"sku", "title", "category"');

    const resMysql = generateMockDataset({
      template: "products",
      count: 2,
      format: "sql",
      tableName: "products",
      dialect: "mysql",
    });
    expect(resMysql.sql).toContain("INSERT INTO `products`");
  });

  it("generates CSV output correctly", () => {
    const res = generateMockDataset({
      template: "users",
      count: 3,
      format: "csv",
    });
    expect(res.csv).toBeDefined();
    const lines = res.csv!.split("\n");
    expect(lines.length).toBe(4); // 1 header + 3 rows
    expect(lines[0]).toContain("id,first_name,last_name,name,email");
  });

  it("parses JSON Schema input with enums and defaults", () => {
    const jsonSchema = {
      title: "accounts",
      properties: {
        id: { type: "string", format: "uuid" },
        tier: { type: "string", enum: ["starter", "pro", "enterprise"] },
        balance: { type: "number", format: "price" },
        is_active: { type: "boolean", default: true },
      },
      required: ["id", "tier"],
    };
    const res = generateMockDataset({
      jsonSchema,
      count: 4,
      format: "json",
      seed: 99,
    });
    expect(res.data.length).toBe(4);
    for (const row of res.data) {
      expect(["starter", "pro", "enterprise"]).toContain(row.tier);
      expect(row.balance === null || typeof row.balance === "number").toBe(true);
    }
  });

  it("parses SQL DDL input", () => {
    const ddl = `
      CREATE TABLE customers (
        id UUID PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        contact_email VARCHAR(255) UNIQUE,
        orders_count INT,
        is_verified BOOLEAN NOT NULL
      );
    `;
    const res = generateMockDataset({
      sqlDdl: ddl,
      count: 3,
      format: "sql",
    });
    expect(res.data.length).toBe(3);
    expect(res.sql).toContain('INSERT INTO "customers"');
    expect(res.sql).toContain('"id", "full_name", "contact_email", "orders_count", "is_verified"');
  });

  it("parses CSV header input", () => {
    const res = generateMockDataset({
      csvHeaders: "id,first_name,last_name,email,age",
      count: 5,
    });
    expect(res.data.length).toBe(5);
    expect(res.data[0].id).toBeDefined();
    expect(res.data[0].email).toContain("@");
  });

  it("produces deterministic results with seed", () => {
    const run1 = generateMockDataset({ template: "users", count: 3, seed: 42 });
    const run2 = generateMockDataset({ template: "users", count: 3, seed: 42 });
    expect(run1.json).toEqual(run2.json);
  });

  it("rejects oversized row request safely", () => {
    expect(() => generateMockDataset({ count: 10000 })).toThrow(/out of bounds/);
    expect(() => generateMockDataset({ count: 0 })).toThrow(/out of bounds/);
  });
});
