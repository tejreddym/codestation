import { describe, expect, it } from "vitest";
import {
  jsonToGo,
  jsonToPydantic,
  jsonToRust,
  jsonToTypescript,
  jsonToZod,
  sqlToTypescript,
  htmlToJsx,
  svgToJsx,
} from "./engine";

describe("code generation engine", () => {
  const sampleJson = JSON.stringify({
    id: 101,
    name: "Ada Lovelace",
    is_active: true,
    score: 98.5,
    tags: ["math", "computing"],
    meta: { level: 5 },
  });

  describe("jsonToTypescript & jsonToZod", () => {
    it("converts JSON to TypeScript interface", () => {
      const ts = jsonToTypescript(sampleJson, "User");
      expect(ts).toContain("export interface User");
      expect(ts).toContain("id: number;");
      expect(ts).toContain("name: string;");
      expect(ts).toContain("is_active: boolean;");
    });

    it("converts JSON to Zod schema", () => {
      const zod = jsonToZod(sampleJson, "userSchema");
      expect(zod).toContain('import { z } from "zod";');
      expect(zod).toContain("export const userSchema = z.object({");
      expect(zod).toContain("name: z.string()");
    });
  });

  describe("jsonToGo", () => {
    it("generates Go structs with tags", () => {
      const go = jsonToGo(sampleJson, "User");
      expect(go).toContain("type User struct {");
      expect(go).toContain('ID int64 `json:"id"`');
      expect(go).toContain('Name string `json:"name"`');
      expect(go).toContain('IsActive bool `json:"is_active"`');
      expect(go).toContain('Score float64 `json:"score"`');
      expect(go).toContain('Tags []string `json:"tags"`');
    });

    it("handles arrays of objects in Go", () => {
      const go = jsonToGo(JSON.stringify([{ id: 1, name: "test" }]), "Users");
      expect(go).toContain("type UsersItem struct {");
      expect(go).toContain("type Users = []UsersItem");
    });
  });

  describe("jsonToPydantic", () => {
    it("generates Python Pydantic v2 models", () => {
      const py = jsonToPydantic(sampleJson, "User");
      expect(py).toContain("from pydantic import BaseModel, Field");
      expect(py).toContain("class User(BaseModel):");
      expect(py).toContain("id: int");
      expect(py).toContain('is_active: bool');
      expect(py).toContain("score: float");
      expect(py).toContain("tags: List[str]");
    });
  });

  describe("jsonToRust", () => {
    it("generates Rust structs with Serde annotations", () => {
      const rust = jsonToRust(sampleJson, "User");
      expect(rust).toContain("use serde::{Deserialize, Serialize};");
      expect(rust).toContain("pub struct User {");
      expect(rust).toContain("pub id: i64,");
      expect(rust).toContain("pub name: String,");
      expect(rust).toContain("pub is_active: bool,");
    });
  });

  describe("sqlToTypescript", () => {
    it("parses CREATE TABLE statements into TypeScript interfaces", () => {
      const ddl = `
        CREATE TABLE users (
          id INT PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          bio TEXT,
          is_admin BOOLEAN NOT NULL,
          created_at TIMESTAMP NOT NULL
        );
      `;
      const ts = sqlToTypescript(ddl);
      expect(ts).toContain("export interface Users {");
      expect(ts).toContain("id: number;");
      expect(ts).toContain("email: string;");
      expect(ts).toContain("bio: string | null;");
      expect(ts).toContain("is_admin: boolean;");
      expect(ts).toContain("created_at: Date | string;");
    });

    it("throws when no table definition found", () => {
      expect(() => sqlToTypescript("SELECT * FROM users;")).toThrow(/CREATE TABLE/);
    });
  });

  describe("htmlToJsx", () => {
    it("converts class, for, inline style, and self-closing tags", () => {
      const html = `<div class="container" for="input1" style="background-color: red; font-size: 16px"><img src="logo.png"></div>`;
      const jsx = htmlToJsx(html);
      expect(jsx).toContain('className="container"');
      expect(jsx).toContain('htmlFor="input1"');
      expect(jsx).toContain('style={{ backgroundColor: "red", fontSize: "16px" }}');
      expect(jsx).toContain('<img src="logo.png" />');
    });

    it("replaces HTML comments with JSX comment", () => {
      const html = `<!-- Banner section --><div>Content</div>`;
      const jsx = htmlToJsx(html);
      expect(jsx).toContain("{/* Banner section */}");
    });
  });

  describe("svgToJsx", () => {
    it("converts SVG string into a typed React component", () => {
      const svg = `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle></svg>`;
      const component = svgToJsx(svg, "CheckIcon");
      expect(component).toContain("export function CheckIcon(props: React.SVGProps<SVGSVGElement>)");
      expect(component).toContain("strokeWidth=\"2\"");
      expect(component).toContain("strokeLinecap=\"round\"");
      expect(component).toContain("{...props}");
      expect(component).toContain("<circle cx=\"12\" cy=\"12\" r=\"10\" />");
    });
  });
});
