import { localDefinition, type LocalDefinition, type LocalField } from "./local-contract";

export const extendedToolIds = [
  "curl-to-any-language",
  "env-audit",
  "mock-data",
  "conflict-parse",
] as const;

export type ExtendedToolId = typeof extendedToolIds[number];

export const isExtendedToolId = (id: string): id is ExtendedToolId =>
  (extendedToolIds as readonly string[]).includes(id);

export const extendedTools: readonly LocalDefinition<ExtendedToolId>[] = [
  localDefinition(
    "curl-to-any-language",
    "cURL to Any Language Generator",
    "Developer Tools",
    [
      { name: "curl", label: "cURL command", control: "textarea" },
      {
        name: "target",
        label: "Target language",
        control: "select",
        options: ["TypeScript Fetch", "Axios", "Python Requests", "Go net/http"],
      },
    ],
    ["Generated idiomatic code", "Warnings & notices"],
    {
      curl: 'curl -X POST "https://api.example.com/v1/items" -H "Content-Type: application/json" -H "Authorization: Bearer test-token" -d \'{"name":"Widget","quantity":5}\'',
      target: "TypeScript Fetch",
    },
    [
      "All processing is local. Code Station does not execute shell commands or send network requests.",
      "Authorization tokens and credentials are masked by default to prevent accidental leaks.",
    ],
    "Generate Code"
  ),

  localDefinition(
    "env-audit",
    "Environment & Secret Leak Scanner",
    "Developer Tools",
    [
      { name: "env", label: ".env content", control: "textarea" },
      { name: "example", label: ".env.example content", control: "textarea", optional: true },
    ],
    ["Security report", "Detected secret leaks", "Discrepancy diff"],
    {
      env: "PORT=3000\nDATABASE_URL=postgres://user:pass@localhost:5432/mydb\n# Add your API keys here",
      example: "PORT=3000\nDATABASE_URL=\nAPI_KEY=",
    },
    [
      "Browser-only processing: .env files and secret values never leave your device memory.",
      "Live secrets and sensitive tokens are masked in visual previews.",
    ],
    "Scan for Leaks"
  ),

  localDefinition(
    "mock-data",
    "Realistic Mock Data & SQL Seeder",
    "Developer Tools",
    [
      {
        name: "template",
        label: "Dataset template",
        control: "select",
        options: ["users", "products", "orders", "custom"],
      },
      { name: "count", label: "Record count", control: "number", min: 1, max: 1000 },
      {
        name: "format",
        label: "Output format",
        control: "select",
        options: ["JSON", "SQL", "CSV"],
      },
      { name: "seed", label: "Deterministic seed", control: "number", optional: true },
    ],
    ["Generated dataset", "SQL insert statements", "CSV export"],
    {
      template: "users",
      count: 10,
      format: "JSON",
    },
    [
      "Data generation is synthetic and fictional; no real personal data is ever produced.",
      "Deterministic seeds guarantee reproducible fixtures across test runs.",
    ],
    "Generate Data"
  ),

  localDefinition(
    "conflict-parse",
    "Git Merge Conflict Resolver",
    "Developer Tools",
    [
      { name: "content", label: "File with merge conflict markers", control: "textarea" },
      {
        name: "strategy",
        label: "Resolution strategy",
        control: "select",
        options: ["Analyze only", "Keep Ours (HEAD)", "Keep Theirs (Incoming)", "Keep Both"],
      },
    ],
    ["Conflict hunk analysis", "Resolved content", "Unresolved status"],
    {
      content:
        'function greet(name: string): string {\n<<<<<<< HEAD\n  return `Hello, ${name}!`;\n=======\n  return `Hi there, ${name}!`;\n>>>>>>> feature/friendly\n}',
      strategy: "Analyze only",
    },
    [
      "All conflict parsing is performed in browser memory; no Git repositories or branches are modified.",
      "Conflict markers are only removed upon explicit user confirmation.",
    ],
    "Resolve Conflicts"
  ),
];

export const getExtendedDefinition = (id: string) =>
  extendedTools.find((tool) => tool.id === id);
