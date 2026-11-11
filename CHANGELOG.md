# Changelog

## Ad Placements Expansion — 2026-11-11

- **Strategic Monetization Expansion Across High-Traffic Views**:
  - **Tool Pages (`app/tools/[slug]/page.tsx`)**: Added a 728x90 leaderboard ad unit (`BannerAd size="leaderboard"`) at the bottom of the page, below documentation and related tools, complementing the sticky 300x250 rectangle sidebar unit.
  - **Station Landing Pages (`components/StationLanding.tsx`)**: Integrated dual leaderboard banners across all 26 station hubs (`/stations/*`) — between the tool catalog grid and the related stations section, plus at the bottom of the landing layout.
  - **Directory Browser / All Tools Registry (`components/DirectoryBrowser.tsx`)**: Embedded responsive leaderboard banner units every 3 category sections throughout the 300+ tool directory and at the bottom of the directory.
  - **Homepage (`app/page.tsx`)**: Added a centered 728x90 leaderboard unit between the Pro section and the Principles section, complementing the native banner unit.
  - **Workbench Hub (`app/workbench/page.tsx`)**: Added a centered leaderboard unit between personal tools and feature navigation links.
  - **Connected Workflows (`components/WorkflowBuilder.tsx`)**: Embedded a leaderboard banner between the pipeline runner and the recipe management section.
  - **Batch Image Conversion (`app/batch-images/page.tsx`)**: Added a centered leaderboard banner below the batch image processor.
  - **Site Directory (`app/site-directory/page.tsx`)**: Added a centered leaderboard banner between the station directory and canonical tools index.
- **Verification**:
  - TypeScript validation clean (`npm run typecheck`).
  - 155 test suites passed (6,510 tests, 0 failures).
  - Production build clean, all 413 static pages generated.

## Universal Tool Engine & Declarative Tool Contract Architecture — 2026-11-11

- **Unified Declarative Tool Contract & Lifecycle (`lib/engine/types.ts`)**:
  - Implemented canonical TypeScript interfaces (`ToolDefinition`, `ToolEngine`, `ToolInput`, `ToolOutput`, `ValidationResult`, `ToolContext`, `ToolResult`).
  - Added strongly typed discriminated unions for input controls (`text`, `textarea`, `code`, `select`, `toggle`, `checkbox`, `number`, `range`, `file`, `files`, `custom`) and output types (`text`, `code`, `table`, `image`, `blob`, `binary`, `custom`).
  - Diagnostic error reporting with field, line, column, severity, and actionable messages.
- **Deterministic Execution Runtime Controller (`lib/engine/runtime.ts`)**:
  - Pure deterministic state machine: `idle` -> `validating` -> `processing` -> `success` | `error` | `cancelled`.
  - Enforced pre-execution validation gate blocking processing on invalid inputs.
  - Linked `AbortController` cancellation mechanics and safe teardown.
  - High-precision duration tracking (`performance.now()`) with non-negative bounds.
- **Memory & Resource Management (`lib/engine/blobRegistry.ts`)**:
  - Centralized `BlobUrlRegistry` for automated Object URL creation, tracking, and leak-free revocation.
  - Delayed revocation scheduling for asynchronous browser download dialog safety.
- **Transparent Web Worker Offloading (`lib/engine/workerRunner.ts`)**:
  - Worker pool abstraction supporting progress forwarding, postMessage transfers, cancellation termination, timeouts, and synchronous fallbacks.
- **Universal Tool UI Shell & Shared Primitives (`components/engine/`)**:
  - `UniversalToolShell.tsx`: Unified workspace shell supporting 100% in-browser tools and specialized canvas slots.
  - `ToolHeader.tsx` & `ToolPrivacyBadge.tsx`: Privacy badges ("100% Local • Browser-Only", "Offline Ready", "Network Opt-In") with WebMCP DOM attributes.
  - `ToolDropzone.tsx` & `ToolEditor.tsx`: Drag-and-drop file upload with MIME/size validation, paste from clipboard, load sample, and clear actions.
  - `ToolControls.tsx`: Declarative input parameter controls with dynamic conditional visibility (`when`).
  - `ToolProgressBar.tsx`: Accessible progress indicator (`aria-busy`, percentage, status label, elapsed timer, cancel button).
  - `ToolErrorBanner.tsx`: Accessible diagnostic error banner displaying line/column coordinates.
  - `ToolActionBar.tsx` & `ToolOutputPreview.tsx`: Copy, sanitized file download, and "Chain to Workflow" actions.
  - `CustomCanvasSlot.tsx`: Error boundary-isolated workspace slot for visual tools.
- **Full 300+ Tool Registry Adapter & Workflow Piping (`lib/engine/adapters/registryAdapter.ts`)**:
  - Zero-regression adapter `adaptToolToEngine` mapping all existing tool definitions from `config/tools.ts` to canonical contracts.
  - Dual-key resolution for legacy mismatched tool slugs (`MISMATCHED_SLUG_ID_MAP`, `resolveToolKey`).
  - WebMCP and Local stdio MCP descriptor serializers in `lib/engine/mcpBridge.ts`.
  - In-memory workflow chaining pipeline integration in `components/WorkflowBuilder.tsx`.
- **Testing & Verification**:
  - Centralized contract testing harness `describeToolContract` in `lib/engine/__tests__/contractHarness.ts`.
  - Registry-wide contract test `tests/engine/registryContract.test.ts` verifying all 300+ tools.
  - Component tests in `components/engine/__tests__/UniversalToolShell.test.tsx`.
  - 155 Vitest test files passing (6,480 tests, 0 failures).
  - Clean TypeScript verification (`npm run typecheck`, 0 errors).
  - Production build (`npm run build`) cleanly generating all 413 static pages.

## Station 26 — Policy Generators Station (`/stations/policy-generators`) — 2026-11-10

- **Station 26 Implementation**:
  - Created Station 26 at `/stations/policy-generators` with Lucide `Scale` mark and privacy notice.
  - Implemented 5 client-side policy generation tools running 100% in browser memory with zero server uploads:
    - `privacy-policy-generator`: GDPR, CCPA/CPRA, CalOPPA, and COPPA compliant privacy policy builder with cookie, analytics, and payment processing clauses.
    - `terms-and-conditions-generator`: Complete terms of service agreement builder with user accounts, IP ownership, arbitration, liability ceilings, and DMCA safe harbor.
    - `cookie-policy-generator`: EU ePrivacy Directive & GDPR Recital 30 cookie policy builder with 4-pillar taxonomy, inventory tables, and browser guides.
    - `disclaimer-generator`: Professional advice disclaimers (legal, financial, medical), FTC affiliate links, Amazon Associates disclosures, and warranty exclusions.
    - `refund-policy-generator`: Consumer return policy builder covering standard returns, all sales final, store credit, return shipping, restocking fees, and SaaS cancellations.
- **Multi-Format Export & Interactive Workspace**:
  - Live real-time preview panel supporting Formatted HTML, Markdown, Semantic HTML5, Plain Text, and JSON AST.
  - One-click copy to clipboard with visual confirmation and fallback.
  - Direct client-side file downloads (.md, .html, .txt, .json) with semantic filenames.
  - Browser-native Print and Save-to-PDF (`window.print()` with `@media print` clean isolation).
  - Four industry preset profiles (SaaS / Cloud Software, E-Commerce, Blog / Content, Mobile App) for instant one-click configuration.
- **WebMCP, Search & Navigation Integration**:
  - Registered all 5 policy tools in `lib/webmcp/dispatcher.ts` and `lib/webmcp/registry.ts` (`codestation_[slug]`) for AI agent automation.
  - Integrated smart detection pattern in `lib/workbench/detection.ts` for policy text triage.
  - Updated station counters across `config/site.ts`, `components/HomeSearch.tsx`, and `components/DocsRepo.tsx` (400+ tools, 26 stations).
- **Verification**:
  - 146 Vitest test suites (6,172 tests) passing with 100% success rate.
  - Strict TypeScript validation clean (`npm run typecheck`).
  - Next.js production build (`npm run build`) successfully generated all 413 static pages.

## Station 23 — Compression & Archive Station (`/stations/compression`) — 2026-11-09

- **Station 23 Implementation**:
  - Created Station 23 at `/stations/compression` with dedicated Archive icon and privacy notice.
  - Implemented 5 client-side tools running 100% in browser memory with zero server uploads:
    - `zip-extractor` (ZIP Extractor & Viewer): Drag & drop or picker, archive tree view, image thumbnail and text code preview, individual file download, and clean re-ZIP export.
    - `zip-creator` (ZIP Archive Creator): Multi-file/folder drag & drop queue, compression levels 0-9 (Store to Max), instant ZIP creation & download.
    - `gzip-compressor` (Gzip / Deflate Compressor): Raw text/binary compression, native browser `CompressionStream` with `fflate` fallback, Base64 output & `.gz`/`.zz` download.
    - `gzip-decompressor` (Gzip / Deflate Decompressor): Auto-detection of Gzip vs Deflate, Base64 or `.gz`/`.zz` file decompression in memory, UTF-8 text viewer with copy and binary download.
    - `tar-inspector` (TAR / TAR.GZ Inspector): POSIX and GNU TAR header parser, automatic gzip decompression, UNIX mode permissions, selective extraction, and one-click export to ZIP.
- **WebMCP & Metadata Integration**:
  - Registered all 5 compression tools in `lib/webmcp/dispatcher.ts` for AI agent execution.
  - Added full SEO, AEO, and GEO Schema.org schemas (`SoftwareApplication`, `HowTo`, `FAQPage`) and WebMCP DOM attributes.
  - Updated `AGENTS.md` with explicit tool slug conventions.
- **Verification**:
  - All 128 Vitest test suites (5,594 tests) passing with 0 errors.
  - TypeScript strict typecheck clean.
  - Static site generation passing.

## WebMCP Support & Comprehensive SEO/AEO/GEO Integration — 2026-11-09

- **Browser-Native WebMCP (Web Model Context Protocol)**:
  - Added native WebMCP support anchored on `document.modelContext` / `navigator.modelContext` with seamless polyfill fallback for browser AI extensions and web agents.
  - Built pure client-side execution dispatcher in `lib/webmcp/dispatcher.ts` providing 100% in-browser, zero-upload tool execution across all 22 stations.
  - Implemented `codestation_list_tools` for discovering, searching, and filtering all 380+ tools by station category and query.
  - Implemented `codestation_execute_tool` for universal parameter-driven execution of any Code Station utility.
  - Built `components/WebMcpBridge.tsx` to automatically register the active tool definition and schema on page load with clean unregister on navigation.
  - Added unit test suite in `lib/webmcp/registry.test.ts` (10 tests passing).
- **SEO, AEO & GEO Structured Optimization**:
  - Upgraded tool pages (`app/tools/[slug]/page.tsx`) with high-density multi-schema JSON-LD:
    - `SoftwareApplication` with `operatingSystem: "All (Web Browser)"`, zero-dollar offers, and `browserRequirements` declarations.
    - `HowTo` schema with actionable step-by-step guidance for Perplexity and Google AI Overviews.
    - `FAQPage` schema addressing functionality, privacy guarantees, and AI agent interoperability.
  - Added declarative agent markup on tool containers (`data-webmcp-tool`, `data-webmcp-category`, `data-webmcp-slug`).
  - Updated `AGENTS.md` with explicit mandatory rules enforcing WebMCP support, SEO, AEO, and GEO standards across all future tool development.
- **Verification & Quality**:
  - All 125 Vitest test suites (5,562 tests) passing with 0 failures (`npm test -- --run`).
  - TypeScript strict typecheck clean with 0 errors (`npm run typecheck`).
  - Next.js production build (`npm run build`) generating all 385 static routes with 0 errors.

## Station Architecture Reorganization & Converters Station Integration — 2026-10-11

- **Dedicated Audio Station**:
  - Created `/stations/audio` station housing `audio-trimmer`.
  - Built Web Audio API client engine with waveform peak calculation, precise second-level time formatting, and high-fidelity 16-bit stereo/mono PCM WAV encoder.
  - Implemented interactive HTML5 canvas waveform visualizer, playback loop preview, and export controls.
- **PDF Station Signature Pad**:
  - Relocated `signature-pad` (Digital Signature Pad) from QR & Barcode to PDF Station (`/stations/pdf`).
  - Added smooth canvas pen drawing, stroke width and color selectors, clear/undo actions, and transparent or white PNG exports.
- **QR & Barcode Station Streamlining**:
  - Streamlined `/stations/qr-barcode` to purely focus on QR Code Generator, QR Code Reader, and Linear Barcode Generator.
- **Converters Station Integration**:
  - Added format conversion capabilities across stations to `/stations/converters`:
    - PDF family: `images-to-pdf`
    - Network family: `ipv4-to-ipv6`
    - Code family: `html-to-jsx`, `svg-to-jsx`, `docker-run-to-compose`
  - Updated category definitions and conversion registry tests.
- **Station Registry & Quality**:
  - Updated `config/stations.ts` to 22 active stations.
  - All 124 Vitest suites (5,552 tests) passing with 0 errors.
  - TypeScript strict check clean; production Next.js build generating all 385 static routes.

## Code Station Universal Utility Expansion (Phases 1-5) — 2026-10-10

- **Phase 1: Mass Traffic Anchors (PDF & QR/Barcode Suite)**:
  - Added 5 local PDF manipulation tools (`pdf-merge`, `pdf-split`, `pdf-rotate`, `pdf-page-delete`, `pdf-page-extract`) powered by `pdf-lib` with 100% in-browser security, zero cloud telemetry, drag-and-drop page reorganization, and download management.
  - Added 3 QR and Barcode tools (`qr-generator`, `qr-scanner`, `barcode-generator`) supporting URL, text, WiFi, and vCard types, PNG/SVG export, live canvas-based camera/upload scanning with `jsqr`, and Code128 / EAN13 barcode symbologies.
  - Added dedicated `/stations/pdf` and `/stations/qr-barcode` station landing hubs.
- **Phase 2: Code Generation Powerhouse**:
  - Added 8 code generators: JSON to TypeScript, Zod schema, Go Struct, Python Pydantic v2, Rust Serde struct; SQL DDL table to TypeScript; HTML to JSX; SVG to React component.
  - Added dedicated `/stations/code-generation` hub with real-time conversion and copy-ready syntax highlighting.
- **Phase 3: Network, DevOps & Cloud Engineering**:
  - Added 8 network and cloud tools: Subnet & CIDR calculator, IPv4 ⇄ IPv6 converter, X.509 certificate inspector (ASN.1 DER/PEM parser), TCP/UDP common port directory, `.gitignore` builder with curated multi-language templates, multi-stage `Dockerfile` generator, `docker run` to `docker-compose.yml` converter, and SemVer comparator.
  - Added dedicated `/stations/network-devops` hub.
- **Phase 4: Frontend & Visual CSS Playground**:
  - Added 6 visual CSS utilities: interactive CSS Grid builder, Flexbox sandbox, CSS keyframe animation generator, frosted-glass Glassmorphism maker, Clip-path polygon generator, and cross-browser custom scrollbar styling studio.
  - Added dedicated `/stations/frontend-css` hub.
- **Phase 5: Technical Developer Math Station**:
  - Added 7 developer math engines: Bitwise calculator (AND, OR, XOR, NOT, shifts across 64-bit binaries), IEEE-754 floating-point visualizer, Two's complement calculator, arbitrary-precision BigInt algebra, matrix math (addition, subtraction, multiplication, determinant, transpose), number theory (GCD, LCM, prime factorization), and fraction ⇄ decimal converter.
  - Resolved and activated `/stations/developer-math` hub.
- **System & Quality**:
  - 121 Vitest test suites (5,543 tests) passing with 100% success rate.
  - Next.js production build prerendering 383 static routes and generating offline bundle (168 assets, 5.8MB).
  - TypeScript strict typecheck passing cleanly with 0 errors.

## Code Station MCP v1.2.0 & Killer Pro Suite — 2026-10-09

- Published `codestation-mcp@1.2.0` to npm under `tejreddym`.
- Added 4 high-utility developer tools across local CLI and MCP server:
  - `curl-to-code` (`npx codestation-mcp curl` / `codestation_curl_to_code`): Universal generator producing TypeScript fetch/axios, Python requests, and idiomatic Go `net/http`.
  - `env-audit` (`npx codestation-mcp env` / `codestation_env_audit`): Secret leak scanner detecting live Stripe, AWS, OpenAI, GitHub PAT, private keys, and synchronizing with `.env.example`.
  - `mock-data` (`npx codestation-mcp mock` / `codestation_mock_data`): Realistic mock dataset and SQL INSERT seeder for users, products, orders, and custom schemas.
  - `git-conflict` (`npx codestation-mcp conflict` / `codestation_git_conflict`): Automated Git merge conflict parser and resolver supporting `ours`, `theirs`, and `both`.
- Redesigned `/pro` page with rich Tactile Technical perks showcase, live terminal preview, 15 MCP tools catalog, comparison matrix, and FAQ grid.
- Added tactile ASCII Pro badge when running CLI in Pro tier.
- Updated documentation across `/docs`, `docs/MCP_SERVER.md`, and package README.
- Added comprehensive Vitest unit tests in `lib/tools/curl-to-code.test.ts`, `lib/tools/env-audit.test.ts`, `lib/tools/mock-data.test.ts`, `lib/tools/git-conflict.test.ts`, and `mcp/server.test.ts`.

## Razorpay Standard Web Checkout Integration — 2026-10-09

- Integrated official `razorpay` Node SDK for order creation and HMAC-SHA256 signature verification.
- Backend order creation endpoint `POST /api/create-order` creates orders in INR with validation (>= 100 paise).
- Backend verification endpoint `POST /api/verify-payment` verifies HMAC-SHA256 signatures with timing-safe comparison, generating Pro license keys directly upon payment and saving their one-way SHA-256 hash in Cloudflare KV.
- Frontend Razorpay Standard Checkout in `components/ProSubscriptionManager.tsx` loads `checkout.js`, handles modal dismissal and payment failure notifications, and displays newly issued keys with one-click copy.
- Added environment variable configuration in `.env`, `.env.local`, and `.env.example`.
- Added unit test suite in `lib/razorpay.test.ts`.

## Code Station Local MCP Server & Pro Licensing — 2026-10-09

- Built `codestation-mcp` CLI supporting the Model Context Protocol (MCP) over `stdio`.
- Exposes 20 core tools directly to AI assistants (Claude Desktop, Cursor, Antigravity) running locally with zero network latency and 100% privacy.
- Introduced dual-tier model: Free tier with unlimited standard tools, and Pro tier priced at ₹199/month (or ₹999 lifetime) in India, $2.99/month (or $19 lifetime) globally.
- Implemented **login-free** purchase architecture: users receive an instant cryptographic key (`CS-PRO-XXXX-XXXX-XXXX`) without passwords or accounts.
- Security: Raw keys are never stored on the server; only a **one-way SHA-256 hash** is saved in Cloudflare KV alongside validity and expiry metadata.
- Added API endpoints: `POST /api/v1/license/verify` and `POST /api/v1/license/create`.
- Added dedicated login-free upgrade page at `/pro` with interactive key generation and status verifier.
- Implemented offline-first license verification caching in `~/.codestation/license.json` with fallback grace modes.
- Added automated unit test suites in `mcp/server.test.ts` and `lib/license/license.test.ts`, and documentation in `docs/MCP_SERVER.md`.

## Commit SITE_INDEXING runtime variable — 2026-10-08

- Declared `SITE_INDEXING=index` in `wrangler.jsonc` `vars` so the Worker
  runtime receives it without a separate dashboard step. `robots.txt` and
  `sitemap.xml` now serve the indexing-enabled responses on every deployment.
- Updated `docs/CLOUDFLARE_DEPLOYMENT.md` to reflect the committed variable.
- Build variables still require `SITE_INDEXING=index` alongside
  `NEXT_PUBLIC_SITE_URL` for page metadata baked during the Next build.

## Adsterra advertising integration — 2026-10-08

- Added production-only, opt-in Social Bar, Popunder, and Native Banner loading
  with a centralized configuration, exact public switches, stable
  `next/script` IDs, preserved `data-cfasync="false"`, and no fake Popunder
  interaction hooks.
- Added one responsive homepage Native Banner container between the showcase
  and station directory. Blocked or failed third-party scripts leave the app
  usable, and the Native Banner is contained with reserved space to reduce
  layout shift.
- Added focused gating/deduplication tests and [docs/ADVERTISING.md](docs/ADVERTISING.md).
  All switches remain disabled by default. Owner consent, privacy, regional,
  and advertising-account review is required before production enablement; no
  deployment was made for this integration.
- Verification: **5,348 tests / 96 files**, typecheck, and a 328-page
  production build passed. Lint completed with the existing warnings. A
  temporary all-enabled production build/server smoke was followed by an
  explicit all-disabled final build.

## Cloudflare Workers deployment preparation — 2026-10-08

- Added the official `@opennextjs/cloudflare` adapter and Wrangler setup for the
  existing Next.js 15 app: `wrangler.jsonc`, `open-next.config.ts`, local
  Worker environment example, static asset caching headers, and standard
  preview/deploy/upload scripts.
- Added publication exclusions for dependencies, build output, local
  environment files, generated offline metadata, private workspace metadata,
  and local logs. Added `docs/CLOUDFLARE_DEPLOYMENT.md` with Workers Builds,
  environment-variable, domain, and release instructions.
- Added `.nvmrc`, package toolchain metadata, a GitHub Actions checks workflow,
  and `npm run cf:verify` for repeatable local Worker preview smoke checks.
- Declared the production `codestation.in` custom domain and smart placement
  in `wrangler.jsonc` after the first successful Workers Builds deployment
  reported those settings as dashboard-only overrides.
- No local Cloudflare account login or DNS/domain change was performed; the
  Workers Builds production deployment was completed separately after this
  repository preparation. Indexing remains an explicit account-side decision.

## Brand-colored illustrated theme toggle — 2026-10-07

- Recolored the existing hand-drawn sun/moon toggle with lime, ivory, charcoal and lilac; retained its recognizable frame, clouds, stars and dots. Motion settles after a short pass. Added a clear focus ring and preserved a 44px mobile touch height.
- Native button behavior, saved/system theme preference and initialization remain unchanged. No dependencies, external assets or tool changes.
- Nine theme tests, typecheck and production build passed (328 static pages); lint completed with 14 existing warnings. Browser checked keyboard switching, persistence, mobile navigation and 320/390/1440px layouts; no console errors. Full suite and live OS reduced-motion were not rerun/tested. [Details and screenshots](docs/theme-toggle/README.md).

## SVG brand kit — 2026-10-07

- Created the requested dark/light transparent icon, horizontal logo, two-line Code/Station logo and text-only SVG pairs, preserving the existing header identity. Added vertical, monochrome, adaptive favicon, ICO, Apple/PWA/maskable and social exports, plus 1×/2×/3× PNG lockups and 16–1024px icons.
- Kit: **29 SVG / 87 PNG / 2 ICO**, **1,588,140-byte ZIP**, all under `public/brand/`. SVG lettering is outlined and font-independent. Local visual catalogue: `public/brand/index.html`; generator: `scripts/generate-brand-assets.mjs`. No new dependencies or application configuration changes.
- Validated SVG structure, PNG dimensions/transparency, opaque platform canvases, maskable safe area, ICO frames and ZIP integrity. Browser preview checked both themes and actual small sizes; no preview errors. Full app tests/build not rerun for this asset-only task. See [docs/BRAND_ASSETS.md](docs/BRAND_ASSETS.md).

## Workbench features and Smart Detection — 2026-10-07

- Implemented favorites/recent tools, global keyboard search, local clipboard suggestions with configurable single-match handoff, connected data workflows, input-free recipe links, PNG batch conversion/ZIP, targeted help, optional offline starter pack and feedback drafts to the owner-approved `hello@codestation.in`.
- Six new public pages; 295 existing tools and 15 stations retained. Sitemap now has **323** canonical `https://codestation.in` pages, all verified HTTP 200 locally. Fixed the JSON station ID/slug lookup discrepancy. Tool controls, engines, canonical routes, converter sessions and theme mechanism remain intact. No ads, new station or runtime dependency.
- **5,341 tests / 93 files passed**, typecheck and build passed (**328 static pages**); lint passes with 14 existing warnings. Offline JSON/text processing was verified with the server stopped after fixing encoded dynamic-route cache paths. Final focused suite passed all 42 new tests. Desktop/mobile theme screenshots and detailed limits are recorded in [docs/WORKBENCH.md](docs/WORKBENCH.md) and [release evidence](docs/workbench-release/index.html).
- Final optional pack: 142 code files / 4,831,438 raw bytes plus page shells. Only JSON Formatter and Text Counter are supported offline. Clipboard automation varies by browser; installation and completed ZIP bytes were not independently verified. No deployment or indexing change. Production preview at localhost:3000; stop it before rebuilding or switching to development.

## Sitemap public URLs — 2026-10-07

- Configured the user-confirmed `https://codestation.in` origin in `.env.local` and `.env.example`. The existing registry-driven `/sitemap.xml` now emits **317 unique canonical page URLs**: home, tools directory, 15 stations, 295 tools and five information pages. Query variants, redirects and pending stations remain excluded; indexing opt-in is unchanged.
- Added `app/sitemap.test.ts` to compare sitemap coverage against static page files and authoritative registries, validate uniqueness/domain and check exclusions/unsafe-origin handling. Six sitemap/site tests and typecheck passed. The running local endpoint returned HTTP 200 `application/xml`; parsed XML confirmed all 317 URLs use the confirmed domain. No deployment performed. Production builds must receive `NEXT_PUBLIC_SITE_URL=https://codestation.in`.

## Site-wide editorial redesign — 2026-10-07

- Extended the homepage’s ivory/charcoal/lime identity to all 15 stations, 295 tool routes, grouped all-tools directory and five information pages. Added a category jump index, compact ruled tool rows, original bracket/category artwork, focused workspace headings, neutral panel headers, lime actions, offset reading layouts and compact shared footer.
- Preserved native controls, validation, processing engines, source/session state, theme mechanism, registries, routes, metadata, legal text and package files. No dependencies or animation JavaScript. New SVG: **712 raw / 327 gzip bytes**. Developer Math stays pending.
- Verification: **5,293 existing tests + 3 new directory tests passed**; typecheck and production build passed (322 static pages); lint completed with existing warnings. **316 non-homepage routes return 200**. Browser checked search/filter/reset, keyboard jumps, mobile menu, theme persistence, JSON formatting/Copy, image conversion with source retention and native controls, and unchanged red color preview.
- Reviewed 320/390/768/1024/1440 widths and a short laptop viewport. Saved 32 matched before/after screenshots across four page types in both themes. Known pre-existing JSON station count discrepancy (46 headline/40 catalog) remains; OS reduced-motion, zoom, physical touch and full network trace were not tested. Download request status worked but saved-file observation timed out.
- Design: [docs/SITE_DESIGN.md](docs/SITE_DESIGN.md). Evidence: [docs/site-redesign/VERIFICATION.md](docs/site-redesign/VERIFICATION.md). [Screenshot gallery](docs/site-redesign/index.html). User’s follow-up supersedes the prior homepage-only stop instruction. No new station, Git commit or deployment.

## Homepage reinvention — 2026-10-07

- Replaced the homepage composition with a centered editorial hero and native search, original Station Assembly SVG, compact quick links, three illustrated showcases, a registry-driven ruled station index, processing note and lime wordmark footer. All 15 stations and existing counts/routes remain; Developer Math is pending.
- Added scoped ivory/charcoal/lime tokens and an 800ms CSS-only entrance with reduced-motion rules. Four decorative SVGs measure **5,635 raw bytes / 1,472 gzip bytes**. No dependencies, fonts, engines, routes, providers, search algorithms, input types or theme persistence changed.
- Checks: **5,293 tests / 87 files passed under Node 22.19.0**; typecheck and production build passed; lint completed with existing warnings. All **30 distinct homepage destinations** return HTTP 200. Contrast, canonical links and decorative semantics verified with `scripts/verify-homepage.mjs`.
- Browser: inspected 320, 390, 768, 1024 and 1440 widths, including 1024×600; verified search/no-results/Clear, keyboard link selection and focus, mobile Menu/Close/Stations anchor, theme and refresh, and JSON formatting/Clear. Image route retains native file/number/select controls. Production browser recorded no console errors. Matched before/after desktop and mobile screenshots cover both themes.
- Limitations: live OS reduced-motion, browser zoom, physical touch, full network trace and cross-browser/screen-reader testing were not performed. Asset-origin/source checks found only local homepage assets; this is not a network-capture claim. Initial Node 25 test run had nine unchanged theme-test storage failures; documented Node 22 passes all tests.
- Design/reference/motion details: [docs/HOMEPAGE_DESIGN.md](docs/HOMEPAGE_DESIGN.md). Evidence and detailed check boundaries: [docs/homepage-redesign/VERIFICATION.md](docs/homepage-redesign/VERIFICATION.md). No Git repository or deployment. Stop after homepage work; no new station was started.

## Unreleased — Complete visual enhancement — 2026-10-06

- Redesigned Code Station presentation across the homepage, all-tools directory, shared station landings, tool-page shell, specialized workspace panels, cards, native controls, supporting pages, and responsive layouts.
- Added semantic slate/mint/amber light/dark tokens, concise typography hierarchy, content-driven grids, proportional mobile catalog actions, station abbreviations/descriptions, clearer input/output surfaces, and shared visual documentation in `docs/UI_VISUAL_STANDARD.md`.
- Preserved routes, registry identities, input types/attributes, defaults, handlers, validation, converter sessions, theme storage, metadata, sitemap, robots, legal wording, and processing/network boundaries. Removed only an unsupported homepage shortcut hint.
- Final automated checks passed: **5,289 tests / 86 files**, typecheck, production build; lint completed with existing warnings. Representative clean production browser renders passed at 310px for homepage, Cron station, JSON Formatter, and About. Full desktop/dark/interaction/workflow browser acceptance remains open.

## Unreleased — Homepage and site foundations — 2026-10-06

- Standardized all 15 implemented station landings on the shared registry-driven layout with scoped local search, clear/reset/no-result states, accurate deduplicated counts, category filters where applicable, canonical cards, breadcrumbs, and related navigation.
- Reworked the homepage with global search, deliberate quick access, station directory, local-processing boundary disclosure, pending Developer Math labeling, and shared responsive header/footer navigation while preserving converter sessions and the illustrated theme toggle.
- Added About, provisional Privacy and Terms, Licenses, Site Directory, generated third-party notices plus a repeatable notice script, and origin-gated XML sitemap/robots behavior. Missing operator/legal/contact/license/provenance facts remain explicitly unresolved; no deployment was claimed. Live browser interaction remains incomplete.

## Unreleased — Converters Station

- Added canonical converter discovery at `/stations/converters`, category/search filters, and three lazy numeric converter routes: Unit, Temperature, and Number Base.

All notable changes to this project are recorded here.

## Unreleased

### Converters Station — 2026-10-06

- Added canonical `/stations/converters` discovery with category/search filters and no duplicate tool identities or alias URLs.
- Added Unit, Temperature, and Number Base converters with bounded local engines, verified unit catalogs, absolute-zero validation, exact BigInt bases 2–36, source-preserving controls, guarded Swap, Copy, and Clear. Full automated verification passed **5,282 tests / 83 files**, typecheck, lint with existing warnings, and production build; live browser verification remains open.

### Color & CSS Station — 2026-10-06

- Added exactly seven local Color & CSS tools and `/stations/color-css`: shared sRGB color parsing/conversion with alpha, picker, HSL palette relationships, WCAG text contrast compositing, CSS gradient, box-shadow and border-radius generators.
- Integrated Color Converter with the shared capability registry/session; kept CSS generators specialized. Automated verification passed **5,239 tests / 77 files**, typecheck, lint with existing warnings and production build; live browser acceptance remains pending.

### Smart Converter Architecture — 2026-10-06

- Added permanent `SMART_CONVERTER_STANDARD.md`, all-station audit, metadata-only capability registry and root memory-only converter sessions.
- Upgraded genuine Image, Spreadsheet, JSON & Data and Markdown converter families with compatible Output Format selection, route synchronization and original-source preservation. Recorded existing Encoding/Text/SQL/API capabilities while keeping specialized stations unchanged.
- Added stale-result/source cleanup and safe direct-test navigation fallbacks. Final typecheck, **5,208 tests / 74 files**, lint with warnings only, production build and HTTP route smoke passed; live route-boundary/download/visual/console acceptance remains open.

### Image, Spreadsheet and Markdown — 2026-10-06

- Added Image station (28 genuine local workflows with AVIF encoder gating), Spreadsheet station (20 local XLSX/CSV/TSV/JSON workflows with dynamic ExcelJS and ZIP bounds), and Markdown station (18 local parser/preview/conversion/extraction/generator/statistics workflows).
- Preserved tactile themes, route metadata, station discovery, pair links, inert output handling and privacy boundaries. No user content is uploaded or sent to analytics. Image, Spreadsheet and Markdown live-browser processing remains explicitly unverified.
- Final repository checks passed: typecheck, **5,205 tests / 72 files**, and production build. Lint remains blocked by the existing interactive missing ESLint configuration; browser workflow/visual/console gates remain open.

### Image — 2026-10-05

- Added28 local workflows and searchable `/stations/image` with one reused canonical favicon route; gated out unverified AVIF output encoders. Added bounded native raster operations, static-SVG sanitizer, source formatter/minifier, image Base64/DataURI, actual EXIF fields and approximate palettes.
- Added linked aspect sizing, keyboard/pointer cropper, verified output signatures and stale/object URL cleanup. No dependency/global theme/privacy sink added. Typecheck and265 focused tests passed; live processing remains unverified after browser panel blocked input. Audit: `docs/IMAGE_STATION.md`.

### API Station — 2026-10-05

- Added16 exact-contract API tools and searchable `/stations/api`, central registry, paired cURL/Fetch routes, station navigation and factual tool metadata.
- Added bounded non-executing cURL/static Fetch converters, Axios/Python code, ordered HTTP headers/query/body serializers, typed JSON body builder, inert response source formatting, native executable GraphQL format/build/variables and UTF-8 Basic/Bearer header tools. Reused existing JSON/`saxes`; no dependencies added.
- Added explicit direct-browser API Request Tester with cancellation/stale guards, response text/status/exposed headers/client elapsed timing and network/CORS explanations. No proxy, TLS bypass, automatic requests/retries, secret telemetry/storage or executable returned markup.
- Typecheck,4,582 tests/55 files,220-tool/231-page build and16-page production markup plus nine-station route regression checks passed. Standalone lint and full browser workflow/visual/console acceptance remain open. Audit: `docs/API_STATION.md`.

### Web Station — 2026-10-05

- Added exactly 21 local Web tools and searchable `/stations/web`, central registry/SEO metadata, paired URL/query navigation and sitemap entries.
- Added bounded native URL/query/fragment/path/percent inspection, curated HTTP/MIME/header references, heuristic UA parsing, inert escaped metadata/social generators, canonical/robots/sitemap/manifest generation and HTML entity lookup.
- Added browser-local raster-to-PNG favicon processing with aspect-ratio-preserving transparent canvas fit, supported-size validation, object-URL cleanup and `.png` download. No URL fetching, uploads, proxy, storage, analytics content or external image requests.
- Added accessible structured editors, exact Copy/Clear actions, local `.txt`/`.xml`/`.webmanifest` downloads, privacy/error/warning states and Web-specific tests. Typecheck, **4,058 tests**, and production build passed; lint remains blocked by the existing missing configuration and full live-browser acceptance remains open. Documentation: `docs/WEB_STATION.md`.

### SQL & Database Station — 2026-10-05

- Added17 exact-contract tools and searchable `/stations/sql-database`, central registry/type/dialect metadata, related navigation and sitemap, preserving other station destinations/global theme.
- Added lazy `node-sql-parser@5.4.0` and `sql-formatter@15.9.0`, shared dialect/identifier/literal/conditions, strict local INSERT conversions, native DDL/PK/FK extraction, typed query builders and declared-only accessible SVG/text ER diagram. No SQL execution or database connections.
- Added local URI/ADO.NET connection tools with masked source/password results and credential parameter redaction; exact Copy/Clear and CSV-only download. Heavy parsing/conversion uses cancellable15-second workers with resource limits and no server fallback.
- `npm ci`, typecheck, **3,420 tests**, build and all17 production routes/four-dialect compiled examples passed. 129 protected sources/all166 prior tool entries unchanged; Cron discovery test expectations updated only. Lint and full live-browser acceptance remain open. Documentation: `docs/SQL_DATABASE_STATION.md`.

### Cron reference calendar/clock follow-up — 2026-10-05

- Reused `DateTimePicker` for Cron Next Run with opt-in UTC absolute-instant edits, accessible calendar/clock and manual offset input. Default shared-picker behavior remains unchanged; no dependencies added.
- Added Current date and time: every click refreshes the ISO reference from the device clock without changing the schedule timezone. Picker edits/current actions invalidate results and cancel pending work; Clear resets/closes the picker. Narrow popup styling is station-scoped.
- Typecheck, 2,978 tests, production build and updated Cron production checks passed. All 49 Cron UI tests also passed under America/New_York. Live picker acceptance and existing lint gate remain pending.

### Cron Station — 2026-10-05

- Added six exact-contract Cron tools and searchable `/stations/cron` using existing tool cards/icon/theme. Derived station registry, homepage link and sitemap preserve other station destinations.
- Added native browser-local five-field Unix parsing plus explicitly supplied seconds-first extension, field interpretation, first-error validation, deterministic Human↔Cron, selected IANA next occurrences and exact elapsed duration. Vixie day semantics, skipped gaps and both repeated instants are documented; no job execution or dialect mixing.
- Added required cancellable ten-second worker for Next Run, resource/search bounds, exact Copy/Clear, stable hydration/accessibility and monospace responsive results. No dependencies or global design changes.
- Typecheck, 2,971 tests, production build, six production routes/emitted-worker examples and timezone/DST/leap vectors passed; 112 protected hashes and all 160 prior tool entries unchanged. Browser dark/light/toggle checks are partial; full acceptance and existing lint remain pending. Audit: `docs/CRON_STATION.md`.

### Text Station contract correction

- Implemented all 31 exact-contract Text routes in a dedicated lazy workspace with structured Copy/Clear results, two reciprocal directional pairs, factual metadata and the canonical whitespace-free character-counter redirect. Generators have only their specified amount/length and unit fields.
- Corrected grapheme counting/reversal, line-content/terminal-newline preservation, literal Find & Replace, extraction occurrences/counts, NFC/LF normalization, BOM interpretation and unit-specific generator counts. Fixed public Regex Line Extractor dispatch without changing other stations.
- Added bounded local processing, mandatory timed regex/diff workers, lazy dependency-free LCS diff, readable change labels/pagination and stale-result guards. No new dependencies, uploads, telemetry or global theme edits.
- Typecheck, 2,676 tests, production build, 31 production pages/emitted-worker examples and actual regex timeout/recovery passed. Scope hashes/catalog entries unchanged; lint and live-browser acceptance remain blocked. Details: `docs/TEXT_STATION.md`. Documentation completed 2026-10-05.

### Date & Time contract correction

- Corrected all 17 public tools to exact inputs/results and native date/time controls. Canonical `/tools/unix-timestamp-converter` has a permanent legacy redirect; reciprocal date/timestamp routes have specific metadata, examples and structured output.
- Added supplied-date generation, strict unit/offset parsing, consistent local signed differences, automatic undated midnight rollover, six date formats, Sunday-start weeks, explicit weekend/holiday business counting and fixed-convention two-date age calculation. Removed unrelated controls and downloads.
- Added lazy contract engine using existing native Date/Intl IANA helpers, exact BigInt decimal timestamp parsing and explicit DST gap/fold errors. No new dependencies; shared pickers, global theme and other stations preserved.
- Typecheck, 2,141 tests, production build, all 17 production pages and compiled-engine examples passed. Added/updated contract, edge-case, dark/light DOM, keyboard, clipboard and hydration checks. Lint missing config and live browser website-access review remain blockers.
- Rewrote `docs/DATE_TIME_STATION.md` for current semantics, limits and pending browser acceptance; updated project status/handoff/TODO.

### Regex Station contract correction

- Isolated all nine Regex routes in `RegexWorkspace` with exact controls, structured match/capture/flag/split results, 50-item pagination, exact Copy, complete Clear, stable IDs and scoped factual metadata. Added no dependencies.
- Corrected implicit global replacement, single-result testing, missing `d`, silent input/result truncation, flag normalization, group definitions/null values and native split semantics. Replaced unrelated builder presets with the specified mode/quantifier/case controls; Flag Tester now runs eight independent configurations.
- Added mandatory disposable workers for user regex execution, 1,500 ms timeout/cancellation, bounded output preflight and explicit resource errors. No unsafe main-thread fallback or downloads; no user-content logs/storage/telemetry.
- Added 357 Regex tests and `scripts/verify-regex.mjs`. Typecheck, 1,925 tests and production build passed; nine production routes and emitted-worker examples plus actual pathological-regex thread termination/recovery passed. Lint missing config and live-browser acceptance remain blocked.
- Updated `docs/REGEX_STATION.md`, status and handoff. Preserved other stations/global theme, 151 non-Regex metadata entries and legacy Regex consumers.

### Added

- Dedicated Security & Crypto station for all 22 specified routes, exact fields/results, per-output Copy/Clear, local worker cancellation, Security-only purpose/usage content and three legacy redirects.
- Shared native CSPRNG/Web Crypto engines and lazy local MD5 compatibility code; no new dependencies. Added 233 Security tests and `scripts/verify-security.mjs` for production routes and emitted-worker verification.
- `docs/SECURITY_STATION.md` with per-tool corrections, limits, privacy semantics, executed checks and the pending real-browser acceptance checklist. Typecheck, 1,568 tests and production build passed; lint/browser remain blocked.

### Corrected — Security & Crypto

- UUID v4/v7 layouts, password mandatory-class coverage, inclusive safe-integer random ranges/counts, unbiased alphabet sampling, token byte lengths and generic key-size outputs.
- Exact SHA/HMAC/checksum algorithms, lowercase digests/uppercase CRC32, strict UTF-8 input handling, case-sensitive trimmed hash comparison, bounded local file hashing and released selection/state.
- Category-model entropy and bounded local password-strength patterns; truthful algorithm/security notices, stable hydration IDs and unwrapped scrollable hash outputs. Other stations/global theme preserved.

### Earlier additions

- Dedicated Encoding station with 35 exact-contract routes, 17 directional pairs, seven legacy redirects, labeled multipart JWT/Data URI output, and route-specific canonical/purpose/usage content.
- Lazy HTML5 entity and IDNA tables (`entities`, `tr46`), strict shared byte/Unicode helpers, selective cancellable workers, and 472 Encoding regression/UI/hydration/registry/worker tests.
- `scripts/verify-encoding.mjs` for production route/metadata/assets and compiled-worker verification.
- Dedicated JSON & Data workspace for the 46 specified routes, JSON Unescape, registry-derived canonical aliases, local worker cancellation/timeouts, exact contract metadata, related links and concise station-only purpose/usage content.
- JSON/Data regression, UI, hydration, registry/metadata and worker lifecycle tests; interpretive JSON Schema, strict XML (`saxes`) and TOML (`smol-toml`) parsers.
- Integrated open-source `react-calendar` and `react-clock` components with custom Tactile Technical dark/light theme styling.
- Added `CalendarPicker` with `DD MM YYYY` formatted input, decade/century drill-up navigation, and quick today/clear actions.
- Added `TimePicker` featuring an analog clock dial with hour/minute/second hands, steppers, and quick time presets.
- Added unified `DateTimePicker` featuring dual Calendar and Clock tabs with live instant synchronization.
- Connected open-source Date, Time, and DateTime pickers to all date/time entry inputs across `DateTimeStation`.
- Sixteen Date & Time tools with IANA zone conversion, explicit seconds/milliseconds, device-clock snapshots, date/time differences, relative time, numeric format conversion, epoch conversion, ISO weeks, leap years, weekend-only business days, and calendar age.
- Date/time helper, registry, and UI regression tests using dev-only Testing Library/jsdom; existing Unix Timestamp Converter retained.
- Initial Next.js App Router foundation for Code Station.
- Central tool registry, searchable catalog, SEO routes, robots, and sitemap.
- Local-first JSON, Base64, URL, UUID, password, timestamp, and text tools.
- Expansion batch 1: JSON/YAML/CSV converters, JSON diff/tree viewer, JWT decoder, HTML/Unicode/hex tools, SHA-256/SHA-512, random strings, and Regex Tester.
- JSON/Data batch: JSON Schema Generator, JSONPath Tester, JSON Lines Formatter/Validator, and JSON ↔ JSON Lines directional tools.
- Completed the JSON/Data station expansion: schema validation, JSON escape/sort/array transforms, structure/statistics analysis, CSV/TSV operations, JSON/XML/TOML conversion, YAML utilities, and XML utilities.
- Added the Encoding Station expansion: binary, ASCII, Base32, Base58, Base64URL, Data URI, HTML entity, Unicode escape, URL component, Punycode, hexadecimal, and octal conversions.
- Added Security Station tools for legacy MD5/SHA-1, SHA-384, HMAC, CRC32, checksums, hash comparison, local file hashes, entropy, password strength, UUID parsing, ULID/NanoID, and secure random values.
- Expanded Regex Station with eight dedicated tools, worker timeouts, safe highlighting, capture/group inspection, replacement previews, flag controls, and split testing.
- Improved generator UX: random numbers use explicit start/end fields with empty start defaulting to zero; passwords show entropy and a strength meter.

### Fixed

- Encoding alphabet/padding/trailing-bit validation, fatal UTF-8/BOM preservation, ASCII/code-point/byte boundaries, uppercase hex, surrogate escapes, complete HTML references, non-verifying JWT parts, Data URI metadata and IDNA validation.
- Replaced Encoding's hidden in-place directions with complete route-synchronized pages; removed irrelevant generic controls/output metadata. Fixed a production-minifier regression in the Unicode escape example.
- JSON/Data field/output mismatches: removed unrequested settings; corrected complete JSON string literals, physical JSONL records/errors, recursive comparisons/key ordering, schema inference/validation, JSONPath, and interactive tree/structure/statistics.
- Strict CSV quoting/rectangular validation, safe nested values and HTML/Markdown output, selected-column analysis, all nine filters, dedupe/reorder headers and delimiter-aware TSV escaping. Corrected YAML/XML/TOML parsing instead of permissive data-changing fallbacks.
- Directional JSON/Data routes, examples, CTA/output labels, extensions and canonical metadata now follow the URL. Six legacy aliases use config-level permanent redirects.
- Linked every breadcrumb segment on tool/catalog pages, with encoded station filters and accessible current-page markers.
- Theme-root hydration warning from prepaint theme selection; safe theme storage access in restricted browsers.
- Date & Time heading, label, hint, and picker ID hydration drift using explicit tool-scoped field identifiers. Added SSR/hydration regression coverage while preserving calendar/clock controls.
- Date/time format precision for leading-zero milliseconds and business-day same-date endpoint defaults during the new station's validation.
- Fixed UUID and password generation in browsers by using a `Uint8Array` with Web Crypto.
- Added distinct generator interfaces with password length/count/character options and UUID quantity controls.

### Changed

- Lazy Date & Time/legacy-workbench client boundaries; no new processing code added to the generic tool dispatcher and no new runtime dependency.
- Project guidance and architecture now describe the implemented app and actual lint/audit/visual-check gaps rather than an empty scaffold.
- Added the first Code Station Tactile Technical design system pass: warm light/dark tokens, physical controls, station category language, responsive micro-illustration, focus states, and reduced-motion handling.
- Replaced the generic theme treatment with the supplied illustrated Sun/Moon theme instrument, including sketch displacement, clouds, moon spots, stars, shooting stars, meteor, aurora, and comets.
- Expanded Text Station with case conversion, duplicate/sort/reverse/clean line tools, prefix/suffix, find/replace counts, unified/side-by-side diffs, slug/lorem/random generators, extractors, regex line filtering, normalization, tabs/spaces, line endings, BOM, sentence, paragraph, and no-space character tools.
