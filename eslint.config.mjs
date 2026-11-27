import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "out/**",
      "dist/**",
      "node_modules/**",
      "packages/codestation-mcp/dist/**",
      "packages/codestation-mcp/bin/**",
      "bin/**",
      "public/pdfjs/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      "cloudflare-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
];

export default eslintConfig;
