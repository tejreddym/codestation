# Project Status

**Updated:** 2026-11-27 · **Baseline:** **383 browser tools** across **30 stations** · **Companion MCP:** `codestation-mcp` v1.2.1

## Implemented Platform Summary

- **Browser-First Toolbox (`codestation.in`):** Next.js 15 App Router, React 19, strict TypeScript, deployed to Cloudflare Workers via `@opennextjs/cloudflare`.
- **30 Implemented Stations & 383 Registered Tools:** JSON & Data (47), Encoding (35), Text (31), Image (28), Security & Crypto (23), Web (21), Spreadsheet (20), Markdown (18), Date & Time (17), SQL & Database (17), API (17), PDF (13, including self-hosted `pdfjs-dist@6.5.438` and `pdf-compressor`), Regex (9), Color & CSS (7), Git & Version Control (7 owned + shared `gitignore-generator`), Cron (6), Code Generation (8), Network & DevOps (8), Frontend & CSS (6), Developer Math (7), Compression & Archives (5), WebPKI & Advanced Cryptography, AI & Prompt Engineering, Policy Generators (5), QR & Barcode (3), Audio (1), Video (2: `video-thumbnail-generator` with Canva-style overlay studio + `video-trimmer`), Finance & Calculators (4), Productivity (2: `pomodoro-timer` + `invoice-generator`), and Converters discovery hub.
- **Canonical Engine & WebMCP Protocol:** Unified declarative contracts in `lib/engine/` (`ToolDefinition`, `ToolEngine`, `BlobUrlRegistry`, `workerRunner`, `useToolEngine`, `registryAdapter`) + browser-native WebMCP (`document.modelContext` via `components/WebMcpBridge.tsx` and `lib/webmcp/dispatcher.ts`).
- **SEO / AEO / GEO & Offline Manifest:** Origin-guarded canonical URLs/OG/Twitter/sitemap (`SITE_INDEXING=index` required both at build and runtime on Workers), JSON-LD (`WebSite`, `WebApplication`, `FAQPage`, `SoftwareApplication`, `HowTo`), `public/llms.txt`, and build-time generated `public/THIRD_PARTY_NOTICES.md` (`npm run generate:notices`) and `public/offline-assets.json`.
- **Pro Tier & MCP Server (`codestation-mcp`):** Free web tools remain 100% free with zero paywalls. Pro keys support local CLI/MCP tools via Razorpay checkout (`/api/create-order`, `/api/verify-payment`) and SHA-256 hashed license records in Cloudflare KV (`/api/v1/license/*`).
- **Monetization Scaffolding:** Production-only, opt-in Adsterra placements (`NEXT_PUBLIC_ADS_ENABLED` and per-format flags default to `false` in `.env.example`; see `docs/ADVERTISING.md`).

## Core Invariants & Constraints

1. **Client-Side Privacy:** Tools process data locally in browser memory or abortable Web Workers with zero uploads or telemetry. Documented exceptions: explicit `Send Request` in `api-request-tester` (direct browser fetch, `credentials: omit`, masked credentials) and safe remote image previews in Markdown.
2. **Strict Slug Rules:** Tool `id === slug` in lowercase `kebab-case`, route `/tools/[slug]`, WebMCP `codestation_[snake_case_slug]`, and DOM `data-webmcp-slug`.
3. **Date/Time & Converter Rules:** Date & Time covers Gregorian years `0001–9999`, rejects DST gaps/folds explicitly, and requires user-supplied holiday lists. Converters follow `docs/SMART_CONVERTER_STANDARD.md` with memory-only source sessions.
4. **Build Isolation:** Stop any running `next dev` / `next start` / preview server using `.next` before running `npm run build` or OpenNext commands.

## Current Health & Verification Baseline

- **ESLint 9 (`npm run lint -- --max-warnings=0`):** Clean (`eslint.config.mjs`, `0` errors, `0` warnings).
- **UI Token Audit (`npm run audit:ui`):** `0` errors (`26` pre-existing advisory hex/breakpoint warnings).
- **TypeScript (`npm run typecheck`):** Clean (`0` errors).
- **Tests (`npm test`):** `198` files passed, `1` conditional skip (`pdf-compressor.e2e.test.ts`), `6,891` tests passed (`0` failures).
- **Production Build (`npm run build`):** Clean (`438/438` pages, `201` offline assets, generates `public/pdfjs/` and `public/THIRD_PARTY_NOTICES.md`).

## Known Open Gaps

- Live real-browser end-to-end verification (themes, mobile 310/390px overflow checks, cross-browser codecs in Safari/Firefox, real WebMCP host execution, clipboard/download-bytes inspection) remains open for several stations; per-station checklists live under `docs/*_STATION.md`.
- Pre-existing production dependency advisories in `npm audit --omit=dev` (Next/PostCSS, `exceljs`/`uuid`, OpenNext/Wrangler toolchain) require a dedicated, separately tested upgrade task (never run `npm audit fix --force`).
- Owner decisions pending before marketing/ad activation or finalizing legal pages: Adsterra privacy/consent compliance, operator/legal entity & retention facts on `/privacy` and `/terms`, and verified illustrated theme-toggle provenance for `/licenses`.

---

For historical milestone audits (2026-10-02 through 2026-11-16), see [`docs/archive/HISTORICAL_LOGS.md`](docs/archive/HISTORICAL_LOGS.md). For recorded architecture decisions (`D-001`–`D-019`), see [`docs/DECISIONS.md`](docs/DECISIONS.md).
