import { describe, it, expect } from "vitest";
import { jsonToTypescript, jsonToZod } from "./json-to-types";

describe("JSON to TypeScript & Zod Generator", () => {
  const sampleUser = JSON.stringify({
    id: 123,
    name: "Ada Lovelace",
    active: true,
    address: {
      city: "London",
      postcode: "SW1A 1AA",
    },
    tags: ["math", "computing"],
  });

  it("generates TypeScript interfaces with nested types", () => {
    const ts = jsonToTypescript(sampleUser, "User");
    expect(ts).toContain("export interface User");
    expect(ts).toContain("id: number;");
    expect(ts).toContain("name: string;");
    expect(ts).toContain("active: boolean;");
    expect(ts).toContain("tags: string[];");
    expect(ts).toContain("address: Address;");
    expect(ts).toContain("export interface Address");
    expect(ts).toContain("city: string;");
  });

  it("generates Zod schemas with nested schemas and inferred type", () => {
    const zod = jsonToZod(sampleUser, "userSchema");
    expect(zod).toContain('import { z } from "zod";');
    expect(zod).toContain("export const userSchema = z.object({");
    expect(zod).toContain("id: z.number().int(),");
    expect(zod).toContain("name: z.string(),");
    expect(zod).toContain("active: z.boolean(),");
    expect(zod).toContain("tags: z.array(z.string()),");
    expect(zod).toContain("address: addressSchema,");
    expect(zod).toContain("export type User = z.infer<typeof userSchema>;");
  });

  it("handles array with partial / optional properties", () => {
    const sampleArray = JSON.stringify([
      { name: "Alpha", count: 10 },
      { name: "Beta" }, // count is missing here
    ]);
    const ts = jsonToTypescript(sampleArray, "Item");
    expect(ts).toContain("count?: number;");
    expect(ts).toContain("name: string;");
  });
});
