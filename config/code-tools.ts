import { localDefinition, type LocalField, type LocalDefinition } from "./local-contract";

export const codeToolIds = [
  "json-to-typescript",
  "json-to-zod",
  "json-to-go",
  "json-to-pydantic",
  "json-to-rust",
  "sql-to-typescript",
  "html-to-jsx",
  "svg-to-jsx",
] as const;

export type CodeToolId = (typeof codeToolIds)[number];

const jsonInput: LocalField = {
  name: "input",
  label: "JSON Input",
  control: "textarea",
};

const rootNameField: LocalField = {
  name: "rootName",
  label: "Root Name / Interface",
  control: "text",
  optional: true,
};

const sqlInput: LocalField = {
  name: "input",
  label: "SQL DDL Input (CREATE TABLE)",
  control: "textarea",
};

const htmlInput: LocalField = {
  name: "input",
  label: "HTML Code Input",
  control: "textarea",
};

const svgInput: LocalField = {
  name: "input",
  label: "SVG Markup Input",
  control: "textarea",
};

const componentNameField: LocalField = {
  name: "componentName",
  label: "Component Name",
  control: "text",
  optional: true,
};

const notice =
  "100% in-browser code and schema generation. Your source code, schema, and JSON data are parsed locally and never sent to any server.";

const define = (
  id: CodeToolId,
  title: string,
  fields: LocalField[],
  outputs: string[],
  defaults: Record<string, unknown> = {},
  extra: string[] = []
): LocalDefinition<CodeToolId> =>
  localDefinition(id, title, "Code Generation", fields, outputs, defaults, [notice, ...extra], "Generate");

export const codeTools: readonly LocalDefinition<CodeToolId>[] = [
  define(
    "json-to-typescript",
    "JSON to TypeScript",
    [jsonInput, rootNameField],
    ["TypeScript Interface / Type definitions"],
    {
      input: '{\n  "id": 1,\n  "name": "Jane Doe",\n  "email": "jane@example.com",\n  "roles": ["admin", "developer"],\n  "active": true\n}',
      rootName: "User",
    }
  ),
  define(
    "json-to-zod",
    "JSON to Zod Schema",
    [jsonInput, rootNameField],
    ["Zod Schema with TypeScript type inference"],
    {
      input: '{\n  "id": 1,\n  "name": "Jane Doe",\n  "email": "jane@example.com",\n  "roles": ["admin"],\n  "active": true\n}',
      rootName: "userSchema",
    }
  ),
  define(
    "json-to-go",
    "JSON to Go Struct",
    [jsonInput, rootNameField],
    ["Idiomatic Go Struct with json tags"],
    {
      input: '{\n  "user_id": 101,\n  "username": "janedoe",\n  "api_token": "secret_abc",\n  "tags": ["prod", "us-east"]\n}',
      rootName: "UserPayload",
    }
  ),
  define(
    "json-to-pydantic",
    "JSON to Python Pydantic",
    [jsonInput, rootNameField],
    ["Python 3.10+ Pydantic v2 BaseModel classes"],
    {
      input: '{\n  "first_name": "Jane",\n  "last_name": "Doe",\n  "age": 28,\n  "verified": true\n}',
      rootName: "UserProfile",
    }
  ),
  define(
    "json-to-rust",
    "JSON to Rust Serde",
    [jsonInput, rootNameField],
    ["Rust Struct with serde derive macros"],
    {
      input: '{\n  "id": 42,\n  "title": "Code Station",\n  "stars": 1250,\n  "open": true\n}',
      rootName: "Repository",
    }
  ),
  define(
    "sql-to-typescript",
    "SQL DDL to TypeScript",
    [sqlInput],
    ["TypeScript interface corresponding to SQL columns"],
    {
      input:
        "CREATE TABLE users (\n  id INT PRIMARY KEY,\n  email VARCHAR(255) NOT NULL,\n  full_name VARCHAR(100),\n  is_active BOOLEAN NOT NULL,\n  created_at TIMESTAMP NOT NULL\n);",
    }
  ),
  define(
    "html-to-jsx",
    "HTML to JSX / TSX",
    [htmlInput],
    ["React JSX with camelCase props and style objects"],
    {
      input:
        '<div class="card" style="padding: 16px; border-radius: 8px;">\n  <h2 class="title">Card Title</h2>\n  <input type="text" placeholder="Enter text" autofocus>\n  <img src="banner.jpg" alt="Banner">\n</div>',
    }
  ),
  define(
    "svg-to-jsx",
    "SVG to React Component",
    [svgInput, componentNameField],
    ["Clean typed React SVG component"],
    {
      input:
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n  <circle cx="12" cy="12" r="10"></circle>\n  <line x1="12" y1="8" x2="12" y2="12"></line>\n  <line x1="12" y1="16" x2="12.01" y2="16"></line>\n</svg>',
      componentName: "AlertCircleIcon",
    }
  ),
];

export const getCodeDefinition = (id: string) => codeTools.find((tool) => tool.id === id);
export const isCodeToolId = (id: string): id is CodeToolId => (codeToolIds as readonly string[]).includes(id);

