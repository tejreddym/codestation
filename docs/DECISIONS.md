# Decisions

## D-019 — Shared station pages and evidence-gated site foundations

- **Date:** 2026-10-06.
- **Decision:** Use Cron’s search-and-card treatment as the reference for all 15 implemented station landings. `StationLanding`, `ToolCatalog`, `ToolCard`, and `lib/tool-search.ts` own the common shell, scoped search/filter behavior, counts, empty states, and canonical links; specialized workspaces and converter session boundaries remain unchanged. `config/stations.ts` is an explicit implemented allowlist, so Developer Math stays pending and absent from routes/counts/sitemap.
- **Homepage:** Use registry-derived global search, deliberate quick access, station cards, accurate counts, and a factual processing boundary. Do not add usage statistics, testimonials, accounts, analytics, contact forms, or unsupported privacy claims.
- **Indexing/legal:** Accept production canonical URLs only from a clean HTTPS `NEXT_PUBLIC_SITE_URL` and require `SITE_INDEXING=index`. Missing or unsafe deployment facts default to noindex, disallowing robots guidance, and empty XML sitemap output. Privacy/Terms/Licenses are provisional until operator, contact, hosting/retention, jurisdiction, project-license, and asset-provenance decisions are supplied.
- **Evidence:** The API Request Tester can explicitly send a direct browser request, and Markdown safe previews can request remote images. Notices must disclose these exceptions; no blanket “nothing leaves the device” statement is allowed.

## D-017 — Shared sRGB color model and specialized CSS generators

- **Date:** 2026-10-06.
- **Decision:** Add exactly seven Color & CSS tools using shared HEX/RGB/HSL parsing and alpha-preserving serializers. Do not claim wide-gamut or perceptual color-space support.
- **Contrast:** Use WCAG 2.x text contrast with explicit backdrop/alpha compositing and unrounded threshold evaluation; do not claim overall accessibility compliance.
- **Converters:** Color Converter reuses the existing capability/session architecture. Palette/gradient/shadow/radius tools remain specialized generators with CSS/JSON output actions, not generic converter routes.
- **Privacy:** All values remain in client memory; no content storage, analytics or uploads. Future color tools must reuse `lib/tools/color/engine.ts` rather than introduce inconsistent color models.

## D-018 — Canonical converter discovery and stable numeric routes

- **Date:** 2026-10-06.
- **Decision:** Add `/stations/converters` as a derived discovery surface. Existing converters retain ownership, canonical URLs, metadata, and tool identities; the station stores no copied tool list or alias routes. Search/category cards point back to the central registry identity.
- **Numeric tools:** Add only Unit, Temperature, and Number Base converters. Use stable routes rather than generating unit-pair/base-pair pages. Numeric source/target changes are control-state changes, not public directional routes.
- **Correctness:** Use authoritative unit catalogs with verified international/customary definitions, finite bounded measurement arithmetic with separate display rounding, offset-aware absolute temperature formulas and boundaries, and exact BigInt arithmetic for bases 2–36.
- **Privacy:** Numeric source values and results stay in client memory and never enter URLs, history state, storage, analytics, or network requests.

## D-016 — Shared smart-converter capability and source-session convention

- **Date:** 2026-10-06.
- **Decision:** Genuine converter families use one metadata-only `config/conversion-capabilities.ts` registry for implemented routes, source/target kinds, MIME/extensions, runtime requirements and mapping limitations. It does not eagerly import engines or imply runtime codec availability.
- **State:** `ConverterSessionProvider` lives in the root client tree and holds only original File/text source, validated format, metadata, selected sheet and version in memory. Compatible target navigation preserves that source; Clear/family exit/unmount releases it. Results are separate and invalidated on edits/options/target changes, with stale guards and object URL cleanup.
- **Routing:** Automatic validated source reconciliation replaces the current route; explicit Output Format changes push history. Public directional routes remain separate and page metadata/content come from the destination route. No source contents or File objects enter URLs/history/storage/analytics.
- **Evidence/gaps:** Registry/session and affected Image/Spreadsheet/JSON/Markdown suites pass. Final typecheck,5,208 tests/74 files, lint with warnings only, production build and HTTP route smoke pass. Live route-boundary source preservation, inspected downloads, Back/Forward, responsive/theme, console and network checks remain NOT VERIFIED. Full convention: `SMART_CONVERTER_STANDARD.md`.

## D-015 — Browser-local Image, Spreadsheet and Markdown stations

- **Date:** 2026-10-06.
- **Decision:** Add exactly the requested Image, Spreadsheet and Markdown contracts in sequence, using the existing registry, routes, tactile UI and lazy client boundaries. No subsequent station is started.
- **Safety:** Image files, workbooks and Markdown remain in memory. SVG/Markdown output is inert; no eval/Function/script/macro execution or content analytics. Safe remote image URLs in Markdown previews may be requested by the browser and are disclosed; links are not followed. Spreadsheet formulas use cached values and are not recalculated. AVIF encoding is excluded without a genuine verified encoder.
- **Libraries:** Reuse existing `saxes`/browser APIs; add `exceljs@4.4.0` and `fflate@0.8.3` for browser-side workbook processing and ZIP bounds. Spreadsheet work is worker-bound and cancellable.
- **Evidence/gaps:** Image typecheck/265 tests, Spreadsheet typecheck/240 tests, Markdown typecheck/31 tests. Image and Spreadsheet landing/control DOM observed; Markdown browser tab could not be reopened. Full live processing/visual/clipboard/download/console/CSP acceptance remains open.

## D-014 — API text conversion and explicit browser-only testing

- **Date:** 2026-10-05.
- **Decision:** Implement16 API contracts in the existing registry and design. cURL and static Fetch are parsed as literal text, never executed. Local HTTP/JSON/auth/GraphQL/response tools do not contact endpoints. No unrestricted backend proxy or CORS/TLS bypass.
- **Network:** Only API Request Tester sends on explicit action through direct browser fetch with AbortSignal, omitted ambient credentials and no retry. Responses remain text; actual HTTP errors are inspectable, transport/CORS cause is indeterminate, and elapsed time is client-side. Secret inputs are memory-only, password/token/sensitive headers masked.
- **Parser choice:** Bounded native literal cURL/Fetch and executable GraphQL parsers, existing source-preserving JSON and local saxes XML. Unsupported syntax rejects or warns explicitly; no universal compatibility/schema-validation claim. No new dependencies.
- **Evidence/gaps:** Typecheck,4,582 tests/55 files,231-page build and16-route production markup/nine regression routes passed. Narrow browser landing DOM observed; complete real-browser processing/tester/clipboard/theme/console acceptance and existing lint gate remain open. `docs/API_STATION.md`.

## D-013 — Non-fetching Web Station and local raster favicon boundary

- **Date:** 2026-10-05.
- **Decision:** Add exactly 21 Web contracts and one searchable landing to the existing registry. Treat entered URLs as data; no fetch proxy, crawler, DNS check, remote validation, image request, upload, storage or analytics content. Pair switches are public route links without input in history or search parameters.
- **Implementation:** Use native URL/URLSearchParams and curated bounded references. Return escaped HTML/XML/JSON as inert text. Use browser File API, native image decoding, canvas and Blob for favicon PNG output; reject SVG/ICO claims, cap bytes/pixels, preserve aspect ratio and revoke object URLs.
- **Evidence/gaps:** Typecheck, 4,058 tests/48 files and 214-page production build passed. Focused Web suites cover 616 tests. Full real-browser visual, clipboard/download permission, native image, CSP/console and no-request acceptance remains open; see `docs/WEB_STATION.md`.

## D-012 — Non-executing SQL subsets and exact data/credential boundaries

- **Date:** 2026-10-05.
- **Decision:** Add17 explicit SQL/Database contracts and one landing to existing discovery architecture; no generic reversible converter or other station expansion. Typed builders use shared dialect/identifier/literal/conditions and safe inert results. No database connection/execution/credential testing/upload/proxy.
- **Libraries:** Exact `node-sql-parser@5.4.0` with per-dialect lazy adapters and `sql-formatter@15.9.0`. Mandatory disposable15-second workers for parser/format/conversion/DDL. Native lexer preserves token spellings/comments/newline semantics; native literal INSERT/DDL subsets reject unsupported structures rather than inventing data. SQL Server REFERENCES workaround is disclosed, not universal parser compatibility.
- **Generation/privacy:** Four dialects affect quotation/literals/Boolean and LIMIT/TOP. Strict JSON/CSV reuse, precision rejection and no implicit CSV type/null inference. UPDATE/DELETE without WHERE generate with exact all-row warnings. URI/quoted ADO.NET connection strings are local text only; parser source/password masked and credential parameters redacted. No logs/storage/requests/history payloads.
- **Evidence/gaps:** `npm ci`, typecheck,3,420 tests,build,17 production routes and all applicable four-dialect emitted-worker examples passed.129 protected sources/all166 non-SQL entries unchanged; Cron catalog test fixture updated for discovery. Narrow light landing/Formatter browser checks are partial; full visual/workflow/console and standalone lint remain open. See `SQL_DATABASE_STATION.md`.

## D-011 — Explicit Cron subset and matching-instant evaluation

- **Date:** 2026-10-05.
- **Decision:** Add exactly six Cron tools and one landing page, integrated into the central registry. Derive station metadata from existing categories and preserve their URLs. Reuse the existing icon/cards/tactile theme; no new dependency or other station implementation.
- **Dialect:** Five-field Unix default; an entered Second explicitly enables six-field seconds-first syntax. Native values/wildcards/ascending ranges/lists/steps and month/weekday aliases; Vixie leading-star AND versus restricted-day OR. Reject macros, year/command/config columns and Quartz/AWS/Jenkins extensions; do not infer dialect conversions. Human phrases use an anchored finite grammar.
- **Next Run:** Explicit ISO reference offset and IANA schedule zone; strictly-after instant matching, skip gaps, consider both fold instants. Native offset intervals/selected dates avoid exhaustive second scans. Bound to eight years/1970–2099 and require a disposable ten-second worker. Historical seconds offsets error rather than round; runtime IANA and daemon-specific DST policies remain limitations.
- **Evidence/gaps:** Typecheck, 2,971 tests, production build and six production pages/emitted-worker examples passed. Scope: 112 protected sources and all 160 prior registry entries unchanged. Real narrow dark/light/toggle inspection is partial; full browser workflows/desktop/console and existing lint gate remain open. No scheduling/execution, content requests/logs/storage or added dependencies. Details: `CRON_STATION.md`.

## D-010 — Exact Text contracts, Unicode records and isolated expensive work

- **Date:** Implementation 2026-10-03; documentation 2026-10-05.
- **Decision:** Isolate 31 public Text routes behind exact metadata and lazy workspace dispatch. Keep legacy components/helpers unchanged. Generators have no source fields; Find & Replace is literal; extraction preserves occurrences; normalization is fixed NFC/LF; two conversion pairs use real routes.
- **Processing:** Intl.Segmenter graphemes with code-point fallback, terminal-newline-aware records, rejection-sampled generation/shuffle and lazy bounded local LCS diff. Mandatory workers for arbitrary regex and diff; large text offloaded. Explicit errors replace truncation. No new dependencies or content requests/persistence/telemetry.
- **Evidence/gaps:** Typecheck, 2,676 tests, build and 31 production routes/emitted-worker examples passed; actual pathological-regex thread termination/recovery verified. All 100 protected sources and 129 other-station catalog entries unchanged. Runtime segmentation/heuristic extraction and resource bounds are documented. Lint and live-browser website-access acceptance remain unresolved; `TEXT_STATION.md`.

## D-009 — Exact Date & Time contracts and explicit calendar conventions

- **Date:** 2026-10-03
- **Decision:** Correct the 17 public tools using contract metadata, native date/time controls and lazy native Date/Intl calculations. Preserve shared calendar/clock widgets and helper APIs for existing consumers. No new dependency. Rename only the legacy Unix converter route with a permanent redirect.
- **Semantics:** Required IANA zones are explicit; absolute ISO conversion requires an offset. Reject DST gaps/folds without unrequested disambiguation controls. Use exact decimal timestamps, six explicit date formats, browser-local elapsed differences, automatic undated midnight rollover, Sunday-start/ISO weeks and supplied weekend/holiday business exclusions.
- **Conventions:** Business endpoints inclusive/reversed error; holiday deduplication avoids weekend double counting. Age has explicit target and fixed Feb28/clamped anniversary. Current clock is used only for Current Time and future-birth validation; no personal data persistence or telemetry.
- **Evidence/gaps:** Typecheck, 2,141 tests, build, 17 production pages and compiled examples passed; 91 protected sources and 143 other-station entries unchanged. Runtime IANA/clock and documented bounds remain limitations. Lint and live-browser website-access acceptance unresolved. See `DATE_TIME_STATION.md`.

## D-008 — Native JavaScript regex with mandatory isolation

- **Date:** 2026-10-03
- **Decision:** Nine exact Regex contracts use an isolated lazy workspace and native browser RegExp/replace/split. Never silently add flags, normalize invalid flags or truncate inputs/results. Structured capture/flag/split results are paginated; replacement size is preflighted. No new engine or dependency.
- **Safety:** Any supplied regex can backtrack excessively, including short patterns, so all execution requires a disposable 1,500 ms Worker. No synchronous fallback. Literal escape/build are bounded non-executing operations. Native compile errors are sanitized; all output is inert text with exact Copy/Clear.
- **Scope/trade-offs:** Preserve the legacy workbench component for non-Regex consumers; public routes use exact-ID dispatch. Explicit limits may reject legitimate workloads, syntax support depends on the browser and ReDoS immunity is not claimed. Typecheck, 1,925 tests, build, nine production routes/emitted-worker examples and pathological thread termination/recovery passed. Live browser and lint remain blocked; see `REGEX_STATION.md`.

## D-007 — Exact Security contracts and native browser cryptography

- **Date:** 2026-10-03
- **Decision:** Isolate the 22 Security routes behind a contract-driven lazy workspace while retaining the central discovery registry and other station sources. Native getRandomValues/digest/importKey/sign provide security primitives; bounded local MD5/CRC32 compatibility code avoids a crypto dependency. Three legacy URLs redirect to canonical names.
- **Privacy/performance:** No input requests, logs, telemetry or persistence. Files/larger text use disposable workers; File selections/references are released and owned buffers cleared where practical. Whole-buffer Web Crypto means a documented 64 MiB limit, not a streaming claim. Hashes remain exact inert text with Copy/Clear.
- **Trade-offs/evidence:** Category entropy and password strength are estimates, not security guarantees; UUID v7/ULID are not same-millisecond monotonic. Typecheck, 1,568 tests, build and 22 production routes/emitted-worker examples passed. Lint config and browser acceptance remain unresolved. Full audit: `SECURITY_STATION.md`.

## D-006 — Strict text encodings and real directional routes

- **Date:** 2026-10-03
- **Decision:** Encoding gets a dedicated, contract-driven lazy station with 35 public directions and seven legacy aliases. Native APIs handle UTF-8/URI operations; strict bounded byte algorithms reject malformed alphabets/bits/scalars. Complete HTML5 and nontransitional IDNA use lazily loaded `entities`/`tr46`, not unsafe DOM parsing or ad hoc label rules.
- **Privacy/performance:** Small conversions stay local; Base58 and larger inputs use cancellable ten-second workers. No input persistence, requests, rendered HTML or JWT authentication claims. Without workers, large conversions fail explicitly rather than freezing the UI.
- **Evidence/trade-offs:** 1,335 tests, typecheck/build, 35 production routes and compiled-worker examples passed; source hashes protect unrelated files. Text-only Data URI decoding, explicit resource limits and browser acceptance gaps are documented in `ENCODING_STATION.md`. Standalone lint remains blocked.

## D-005 — Exact JSON/Data contracts and bounded local engines

- **Date:** 2026-10-03
- **Context:** The supplied JSON/Data specification overrides permissive legacy helpers and extra generic controls.
- **Decision:** Isolate the station in a lazy workspace; central metadata owns exact controls/output contracts; actual inverse URLs reset page state. Use strict CSV and bounded JSON/query processing, interpretive `@cfworker/json-schema`, existing `yaml`, `saxes`, and `smol-toml`. Run processing in abortable local workers rather than executing user expressions or fetching data.
- **Trade-offs:** Explicit size/depth/time bounds and unsupported-schema/query/format errors. No remote schema or DTD resolution. XML↔JSON is the requested conventional projection, not a lossless type-preserving round trip. Detailed limits are in `JSON_DATA_STATION.md`.
- **Evidence:** 855 tests, typecheck and production build passed; registry/direct HTTP and compiled-worker checks passed. Real-browser acceptance is still pending because browser observations timed out. Lint remains independently blocked.

## D-001 — Start with documentation only

- **Date:** 2026-10-02
- **Decision:** Establish project context without generating app code or installing dependencies.
- **Reason:** The repository has no product brief or implementation baseline; documenting assumptions first prevents accidental architecture and toolchain choices.
- **Status:** Historical; implementation has since begun.

## D-002 — Target Next.js with TypeScript

- **Date:** 2026-10-02
- **Decision:** The planned application stack is Next.js and TypeScript.
- **Reason:** This is the requested project direction.
- **Status:** Implemented with Next.js 15 App Router, React 19, TypeScript, and Vitest.

## D-003 — Local date/time semantics and isolated UI

- **Date:** 2026-10-02
- **Context:** Expand dates without silent unit guessing, DST shifts, or loading all processing engines for every tool.
- **Options:** Unrestricted Date.parse, a new date library, or explicit parsing with native Date/Intl; generic text workbench or a dedicated station.
- **Chosen approach:** Native Date/Intl plus strict supported formats, explicit units, IANA zones, validated wall-clock candidates, and a lazy client station with specialized controls.
- **Reason:** No runtime dependency or backend is necessary for these calculations. Browser zone data is sufficient within the documented scope; exact validation protects input intent.
- **Trade-offs:** Gregorian years 0001–9999, up to millisecond precision, no leap seconds; timezone rules vary with browser IANA data. Relative month/year phrases are approximate. Calendar age policies and weekday endpoint inclusion are visible choices. Holidays are not modeled.

## D-004 — Interaction evidence in addition to helper tests

- **Date:** 2026-10-02
- **Context:** Prior generic workbenches passed builds without proving tool-specific actions.
- **Options:** Helper-only tests, browser automation only, or focused component workflows alongside helper vectors.
- **Chosen approach:** Add dev-only Testing Library/jsdom and an alias/JSX Vitest config; exercise every new Date & Time example, keyboard submission, error states, copy/download, and no-fetch/XHR guards.
- **Reason:** Verifies the actual UI/helper wiring with reproducible tests and no runtime bundle cost.
- **Trade-offs:** jsdom is not a layout or cross-browser engine. Manual browser visual checks are still necessary; the bundled browser timed out during this session.
