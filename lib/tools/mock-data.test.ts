import { describe, it, expect } from "vitest";
import { generateMockDataset } from "./mock-data";

describe("generateMockDataset", () => {
  it("generates user dataset with UUIDs and emails", () => {
    const res = generateMockDataset({ template: "users", count: 5 });
    expect(res.count).toBe(5);
    expect(res.data.length).toBe(5);
    expect(res.data[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(res.data[0].email).toContain("@");
    expect(res.data[0].role).toBeDefined();
  });

  it("generates SQL INSERT statements", () => {
    const res = generateMockDataset({
      template: "products",
      count: 3,
      format: "sql",
      tableName: "catalog_items",
    });
    expect(res.sql).toBeDefined();
    expect(res.sql).toContain("INSERT INTO catalog_items");
    expect(res.sql).toContain("sku, title, category, price, stock, in_stock");
  });

  it("generates custom schema accurately", () => {
    const res = generateMockDataset({
      template: "custom",
      count: 4,
      customSchema: {
        id: "uuid",
        fullName: "name",
        userEmail: "email",
        walletBalance: "price",
        isActive: "boolean",
      },
    });
    expect(res.data.length).toBe(4);
    expect(res.data[0].fullName).toBeDefined();
    expect(typeof res.data[0].walletBalance).toBe("number");
    expect(typeof res.data[0].isActive).toBe("boolean");
  });

  it("produces deterministic results with seed", () => {
    const run1 = generateMockDataset({ template: "users", count: 3, seed: 42 });
    const run2 = generateMockDataset({ template: "users", count: 3, seed: 42 });
    expect(run1.json).toEqual(run2.json);
  });
});
