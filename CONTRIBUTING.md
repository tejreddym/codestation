# Contributing to Code Station

Thank you for your interest in contributing to **Code Station**! We welcome bug fixes, documentation improvements, accessibility enhancements, and new 100% browser-side developer tools.

Please read [`AGENTS.md`](AGENTS.md) and [`PROJECT_STATUS.md`](PROJECT_STATUS.md) alongside this guide to align with repository conventions.

---

## Local Development Setup

### Prerequisites

- **Node.js:** `>=22.13.0 <23` (validated with `22.19.0`, pinned in [`.nvmrc`](.nvmrc))
- **npm:** `10.x` (validated with `10.9.3`)

If you use `nvm`:

```bash
nvm use
```

### Install & Run Locally

```bash
npm ci
npm run dev
```

> `npm ci` runs the `postinstall` script (`scripts/copy-pdfjs-assets.mjs`) to stage self-hosted PDF.js worker, cmaps, and standard font assets into `public/pdfjs/`.

If local environment configuration is needed, copy `.env.example` to `.env.local` and keep any secrets out of version control.

---

## Verification Checks

Before opening a pull request, run the full local verification suite:

```bash
# 1. Code style and lint checks (completes with existing repo warnings; introduce no new errors)
npm run lint

# 2. UI design token audit (must pass with 0 errors)
npm run audit:ui

# 3. Strict TypeScript type checking
npm run typecheck

# 4. Unit, component, and registry contract test suite
npm test

# 5. Production build + offline manifest (stop any running dev/start server using `.next` first!)
npm run build
```

You can preview the finished production build locally on a custom port with:

```bash
npm run start -- -p 3001
```

---

## Proposing or Adding a New Tool

Before writing a brand-new tool, please open a [Tool Request issue](.github/ISSUE_TEMPLATE/tool_request.yml) so we can align on scope, naming, and station placement.

### Core Architectural Rules

1. **100% Browser-Side Processing:** Tools must execute locally in the browser using pure helpers in `lib/tools/`. Do not upload inputs, store user payloads remotely, add analytics, or use `eval`/arbitrary script execution.
2. **Strict Slug Conventions:** Tool `id` must equal `slug` in lowercase `kebab-case` (e.g., `zip-extractor`), match its canonical route (`/tools/[slug]`), pair with the WebMCP identifier `codestation_[snake_case_slug]`, and expose `data-webmcp-slug`.
3. **Design System:** Preserve the warm Tactile Technical tokens defined in [`app/styles/tokens.css`](app/styles/tokens.css) and [`app/globals.css`](app/globals.css). Run `npm run audit:ui` to verify token compliance.
4. **Converter Rules:** If adding or modifying a converter tool, follow [`docs/SMART_CONVERTER_STANDARD.md`](docs/SMART_CONVERTER_STANDARD.md).

### Implementing with `lib/engine/`

Code Station's canonical tool contract and runtime live under `lib/engine/`:

1. **Define Your Processing Helper (`lib/tools/<station>/`):**
   - Implement pure, framework-free TypeScript processing functions and thorough Vitest unit tests.
2. **Adopt the Canonical Contract (`lib/engine/types.ts`):**
   - Define a `ToolDefinition` (strongly typed `ToolInput` and `ToolOutput` schemas, `processing: "local"`, `offlineSupported: true`) and a `ToolEngine` implementing `validate()` (returning `ValidationResult`) and `process()` (returning `ToolResult` with `durationMs`, MIME type, and cleanup).
   - Use `lib/engine/runtime.ts`, `lib/engine/blobRegistry.ts` (leak-free `ObjectURL` cleanup), `lib/engine/workerRunner.ts` (for heavy tasks), and `lib/engine/useToolEngine.ts` (React lifecycle hook), or wrap declarative station configs via `adaptToolToEngine` in `lib/engine/adapters/registryAdapter.ts`.
   - Use `describeToolContract()` in `lib/engine/__tests__/contractHarness.ts` to test contract compliance.
3. **Register Metadata, Station UI & WebMCP:**
   - Add tool metadata, keywords, and SEO/FAQ details in the station config (`config/<station>-tools.ts`) and ensure it is exported in `config/tools.ts`.
   - Wire the UI component in `components/ToolWorkspace.tsx` (and the station component if applicable) using accessible, responsive controls from `components/ui/`.
   - Register the tool execution handler in `lib/webmcp/dispatcher.ts` so `document.modelContext` (`WebMcpBridge`) and `lib/engine/mcpBridge.ts` expose it cleanly.
4. **Update Directory, Counts & Docs:**
   - If adding a station or updating counts, keep `config/stations.ts`, `app/home-metadata.ts`, `components/HomeSearch.tsx`, `components/DocsRepo.tsx`, `public/llms.txt`, `tests/engine/registryContract.test.ts`, and `lib/engine/__tests__/e2e/contract.e2e.test.ts` synchronized.
   - Update `PROJECT_STATUS.md`, `HANDOFF.md`, `TODO.md`, and `CHANGELOG.md` as appropriate.
