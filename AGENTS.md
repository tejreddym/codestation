# Agent Guidance

## Project

Code Station is a browser-first developer toolbox built with Next.js 15 App Router, React 19, and strict TypeScript. The public brand is **Code Station**. The workspace contains an implemented app; it is not an empty scaffold. As of 2026-10-02 there is no Git repository here, so do not claim a branch or commit exists.

## Working rules

- Preserve the documented scope and keep changes small and reviewable.
- Do not add application code, dependencies, generated files, or configuration without an explicit task.
- Preserve the warm Tactile Technical tokens in `app/globals.css` and the illustrated theme toggle.
- Use accessible, responsive, tool-specific controls; avoid ignored generic inputs.
- Keep secrets out of source control; update `.env.example` when environment variables are introduced.
- Update `PROJECT_STATUS.md`, `TODO.md`, `CHANGELOG.md`, and relevant docs as the project evolves.
- Process inputs in the browser; do not add uploads, analytics payloads, or input persistence. No `eval`, arbitrary scripts, or server URL proxies.
- Follow strict tool slug conventions identical to previous tools: Tool definition `id` must equal `slug` (in lowercase kebab-case, e.g. `zip-extractor`), match its canonical route (`/tools/[slug]`), pair with WebMCP identifiers (`codestation_[snake_case_slug]`), and match `data-webmcp-slug`. Do not invent prefixes or vary slugs across configs, routers, or tests.
- All current and future tools must provide WebMCP (`document.modelContext`) support and adhere to comprehensive SEO, AEO, and GEO standards (detailed below).

## Verification

Use Node 22.13+ (validated with 22.19.0) and `npm ci`.

- `npm run dev` — local Next server
- `npm test` — Vitest helpers plus jsdom component tests
- `npm run typecheck` — TypeScript
- `npm run build` — production build
- `npm run lint` — completes with existing warnings; it is not a clean lint pass

Do not build into `.next` while a dev or production server is using it. Previous simultaneous builds caused missing-chunk errors. Stop the relevant server before rebuilding; do not delete generated output under an active process.

## Repository map

- `README.md` — setup and contribution orientation
- `PROJECT_STATUS.md` — current state and known gaps
- `HANDOFF.md` — resumable work context
- `TODO.md` — prioritized next steps
- `docs/` — architecture, decisions, and session history
- `config/tools.ts` — central metadata registry; combines legacy IDs and station catalogs
- `config/date-time-tools.ts` — 17 exact Date & Time contracts, typed IDs and directional pairing
- `app/tools/[slug]/page.tsx` — registry-driven routes, existing metadata
- `components/ToolWorkspace.tsx` — lazy client boundary; new Date & Time tools are isolated from the legacy workbench
- `components/DateTimeStation.tsx` — specialized date/time controls and local result actions
- `lib/tools/` — processing helpers and unit tests; `workers/` — local worker execution
- `lib/webmcp/` — WebMCP browser-native registry (`document.modelContext`), tool dispatcher, and AI agent execution interfaces
- `components/WebMcpBridge.tsx` — client lifecycle component registering active tool contracts into WebMCP

Read `PROJECT_STATUS.md` and `HANDOFF.md` first. Check the real files rather than relying on historical tool counts. Public Date & Time tools use exact contracts, explicit units, Gregorian years 0001–9999 and runtime IANA rules; DST gaps and folds both fail rather than silently choosing an instant. Business days use selected weekends and explicit holiday dates with inclusive endpoints. See `docs/DATE_TIME_STATION.md` for conventions. Existing stations still have conformance/UX debt; passing the build does not establish every tool's correctness.

Before implementing or modifying converter tools in any station, read and follow `docs/SMART_CONVERTER_STANDARD.md`. Applicable converters must use the shared capability registry, preserve compatible source input in client memory across output changes, synchronize directional routes and page metadata, invalidate stale outputs, and expose only genuinely supported conversions. Keep non-converter tools specialized.

All station landing pages must use the shared station layout and follow `docs/STATION_PAGE_STANDARD.md`. Derive tools, counts, search, and navigation from authoritative registries. Preserve canonical tool identities and existing converter-session behavior.

UI enhancements must preserve control types, validation, event behavior, routes, and tool/session state. Use the shared visual tokens and components. Functional changes require a separate task.

## WebMCP, SEO, AEO & GEO Standards for Tools

All existing and newly created tools must satisfy the following architectural standards:

### 1. WebMCP (Web Model Context Protocol) Integration
- **Browser-Native In-Page Tool Registry**: Every tool must be registered with the WebMCP bridge in `lib/webmcp/` and dynamically mounted on `document.modelContext` / `navigator.modelContext`.
- **Pure Client Execution**: The tool's `execute` handler must invoke client-side processing functions in `lib/tools/` with zero server uploads, tracking, or network roundtrips.
- **Structured Contracts**: Define a clear machine-readable tool name (e.g. `codestation_tool_slug`), concise natural-language description, JSON input schema, and standardized text content output.

### 2. Search Engine Optimization (SEO)
- **Metadata & Canonicalization**: Each tool must have an explicit canonical route (`/tools/[slug]`), unique title template, descriptive meta description, and keywords registered in `config/tools.ts`.
- **Sitemap & Robots Directives**: Derived automatically through site config and static route generation.
- **Semantic Hierarchy**: Semantic `<main>`, `<section>`, breadcrumbs, and exact `<h1>` tool headings.

### 3. Answer Engine Optimization (AEO)
- **Direct Factual Headings**: Include explicit `<h2>What does this tool do?</h2>` and `<h2>How to use it?</h2>` sections with concise, high-signal definitions suitable for featured snippet extraction by Perplexity, Google AI Overviews, and Bing.
- **Step-by-Step Instructions**: Actionable steps formatted cleanly for programmatic parsing.
- **Structured FAQPage Schema**: Inject `FAQPage` JSON-LD schemas covering tool purpose, client-side privacy guarantees, and AI agent interoperability.

### 4. Generative Engine Optimization (GEO)
- **High-Density JSON-LD**: Provide `SoftwareApplication` / `WebApplication` schemas complete with `applicationCategory`, `applicationSubCategory`, `operatingSystem: "All (Web Browser)"`, `browserRequirements: "Requires JavaScript. 100% In-Browser. Zero Server Uploads."`, and free tier zero-price offers.
- **Structured HowTo Schema**: Provide machine-readable `HowTo` structured data with explicit steps and inputs/outputs.
- **Declarative Agent Attributes**: Tool workspace sections must carry semantic DOM annotations (`data-webmcp-tool`, `data-webmcp-category`, `data-webmcp-slug`) for direct discovery by LLM web agents.

