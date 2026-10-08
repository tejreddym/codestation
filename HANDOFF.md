# Handoff

## Cloudflare Workers deployment preparation — 2026-10-08

- Prepared the existing Next.js 15 app for Cloudflare Workers with the
  OpenNext adapter. Added `wrangler.jsonc`, `open-next.config.ts`,
  `public/_headers`, `.dev.vars.example`, adapter scripts in `package.json`,
  and the required dependency/lockfile updates.
- Pinned the validated local toolchain with `.nvmrc` (Node 22.19.0), Node
  engine metadata, and npm 10.9.3 package-manager metadata.
- Added a root `.gitignore` so `.env.local`, `.dev.vars`, `node_modules`,
  `.next`, `.open-next`, `.wrangler`, generated `public/offline-assets.json`,
  `.omnirush`, caches, and local logs are not published. Added the release
  guide at `docs/CLOUDFLARE_DEPLOYMENT.md` and updated README/TODO/CHANGELOG.
- The adapter follows current OpenNext/Cloudflare documentation. The app has
  no R2/KV/D1/Images binding requirement, so none was added. The existing
  post-Next offline-manifest generator remains in `npm run build`; OpenNext
  invokes that script before packaging the Worker.
- Final verification completed under Node 22.19.0: `npm ci --no-audit --no-fund`,
  `npm run typecheck`, `npm test` (**5,341 / 5,341; 93 files**),
  `npm run lint` (existing warnings), `npm run build` (**328 static pages**),
  and OpenNext Worker preview. `npm run cf:verify` passed noindex and a
  separate temporary `.dev.vars` check passed indexing-enabled runtime
  behavior; the temporary file was removed. Static assets now receive the
  security headers through `public/_headers` as well as Next headers.
- Re-run the preview only after stopping any process serving `.next`; do not
  build while another Next/OpenNext process is active.
- `npm audit --omit=dev` currently reports eight findings: the pre-existing
  Next/PostCSS and ExcelJS/uuid advisories plus current OpenNext/Wrangler
  build-toolchain advisories. Do not use `audit fix --force` or upgrade Next as
  an incidental deployment change; resolve these in a separately tested
  maintenance task.
- OpenNext preview verification showed `SITE_INDEXING` must be configured in
  both Workers Build variables (for build-time canonical output) and Worker
  runtime Variables & Secrets (for the runtime robots/sitemap handlers). A
  build-only `SITE_INDEXING=index` was correctly not sufficient; leave the
  runtime value unset until indexing is approved.
- GitHub publication remains blocked until the user re-authenticates `gh` with
  an account that can write `tejreddym/codestation`. Cloudflare account,
  custom-domain, Workers Builds, and indexing setup are account-side steps.

## Brand-colored illustrated theme toggle — 2026-10-07

- Recolored the existing hand-drawn sun/moon toggle with lime, ivory, charcoal and lilac; retained its recognizable frame, clouds, stars and dots. Motion settles after a short pass. Added a clear focus ring and preserved a 44px mobile touch height.
- Native button behavior, saved/system theme preference and initialization remain unchanged. No dependencies, external assets or tool changes.
- Nine theme tests, typecheck and production build passed (328 static pages); lint completed with 14 existing warnings. Browser checked keyboard switching, persistence, mobile navigation and 320/390/1440px layouts; no console errors. Full suite and live OS reduced-motion were not rerun/tested. [Details and screenshots](docs/theme-toggle/README.md).

## SVG brand kit — 2026-10-07

- Created the requested dark/light transparent icon, horizontal logo, two-line Code/Station logo and text-only SVG pairs, preserving the existing header identity. Added vertical, monochrome, adaptive favicon, ICO, Apple/PWA/maskable and social exports, plus 1×/2×/3× PNG lockups and 16–1024px icons.
- Kit: **29 SVG / 87 PNG / 2 ICO**, **1,588,140-byte ZIP**, all under `public/brand/`. SVG lettering is outlined and font-independent. Local visual catalogue: `public/brand/index.html`; generator: `scripts/generate-brand-assets.mjs`. No new dependencies or application configuration changes.
- Validated SVG structure, PNG dimensions/transparency, opaque platform canvases, maskable safe area, ICO frames and ZIP integrity. Browser preview checked both themes and actual small sizes; no preview errors. Full app tests/build not rerun for this asset-only task. See [docs/BRAND_ASSETS.md](docs/BRAND_ASSETS.md).

## Workbench features and Smart Detection — 2026-10-07

- Implemented favorites/recent tools, global keyboard search, local clipboard suggestions with configurable single-match handoff, connected data workflows, input-free recipe links, PNG batch conversion/ZIP, targeted help, optional offline starter pack and feedback drafts to the owner-approved `twnspace2@gmail.com`.
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


## Complete visual enhancement — 2026-10-06

Implemented the presentation-only redesign requested for Code Station. Updated `app/globals.css` with semantic slate/mint/amber light and dark tokens, tighter typography, content-driven grids, compact responsive navigation, polished cards, catalog toolbars, panels, controls, focus states, and mobile layouts. The existing illustrated theme toggle and Code Station mark remain in use. Page-level horizontal clipping was removed from the global body; legitimate output/editor/table scrolling remains component-owned.

Updated `app/page.tsx`, `app/tools/page.tsx`, `components/StationMark.tsx`, `components/StationLanding.tsx`, and `components/ToolCatalog.tsx` for presentation wrappers, concise copy, station descriptions/abbreviations, proportional mobile actions, and shared page hierarchy. No search algorithm, route, registry, handler, input type, default, validation, or session provider was changed. The unsupported homepage `⌘ K` hint was removed because the component has no shortcut handler.

Updated specialized workspace presentation styles in `components/{JsonDataStation,EncodingStation,SecurityStation,RegexStation,TextWorkspace,DateTimeStation,CronStation}.module.css`; updated `components/InformationalPage.module.css`; added `docs/UI_VISUAL_STANDARD.md`; and added the visual-boundary sentence to `AGENTS.md`. Existing Image, Spreadsheet, Markdown, API, SQL, Web, Color & CSS, Numeric, and legacy workspace styles consume the new shared tokens and retain their specialized structure.

Page inventory inspected: homepage, `/tools`, all 15 implemented station routes, registry-driven `/tools/[slug]`, specialized lazy families, About, provisional Privacy and Terms, Licenses, Site Directory, robots and XML sitemap metadata. No Contact, Accessibility, `not-found`, `error`, or `loading` route exists. Developer Math remains pending. The prior “46 browser-local / 40 of 40” screenshot discrepancy is not present in the current shared landing: station count and catalog membership both derive from `config/stations.ts` and current tool registries; the older number is treated as a historical snapshot, not cosmetically corrected.

Verification: focused workspace tests **768 tests / 7 files** passed in the delegated CSS pass; final `npm test` passed **5,289 tests / 86 files**; `npm run typecheck` passed; `npm run lint` completed with existing warnings; `npm run build` passed. Clean production browser review observed `/`, `/stations/cron`, `/tools/json-formatter`, and `/about` at 310px. A stale dev server initially produced a missing webpack chunk on the tool route; it was stopped, a production server was restarted after build, and the route then rendered successfully. Browser click/action, desktop widths, dark-theme interaction, console/network, clipboard/download, uploads, and every tool workflow remain NOT VERIFIED.

## Homepage, station consistency, and site foundations — 2026-10-06

Implemented the shared station design and site-foundation batch. All 15 implemented stations now resolve through canonical `/stations/<id>` landing routes and reuse `components/StationLanding.tsx`, `components/ToolCatalog.tsx`, `components/ToolCard.tsx`, and `lib/tool-search.ts`. Counts and memberships derive from `config/stations.ts` and the canonical converter registry; search supports normalized local matching, result counts, clear/reset actions, category filters where applicable, and no-results states. Developer Math is explicitly pending, unrouted, and excluded from counts/sitemap.

Replaced the homepage with registry-driven global search, quick access, station directory, processing boundary notes, and supporting links. Added `SiteHeader`/`SiteFooter` with a responsive menu while preserving the root `ConverterSessionProvider` and theme toggle. Updated mobile CSS to include the station navigation and suppress horizontal overflow from the illustrated hero.

Added evidence-based `/about`, `/privacy`, `/terms`, `/licenses`, and `/site-directory`, public/generated `THIRD_PARTY_NOTICES.md`, and `scripts/generate-third-party-notices.mjs`. `NEXT_PUBLIC_SITE_URL` is accepted only as a clean HTTPS origin; `SITE_INDEXING=index` is required for indexing. Missing/unsafe origin or non-index setting produces noindex metadata, disallowing robots guidance, and an empty XML sitemap. `metadataForRoute` now applies this policy to station and tool pages. Markdown notices correctly disclose that remote preview images may be requested; API Request Tester remains the only explicit request action.

Owner decisions still required: named operator/legal entity, verified contact channel, hosting/provider and retention facts, governing law/jurisdiction, project license, and provenance/license for the illustrated theme asset. No contact form, jurisdiction, ownership claim, cookie banner, analytics, or deployment was invented.

Checks: full Vitest suite passed **5,289 tests / 86 files** before the final metadata-policy edit; focused site/station suite passed **83 tests / 6 files** after it. Typecheck, final full suite, lint, and production build must be rerun after the last edits. A live 310px homepage render showed the new layout, all 15 stations/counts, search, pending Developer Math disclosure, and footer. Browser click/fill operations timed out; mobile menu, search interaction, theme switch, console/network, all station layouts, and desktop/responsive workflow evidence remain NOT VERIFIED.

## Converters Station — 2026-10-06

Implemented `/stations/converters` as a derived discovery surface over canonical capability/tool identities. Added category/search filtering and links to existing Image, Spreadsheet, Structured Data, Markdown & HTML, Colors, Encoding, Text, SQL, API, and new numeric converters without alias pages or duplicated registrations.

Added numeric catalogs and engines in `config/{unit-tools,temperature-tools,number-base-tools}.ts` and `lib/tools/{unit,temperature,number-base}/`. Unit covers the requested six categories with explicit US/Imperial and decimal/binary digital labels; Temperature rejects below-absolute-zero values; Number Base uses exact BigInt for bases 2–36 with bounded, compatible prefix handling. `NumericStation` preserves source text on target changes, invalidates stale results, offers guarded Swap, explicit units, Copy, and Clear.

- Numeric engine coverage passed **30 tests**; discovery/UI integration and regression tests passed. Final repository gates passed: full suite **5,282 tests / 83 files**, typecheck, lint with existing warnings, and production build. Fresh HTTP smoke returned 200 for the Converters landing, all three numeric routes, and representative existing converter routes. A fresh dev server was started, but built-in browser open timed out with no tab; clipboard, responsive/theme, console and network remain NOT VERIFIED.

## Converters Station — current batch

Implemented `/stations/converters` discovery in `config/converter-tools.ts`, `components/ConvertersCatalog.tsx`, and `app/stations/converters/page.tsx`. Cards are derived from `conversion-capabilities` and canonical `config/tools` entries, deduplicated by registered ID. `config/stations.ts`, sitemap, and homepage-derived station navigation now expose the landing route.

Added `config/numeric-contracts.ts` for the three numeric tool contracts (`unit-converter`, `temperature-converter`, `number-base-converter`), central registration, and the lazy `components/NumericStation.tsx` boundary. Existing numeric engines under `lib/tools/{unit,temperature,number-base}` were not edited.

Focused checks passed: `npm run typecheck`; `npx vitest run config/converter-tools.test.ts components/ConvertersCatalog.test.tsx components/NumericStation.test.tsx` (9 tests). Numeric engine checks also passed separately: `npx vitest run lib/tools/number-base/engine.test.ts lib/tools/temperature/engine.test.ts lib/tools/unit/engine.test.ts` (23 tests). Live-browser acceptance remains open.

## Color & CSS Station — 2026-10-06

Implemented only the seven scoped Color & CSS tools and `/stations/color-css`. Added `config/color-tools.ts`, `components/ColorCssStation.tsx`/CSS, `lib/tools/color/{types,engine}.ts`, shared sRGB parsing/serialization, alpha compositing, palette relationships, WCAG contrast, CSS gradient/shadow/radius serialization and registry/station/sitemap integration.

- Color Converter uses the shared capability registry/session; CSS generators remain specialized and have no generic Output Format selector. No unsupported color spaces were added.
- Automated verification completed: focused Color tests **366 tests / 7 files**, full suite **5,239 tests / 77 files**, typecheck, lint (warnings only) and production build. Fresh HTTP smoke returned 200 for `/stations/color-css` and all seven tool routes. Browser open timed out twice with no tab; live interactions, clipboard, JSON export, applied CSS/computed-style checks, themes/mobile and console/network are NOT VERIFIED.

## Smart converter upgrade — 2026-10-06

Implemented the permanent converter convention in `docs/SMART_CONVERTER_STANDARD.md` and audit in `docs/SMART_CONVERTER_AUDIT.md`. Added `config/conversion-capabilities.ts`, `components/ConverterSession.tsx` above the route boundary, and safe navigation fallback for direct component/SSR tests.

- Upgraded Image, Spreadsheet, JSON & Data and Markdown genuine converter families with route-backed Output Format controls and memory-only source sessions. Original File/text source is retained across compatible target navigation; result/download state is invalidated on edits and Clear releases source.
- Recorded real existing capabilities for Encoding, Text, SQL & Database and API without inventing dropdowns for Security, Regex, Date & Time, Cron or Web specialized tools. The Color & CSS converter now has six registered sRGB HEX/RGB/HSL mappings; the future Converters station remains not started.
- Focused converter verification: typecheck and **448 affected tests** passed across registry/session/Image/Spreadsheet/JSON/Markdown suites. Final repository checks passed typecheck, **5,208 tests / 74 files**, lint with warnings only, and production build. Added `eslint@9.39.1`, `eslint-config-next@15.5.27` and `.eslintrc.json` so lint is noninteractive; warnings are existing/accessibility/image/ref cleanup findings.
- Live browser: no fresh route-boundary source-preservation or inspected-download interaction was completed. Image/Spreadsheet/Markdown prior evidence remains landing/control-only; route synchronization, Back/Forward, refresh, title/canonical, clipboard, themes, responsive, console/network are **NOT VERIFIED**.
- Production HTTP smoke returned200 for Image, Spreadsheet, Markdown, JSON/Data, and representative converter routes with Output Format markup. HTTP smoke is not browser interaction or download-byte verification. Production server was stopped afterward.

## Image → Spreadsheet → Markdown — 2026-10-06

Sequential scope completed; no Network, Color, CSS, Git, DevOps, Files, Converters, Developer Math or other station started.

- Image:28 workflows, native local engines, strict SVG subset, verified raster signatures, object URL cleanup, one canonical shared favicon, AVIF output excluded. Typecheck +265 focused tests. Browser only observed landing and SVG controls; processing NOT VERIFIED.
- Spreadsheet:20 workflows, dynamic ExcelJS/fflate, XLSX archive limits and worker processing, safe previews/text exports, no macro execution/formula recalculation. Typecheck +240 focused tests. Browser only observed landing and CSV-to-Excel controls; processing NOT VERIFIED.
- Markdown:18 workflows, `lib/tools/markdown/engine.ts`, inert sanitized HTML source, native Markdown subset, YAML frontmatter, TOC/extractors/generators/statistics. Typecheck +31 focused tests. Browser tab closed and new localhost open timed out; all live Markdown workflows NOT VERIFIED.
- New docs: `docs/IMAGE_STATION.md`, `docs/SPREADSHEET_STATION.md`, `docs/MARKDOWN_STATION.md`. Final `npm run typecheck`, `npm test` (**5,205 tests / 72 files**) and `npm run build` passed. HTTP smoke returned200 for six representative routes. Lint remains exit1/missing config. Production server was stopped after smoke; no Git repository/commit/push/deployment.

## Image gate — 2026-10-05

Completed Image before starting Spreadsheet:28workflows,27new central entries plus shared favicon. PNG/JPG AVIF encoders excluded truthfully; AVIF decoders native-dependent. `config/image-tools.ts`, `components/ImageStation*`/cropper, `lib/tools/image/`, shared metadata/catalog/landing pattern integrated. Typecheck and265tests/9files passed. Browser landing/SVGcontrols observed; fill failed needs_attention, no processing action dispatched. See `docs/IMAGE_STATION.md`; actual native codec/download/theme/mobile/console gates remain open.

## API Station — 2026-10-05 (latest)

Implemented only the 16 API contracts and `/stations/api`. Details, supported subsets and pending browser gates: `docs/API_STATION.md`.

- Discovery: `config/api-tools.ts` contributes metadata to the existing `config/tools.ts`; `config/stations.ts`, lazy `ToolWorkspace`, public tool metadata/breadcrumb/content, homepage-derived navigation and sitemap integrate API without replacing previous stations. Pair: cURL to Fetch ↔ Fetch to cURL.
- UI: `ApiStation.tsx`, `ApiStructuredFields.tsx` and scoped CSS reuse tactile tokens/theme, explicit labels, keyboard rows, inert outputs, per-output Copy and Clear. REST has Copy cURL/Fetch. Tester has Send Request/Cancel/Copy Response only. Sensitive header values, password and bearer controls are obscured; no persisted private inputs.
- Engine: `lib/tools/api/{types,curl,request,local,graphql}.ts` contains literal parsing/code generation, request/header/body serialization, local response formatting, bounded native GraphQL executable parser and Basic/Bearer generation. Existing JSON and `saxes` helpers reused; no dependency changes, backend routes, proxy, eval/Function/shell execution or schema introspection.
- Tester network boundary: only explicit Send Request invokes direct browser `fetch`, `credentials: omit`, AbortSignal, no retry. Errors distinguish actual HTTP responses from indeterminate network/CORS failures; browser forbidden/exposed headers/redirects apply. Cancel/edits/Clear/unmount abort and ignore stale responses, not endpoint side effects.
- Executed: baseline typecheck/4,058 tests, lint exit1; initial build attempt was blocked by incomplete concurrent API integration. Dev process was stopped before final build. Final typecheck, **4,582 tests / 55 files**, build **220 tools / 231 pages**, production markup script **16 API tools + landing/home/sitemap + nine regression routes** passed. **507 API-specific tests** plus discovery expansion; no live network sample requests were executed.
- Browser: selected conversation tab `tab_muuz6axj_f` navigated to API landing; 310×444 DOM text verified all16 cards/description/search/related links. Image observation failed. Full workflows, clipboard, approved safe tester endpoint/CORS/cancel, theme/desktop/mobile visual, live accessibility/console/hydration/CSP remain pending.
- Preview was `http://localhost:3000/stations/api`, background shell `sh_10b9843ef001NhhWfIUU2eM8oW`; it was stopped for the final build. Restart with `npm run start -- -p 3000` when needed; always stop it before rebuilding `.next`. Existing lint/dependency/global narrow header and prior browser gaps remain; no Git repository/commit/push/deployment. Do not start Network without a new scoped request.

## Web Station — 2026-10-05 (latest)

Implemented only the 21 specified Web contracts and `/stations/web`; exact fields, paired URL/query routes, local engines, accessible structured editors, favicon Blob processing, downloads and privacy boundaries are documented in `docs/WEB_STATION.md`.

- Registry/integration: `config/web-tools.ts` contributes exact Web metadata to `config/tools.ts`; `config/stations.ts`, homepage discovery, `/stations/web`, sitemap and tool-page SEO/AEO/GEO sections are integrated without a second registry. URL Parser ↔ URL Builder and Query String Parser ↔ Query String Generator link to separate public routes with no input payload.
- UI: `components/WebStation.tsx`, `WebStructuredFields.tsx` and scoped CSS reuse the existing tactile tokens, themes, copy/clear/status/error patterns and keyboard-accessible structured editors. Only the contracted controls and downloads exist. Preview data is React text; no `dangerouslySetInnerHTML`, remote image, fetch, storage or analytics sink.
- Engines: `lib/tools/web/inspect.ts`, `inspect-shared.ts`, `reference.ts`, `reference-data.ts`, `generate.ts`, `favicon.ts` and `types.ts`. Native URL/URLSearchParams, curated references, escaped inert markup, strict URL/color/date/manifest validation, bounded Unicode/percent inspection, and native browser raster-to-PNG conversion. No dependencies added.
- Executed: typecheck; **4,058 tests / 48 files**; final build **21 Web tools / 214 generated pages** with the initial CSS alignment warnings corrected. Focused Web tests: **616**. Lint remains the existing missing-config failure and has not been claimed as passed.
- Browser: production preview restarted after the build for a limited smoke check. Full 21-tool processing, clipboard/download permission, favicon native decoding, dark/light visual, mobile/desktop, paired navigation/history, CSP/console and no-request acceptance remains pending; jsdom is not live-browser proof. Stop the preview before another build.

## SQL & Database Station — 2026-10-05 (latest)

Implemented only 17 specified SQL/Database tools and `/stations/sql-database`. Exact contracts, dialect assumptions, limitations, evidence and remaining browser checklist: `docs/SQL_DATABASE_STATION.md`.

- Registry: `config/sql-tools.ts` → central `config/tools.ts` via `sqlContract`, including routes/input-output types/dialect metadata/examples/actions/related tools. Station registry derives tool list/count and the exact requested description. `app/stations/sql-database/page.tsx` / `SqlDatabaseCatalog.tsx` reuse Cron-like discovery/search/icons/cards; homepage already uses station routes, sitemap adds SQL. No unrelated landing/station implementation.
- UI: `SqlDatabaseStation.tsx`/CSS, `SqlStructuredFields.tsx`/CSS and `SqlErDiagram.tsx`/CSS. Exact fields only, typed structured rows/conditions/assignments/order, explicit column reconciliation, stable IDs/errors, monospace Copy/Clear and CSV-only local download. Validator/parser obey no-Copy contracts. ER safely shows actual PK/FK (including composite/external references), SVG zoom/scroll and full text; no inferred names/cardinalities. Credentials/source remain password-masked; parsed password fixed eight bullets with sensitive parameter redaction.
- Engine: `lib/tools/sql/{types,literals,lexer,parser,transforms,ddl,builders,connections,engine,client}.ts`, `workers/sql.worker.ts`. Exact added dependencies `node-sql-parser@5.4.0`, `sql-formatter@15.9.0`, per-dialect lazy adapters and formatter. Shared escaping, identifiers/conditions, bounded literal INSERT grammar and DDL subset; reused unchanged JSON/Data strict helpers. No SQL executor, database driver, credentials test, network payload, logging, persistence or unsafe HTML/eval.
- Dialects: PG/MySQL/SQLite/SQL Server affect parsing/formatting, quoting/Boolean/string handling and LIMIT/TOP. PG standard-conforming strings; MySQL default backslash mode/ANSI_QUOTES off; SQL Server Unicode literals. Names capped by dialect length; no permissive identifier interpolation. INSERT extraction rejects expressions/upserts/implicit columns/heterogeneous input and lossy numbers. CSV inputs stay strings; CSV NULL/empty ambiguity disclosed. UPDATE/DELETE no-WHERE warnings are exact and generation remains possible.
- Limits: each string 200k units, aggregate 1M, preflight 25k nodes/depth16, SQL50k tokens/nesting128/200 statements; result2M including structure; generators100 cols/conditions/assignments/order,1k rows/100 IN values; extraction500cols/10krows; DDL50tables/500columns/200relationships. Parser/conversion/DDL tools always require a disposable15sworker; large generators offload; errors never silently truncate.
- Known parser subset: Validator does not verify schema/permissions/state. SQL Server REFERENCES is a library limitation; ER has strict native FK extraction plus selected-parser checking of remaining definitions. Unsupported DDL/table options/ALTER rejected. Minification preserves hints/executable comments and newline-sensitive syntax; formatter rejects token changes and ordinary parser-invalid SQL, with explicit caveats for known library extensions.
- Executed: baseline typecheck/2,978 tests/build; final `npm ci`, typecheck, **3,420 tests / 42 files**, build **183 tools / 192 pages**, `verify-sql.mjs` **17 pages**, 25 links, 10 scripts, seven prior-station routes, 17 compiled-worker examples and all applicable four-dialect examples, Unicode/literal/invalid/redaction/ER vectors and **11 assets**. New SQL suites **424 tests**; unchanged breadcrumb discovery adds18. Download test inspects actual Blob text; jsdom/VM are not live browser proof.
- Scope: **129 protected existing source hashes**, **166 non-SQL runtime entries** unchanged. Only baseline test exception is `config/cron-tools.test.tsx` expectations for added discovery category/landing. Snapshot `/private/var/folders/69/l4j48t2j7pd9npmrwgw19ldc0000gn/T/opencode/sql-scope-08N7En/`. Existing engines/components/globalCSS/theme remain unchanged. No Git repository/commit/push/deployment.
- Browser partial: earlier open timed out; resumed tab **`tab_muuz6axj_f`** loaded landing/Formatter with real controls and light310×444 screenshots. Load-example action failed; fresh observation used, no repeated uncertain action. Full17-tool actual worker/results/Copy/Clear/download/dark/desktop/ER/console remains pending. Shared header clips/overflows310px and was not redesigned. Standalone lint remains exit1/missing config; prior dependency findings unresolved.
- Prior SQL preview stopped during pause; resumed first HTTP script failed connection-refused, then was restarted and the whole script passed. Current production preview: `http://localhost:3000/stations/sql-database`, background shell **`sh_10b1fb84a001uPImYiRQkulVpH`**. **Stop it before rebuilding `.next`.** Previous shell `sh_10afbb56d001yVS8sb6LOXsa2T` is not assumed active.
- Next: remaining SQL browser checklist when available/authorized, or a new scoped request. No Web Station or other implementation active.

## Cron Station — 2026-10-05 (previous)

### Reference picker follow-up

- User-requested calendar/clock and click-to-refresh current time added to Cron Next Run only. `DateTimePicker.tsx` gains opt-in `mode="utc"`, form name/required/error associations and keyboard-accessible calendar/clock controls; default local behavior is preserved. UTC calendar/clock edits produce explicit `.sssZ`, preserve reference precision and avoid host DST reinterpretation. Manual ISO offsets remain editable, oversized typing is not truncated in UTC mode, and errors remain associated.
- `CronStation.tsx` reuses it for `reference`, adds **Current date and time** (`new Date().toISOString()` per click), keeps expression/zone unchanged, invalidates old results and cancels work. Clear/example resets remount the picker to close popovers. Station-scoped CSS bounds the popup/tiles inside narrow panels; global styling unchanged. Contract hints explain UTC picking versus IANA schedule timezone.
- Follow-up checks: typecheck, **2,978 tests / 38 files**, production build **166 tools / 174 pages**, updated `scripts/verify-cron.mjs` with new-control assertions passed. **49 UI tests** passed under `TZ=America/New_York`; seven new tests cover repeat-click snapshots/no polling, actual calendar/clock selection, UTC/offset/millisecond handling, keyboard/Escape, Clear, stale/cancelled work and raw invalid input. Existing picker/hydration regressions passed.
- Previous scope counts below are historical: shared `DateTimePicker.tsx` now has this explicitly authorized opt-in enhancement. No other station routes/contracts/engines changed. Full live picker/mobile/clipboard/console checks remain pending; prior lint blocker unchanged.
- Rebuilt after stopping verified workspace server PID 8087. Current preview: `http://localhost:3000/tools/cron-next-run`, background shell **`sh_10aa11dc6001PKtDdT4XpQLoYZ`**. Stop it before another `.next` build; older preview shell below has exited.

Implemented only six specified Cron tools and `/stations/cron`. Full contracts, dialect/DST conventions, bounds, evidence and pending browser checklist: `docs/CRON_STATION.md`.

- There was no prior Cron functionality or dialect selector. `config/cron-tools.ts` contributes `cronContract` to central `config/tools.ts`; `config/stations.ts` derives existing category/count metadata with only Cron gaining a new landing URL. `app/stations/cron/page.tsx` / `components/CronCatalog.tsx` reuse existing cards/icon/theme for local search and related station links. Homepage/sitemap integrate Cron without changing other destinations.
- `components/CronStation.tsx` / `.module.css` and lazy dispatch: exact controls, stable IDs, per-visible-value Copy, Clear/default restoration, associated errors, keyboard/tab order, field interpretations and abort/stale-result guards. Generator has six visual fields but blank Second means five-field Unix; entering it explicitly activates the seconds-first extension. No mode selector, upload or Download.
- `lib/tools/cron/{types,parser,explain,human,next-run,engine,client}.ts`, `workers/cron.worker.ts`: strict native grammar, names/values/ranges/lists/steps, Vixie leading-star AND versus restricted-day OR, deterministic anchored human descriptions and sanitized validator status/error. No library/dependency additions, eval, jobs, commands, requests, schedule logs/persistence or analytics/ad abstraction.
- Next Run: explicit absolute ISO offset plus separate required IANA zone. Strictly after reference; skip gaps, consider both folds in chronological instant order. Selected-day/offset-interval search avoids exhaustive per-second scanning. Mandatory worker, 10 seconds; eight-year search in 1970–2099. Historical seconds-based zone offsets error instead of rounding; IANA data/daemon DST differences and six-hour transition-probe assumption documented.
- Input limits: expression 1,024; fields/zone 128; human phrase 500; ISO reference 64 characters. Invalid input never silently clamps/defaults/truncates. Validator checks syntax, not occurrence existence. No user inputs enter URLs/storage.
- Baseline: typecheck, 2,676 tests and build passed; no Git repository. No Next process was running during baseline/final builds. Final: typecheck, **2,971 tests / 38 files**, production build **166 tools / 174 pages**, production script six pages/examples, landing/home/sitemap, 14 links, nine scripts, one worker asset, six other-station pages and timezone/DST/leap/strict-next vectors passed. `TZ=America/New_York` engine suite: **229 passed**. New Cron tests: **288**; unchanged breadcrumb matrix discovered seven more registry cases.
- Scope: all **112 protected existing source hashes** and **160 non-Cron runtime entries** unchanged. Snapshot: `/private/var/folders/69/l4j48t2j7pd9npmrwgw19ldc0000gn/T/opencode/cron-scope-qULOSE/`. No other station implementation, global CSS/theme edit, Git commit/push/deployment.
- Browser partial: tab **`tab_muutbxbt_5`** loaded landing and Next Run at 310×444; real dark→light toggle and both Next Run themes observed. Load-example/scroll actions reported failure; no full browser calculation/Copy/Clear result is claimed. Shared header clips/overflows at 310 px; existing global header was left unchanged. All-six-tool/desktop/worker-CSP/clipboard/live-console acceptance remains pending. Standalone lint still exit 1/missing config; dependency findings unresolved.
- Current production preview: `http://localhost:3000/stations/cron`, background shell **`sh_10a8bf929001Os0NNq60P0zvn7`**. **Stop the server before rebuilding `.next`.** The earlier Text preview was no longer active; do not assume historical shell IDs are running.
- Next: only remaining browser acceptance when authorized/available, or a new scoped task. No further station implementation is active.

## Text Station — implementation 2026-10-03; documentation completed 2026-10-05 (previous)

Corrected only the 31 specified Text routes. Audit, conventions, limits and pending acceptance: `docs/TEXT_STATION.md`.

- `config/text-tools.ts` contributes `textContract` entries to central `config/tools.ts`; exact inputs/options/examples/outputs, two reciprocal direction pairs and route-specific metadata. `character-counter-no-spaces` redirects to `character-counter-without-spaces` in `next.config.ts`. Shared route shell changes are conditional on Text contracts.
- `components/TextWorkspace.tsx` / `.module.css`, lazy exact-ID dispatch in `ToolWorkspace.tsx`: no fake generator source, upload, generic operation settings, Download or Use output as input. Stable IDs, associated errors, exact visible-value Copy (including empty/CRLF), full Clear, labeled diff cards paginated 50/page and stale-result/abort guards.
- Engines: `lib/tools/text/{engine,shared,unicode,diff,client,types}.ts`, `workers/text-station.worker.ts`. Intl.Segmenter grapheme counting/reversal with code-point fallback, line-record preservation, literal replacement, occurrence extraction, fixed NFC/LF, bounded unit generation, secure Fisher–Yates and lazy local LCS diff. No new dependencies.
- Limits: 1M UTF-16 units/field, 100k line records, 4M output budget including structured payload, 10k extraction hits. Diff 2k lines/side and 4M cells. Generators max 100k characters/10k words/1k sentences/100 paragraphs. Regex requires a disposable 1,500 ms worker; diff/large work 10 seconds. No unsafe regex/diff fallback or silent truncation.
- Public Text routes bypass unchanged legacy Text/Regex components and workbench. This fixes the previous broad-prefix misrouting of Regex Line Extractor without editing Regex Station. Global CSS/theme and all other station engines/components/tests preserved. No ad/analytics/Pro abstraction was found or invented; no user-content logs/requests/storage.
- Executed: typecheck; **2,676 tests / 34 files** (535 new Text tests); build **167 pages / 160 tool URLs**; `node scripts/verify-text.mjs` covering 31 pages/examples, 34 links, nine scripts, one redirect, five other-station routes, compiled semantic vectors and pathological regex thread timeout/recovery. Both worker/diff assets served. Node VM/thread and jsdom checks are not browser acceptance.
- Scope: **100 protected pre-existing source hashes**, **129 non-Text runtime registry entries** unchanged. Snapshot `/private/var/folders/69/l4j48t2j7pd9npmrwgw19ldc0000gn/T/opencode/text-contract-3R5WvQ/`. No Git repository/commit/push/deployment.
- Resumed verification 2026-10-05: typecheck, all 2,676 tests / 34 files, production build and `node scripts/verify-text.mjs` passed again. Lint again exited 1. The previous preview was offline; no workspace Next server was running during the new build. The old temporary scope snapshot is now absent (`ENOENT`), so the earlier 100-hash/129-entry scope comparison could not be repeated; those counts are historical verified results, not a fresh comparison.
- Blockers: standalone lint exits 1 for absent ESLint config. Browser previously required website-access review; the new open attempt timed out and tab inspection returned no tabs. Live light/dark/mobile/toggle, history/clipboard, browser workers/CSP and console checks remain pending. Existing dependency findings unresolved.
- Current production preview: `http://localhost:3000/tools/text-counter`, background shell **`sh_10a67b41d001In6MXKTHtOmoEN`**. Restarted after the resumed build and verified by HTTP. **Do not build into `.next` under an active server.**
- Next: browser checklist after access review, or await a new authorized request. No further station implementation is active.

## Date & Time Station — 2026-10-03 (previous)

Audited/corrected only all 17 specified Date & Time tools. `docs/DATE_TIME_STATION.md` replaces the old expansion description with current exact contracts, conventions, test evidence and browser checklist.

- `config/date-time-tools.ts` contributes `dateTimeContract` to central `config/tools.ts`; all fields/defaults/examples/outputs/related links and directional metadata. Canonical Unix converter is now `unix-timestamp-converter`, with old `timestamp-converter` permanently redirected in `next.config.ts`. Date↔timestamp uses real reciprocal links; no hidden epoch reverse mode.
- `components/DateTimeStation.tsx` / `.module.css` now render exact native controls, searchable IANA suggestions, conditional weekday checkboxes, associated validation, stable IDs, individual exact Copy and full Clear. All timezone inputs start empty. No Download, extra format/timezone/DST/endpoint/leap-policy controls. Shared calendar/clock components and global theme remain unchanged.
- `lib/tools/date-time/{engine,types}.ts` reuse unchanged `lib/tools/date-time-station.ts` for Date/Intl IANA parsing. Strict decimal timestamps use BigInt, ISO conversion requires offset, gaps/folds both reject. Current Time refreshes only on action; Relative requires its supplied reference; Age reads today only for future-birth validation. No dependencies or workers added.
- Fixed conventions: local-zone signed elapsed differences, undated time wraps midnight once, six explicit date formats, Sunday week1 contains Jan1/calendar year, inclusive business endpoints with deduplicated supplied holidays and selectable weekdays, Feb28 clamped leap birthday. Years 0001–9999/ms precision; holiday text 10k chars/1k entries; no public-holiday inference. Details in station docs.
- Executed checks: typecheck; **2,141 tests / 30 files**; Date engine/helper suite under `TZ=America/New_York` **195 tests**; build **167 pages / 160 tool routes**; production script **17 routes**, 20 links, nine scripts, one alias, five other-station routes, all compiled-engine examples and DST/negative timestamp vectors. An async hydration test now awaits lazy results; final full suite passed.
- Scope: **91 protected source hashes** and **143 non-Date/Time runtime metadata entries** unchanged. Snapshot `/private/var/folders/69/l4j48t2j7pd9npmrwgw19ldc0000gn/T/opencode/date-contract-fRrV13/`. Existing shared controls/helper library and all other station sources/tests preserved. No Git repo/commit/push.
- Blockers: lint exits 1 for missing ESLint config. Browser tab `tab_murwilwu_1` requires selecting/reviewing website access; navigation/observation returned `needs_attention`, so live theme/mobile/toggle, history, clipboard, console/hydration acceptance remains pending. Existing dependency findings unresolved. No ad/analytics/Pro abstraction existed or was introduced.
- Current production server: `http://localhost:3000/tools/date-to-timestamp`, background shell **`sh_1015da090001e8c7hudRggywiT`**. Both originally active dev/prod servers were stopped before builds. **Stop the active server before rebuilding `.next`.**
- Next: complete Date & Time browser checklist after website-access review, or await a new authorized task. No other station implementation is active.

## Regex Station — 2026-10-03 (previous)

Corrected only all nine specified Regex public routes. Audit/contracts/limits/browser checklist: `docs/REGEX_STATION.md`.

- `config/regex-tools.ts` contributes `regexContract` to the existing central registry. Exact fields/examples, g/i/m/s/u/y/d checkboxes, independent Flag Tester, structured builder, matching/capture/split results, Copy/Clear only. IDs/slugs unchanged; no aliases needed.
- `components/RegexWorkspace.tsx` / `RegexStation.module.css`, lazy exact-ID branch in `ToolWorkspace.tsx`, scoped route metadata/content in `app/tools/[slug]/page.tsx`. Stable IDs, error associations, keyboard controls, safe text cards, 50-item output pagination and abort/stale-result guards. Global theme/toggle unchanged.
- `lib/tools/regex/{types,engine,structure,replacement,client}.ts` and `workers/regex-station.worker.ts`: native browser RegExp/replace/split, strict selected flags, capture definition scanner after native validation, null/unmatched groups, Unicode zero-length advancement, bounded replacement preflight. No added dependencies.
- Every user regex execution requires a local worker; no main-thread fallback. Timeout 1,500 ms. Pattern limit 16,384 UTF-16 units; text/replacement/literal 200,000; 2,000 matches/split parts; 4M output budget including structure. Limits error rather than silently truncating. Escape/structured builder can run without Worker because they do not execute user regex.
- Legacy `components/RegexStation.tsx`, `lib/tools/regex-station.ts`, `workers/regex.worker.ts` are preserved for old workbench consumers. The pre-existing broad regex-prefix legacy branch also handles a Text tool; isolating the new workspace avoids changing that out-of-scope behavior. All nine public Regex routes bypass the legacy path.
- Final executed checks: typecheck; **1,925 tests / 28 files** (357 new Regex tests); build **167 pages / 160 tool URLs**; `node scripts/verify-regex.mjs` covering nine pages/examples, 12 navigation links, nine scripts, five other-station routes, emitted-worker semantic vectors, actual catastrophic-regex thread termination at 1,500 ms and new-worker recovery. These Node VM/thread and jsdom checks do not prove browser behavior.
- Scope: 82 protected existing source hashes and the original legacy RegexStation hash unchanged; all 151 non-Regex runtime metadata entries unchanged. Snapshot: `/private/var/folders/69/l4j48t2j7pd9npmrwgw19ldc0000gn/T/opencode/regex-scope-EOKLBo/`. No Git repo/commit/push.
- Blockers: lint exit 1 (missing ESLint config); built-in navigation/observation timeout. Live theme/mobile/toggle, clipboard permissions, browser workers/CSP, history, console and hydration acceptance remain pending. No existing ad/analytics/Pro abstraction was found; none was added. Prior dependency findings remain unresolved.
- Current production server: `http://localhost:3000/tools/regex-tester`, background shell **`sh_1012df5f90018hV9MdJhfuWDV2`**. Both the initially active dev server and intermediate preview were stopped before builds. **Stop this server before any new `.next` build.**
- Next: browser checklist when access works, otherwise await an authorized request. No further station work is active.

## Security & Crypto Station — 2026-10-03 (previous)

Implemented/corrected only the 22 specified Security routes; see `docs/SECURITY_STATION.md` for the per-tool audit, exact semantics and outstanding browser acceptance.

- Metadata/UI: `config/security-tools.ts` contributes `securityContract` entries to `config/tools.ts`; dedicated lazy `components/SecurityStation.tsx` and `.module.css`; exact controls, no extra generator text/algorithms/downloads, deterministic IDs, safe text results, per-part Copy, Clear and abort/stale-result protection.
- Crypto: `lib/tools/security/{generators,hashes,md5,index,client,types}.ts`, `workers/security.worker.ts`. Native getRandomValues/digest/importKey/sign; secure rejection sampling, UUID v4/v7, ULID, category entropy and local strength heuristics. MD5 lazy-loads only when selected. No added dependencies. Legacy helpers remain unchanged but no longer serve public Security routes.
- Route integration is limited to the lazy workspace, Security metadata/content and three permanent redirects: `sha-256`, `sha-512`, `random-string`. No ads/analytics abstraction existed; none was invented. No secret logging, requests, persistence or predictable random fallback in the new path.
- Limits: 64 MiB files, 1,000,000 code units/text value; files/larger text use disposable 30-second workers. Files are whole-buffer native digests, not streaming. No-worker fallback limited to 8 MiB files/16,384 text units. Empty HMAC message valid; empty key explicitly rejected. UUID/ULID ordering within a millisecond is not guaranteed. JavaScript cannot promise secure memory erasure.
- Executed: typecheck; **1,568 tests / 24 files** (233 new Security tests); production build **167 pages / 160 tool routes**; `node scripts/verify-security.mjs` covering 22 pages, 25 links, nine scripts, three aliases, five other-station routes, all 22 compiled-worker examples and additional vectors/four assets. VM/jsdom are not browser evidence.
- Scope: 69 protected pre-existing source hashes unchanged; 138 non-Security runtime catalog entries unchanged. Baseline: `/private/var/folders/69/l4j48t2j7pd9npmrwgw19ldc0000gn/T/opencode/security-scope-5JMalF/`.
- Blockers: standalone lint exits 1 for missing ESLint config; live browser navigation/observation timed out. Real theme/mobile/toggle, browser clipboard/workers/CSP, history and console acceptance remain pending. Existing dependency findings remain separate maintenance.
- Current production preview: `http://localhost:3000/tools/uuid-generator`, background shell **`sh_100cf969d001Ox08ZM8UkjNkF7`**. The prior Encoding server was stopped. **Stop the active production server before building `.next`.** No Git repository, branch, commit or push.
- Next: complete the Security browser checklist when access works, or await a new authorized task. Implementation is complete at the automated-verification level, not a claim of full browser acceptance.

## Encoding Station — 2026-10-03 (previous)

Corrected the Encoding station only: 35 canonical tools, 17 inverse pairs and seven old combined-route redirects. Full audit/semantics/test details: `docs/ENCODING_STATION.md`.

- Metadata: `config/encoding-tools.ts` contributes to `config/tools.ts` via `encodingContract`; exact fields, output names, examples, pair/related metadata. Shared route shell adds only Encoding-specific canonical/index/purpose/usage/related content. `next.config.ts` preserves JSON/Data redirects and adds Encoding aliases.
- UI: `components/EncodingStation.tsx` and `.module.css`, lazy branch in `ToolWorkspace.tsx`. No extra settings/upload/download fields. Empty initial state, exact text/part Copy, all-fields Clear, stable IDs, source-associated errors, abort/stale-result guards. JWT explicitly says decoding is not verification; HTML/Data URI output is inert text.
- Engines: `lib/tools/encoding/{bytes,structured,index,client,types}.ts`; selective worker in `workers/encoding.worker.ts`. Strict UTF-8 and encodings, HTML5 entities, source-preserving JWT JSON, Data URI MIME/mode/text and validated IDNA. Lazy runtime `entities`/`tr46`, dev `@types/tr46`; no library for native byte/URI operations.
- Old generic encoding helpers/workbench are preserved for legacy consumers, but public Encoding routes bypass them. Other station implementations and the global theme were not edited; 40 protected source hashes were verified unchanged.
- Checks passed: `npm ci`, typecheck, **1,335 tests / 20 files**, production build **167 generated pages / 160 tool URLs**. Reproducible production check: `node scripts/verify-encoding.mjs` against running preview; 35 SSR/metadata pages, 38 links, nine page assets, seven aliases, five other-station routes; all compiled-worker examples and five lazy assets passed in a VM runtime (not a browser).
- Production verification found/fixed a minifier bug that changed the literal Unicode-escape placeholder; example now constructed from code units and covered by the production check.
- Blockers: standalone lint remains exit 1/missing config. Browser navigation and two observations timed out; real dark/light/mobile, Back/Forward/refresh, browser workers/CSP/clipboard permissions and live console remain pending. jsdom keyboard/theme-attribute/hydration tests passed, not visual proof.
- Preview is now `http://localhost:3000/tools/base64-encoder`, background shell **`sh_1007effc4001xI4kDYvGEOS49u`**. Both earlier dev/prod processes were stopped before builds. **Stop this server before rebuilding `.next`.** No Git repository/commit.
- Next: complete only the browser checklist or await the next authorized task. Existing lint/dependency-audit remediation remains separate maintenance.

## JSON & Data Station — 2026-10-03

Implemented/corrected only the 46 requested JSON/Data public routes. Read `docs/JSON_DATA_STATION.md` for the per-tool audit, exact mapping policies, parser/query/schema limitations and unfinished browser checklist.

- Catalog: `config/json-data-tools.ts` feeds `config/tools.ts`; six old IDs/slugs redirect via registry-derived `next.config.ts` rules. JSON Unescape is the one additional tool identity (152 total tool routes now).
- UI: `components/JsonDataStation.tsx` / `.module.css`; lazy branch in `ToolWorkspace.tsx`. Exact fields only, inverse route links, safe expandable tree, labels/errors, copy/clear/examples, destination-specific download extensions. Source values stay in memory; editing/clearing aborts work and invalidates results.
- Engines: `lib/tools/json-data/{json,csv,markup,index,client,types}.ts`, `workers/json-data.worker.ts`. Local worker calculations with timeout/limits; no network, eval, Function parser or rendered user HTML. Added interpretive `@cfworker/json-schema`, `smol-toml`, direct `saxes`; reused YAML. Legacy helpers remain untouched for other consumers but no longer handle public JSON/Data routes.
- Shared route shell changes are conditional on `dataContract`: canonical/index metadata, two concise factual AEO sections, related links. No global CSS/theme or other station component/engine edits. No AdSlot/analytics/Pro abstraction existed to reuse; none was invented.
- Checks actually passed: `npm ci`; `npm run typecheck`; `npm test` **855 tests / 16 files**; `npm run build` **159 pages / 152 tool URLs**. Production HTTP: 46 station pages (SSR/metadata), 49 navigation URLs, six 308 aliases, five unrelated station pages. Compiled worker executed all 46 examples in an isolated VM worker-like runtime; seven JS assets served successfully. This is not browser execution evidence.
- `CI=1 npm run lint < /dev/null`: exit 1, existing missing config. Built-in browser navigated but observations timed out; real light/dark/mobile layouts, browser Back/Forward, actual clipboard/download permissions, workers/CSP and live console still need manual acceptance. Unit/jsdom hydration and both DOM-theme interaction matrices passed.
- Production preview now runs on **port 3000**, background shell `sh_10050f9ca001v35e1SilcUWg26`. Previous dev/production process was stopped before rebuilding. **Do not build into active `.next`.** No Git repository/commit.
- Next step: browser acceptance checklist only; keep future work scoped rather than expanding other stations. Existing standalone lint and dependency-audit remediation are separate maintenance work.

## Breadcrumb navigation — 2026-10-03

- Updated `app/tools/page.tsx` and `app/tools/[slug]/page.tsx`: all breadcrumb segments are Next links, including the current page. Category links use encoded `/tools?category=...` filters. Navigation has an accessible label, hidden slash separators, and one `aria-current="page"` link.
- `components/Breadcrumbs.test.tsx` verifies all registered tool routes, category listings, and the unfiltered listing: 158 focused tests passed. `npm run typecheck` passed. No production build or browser navigation check performed for this small change.

## Latest repair — 2026-10-03

Addressed two reported hydration mismatches without removing the newly added `react-calendar`/`react-clock` controls:

- `app/layout.tsx`: `suppressHydrationWarning` only on `<html>` for intentional prepaint `data-theme`; safe storage reads. `components/ThemeToggle.tsx`: safe reads/writes while retaining illustrated switch and keyboard behavior.
- `components/DateTimeStation.tsx`: explicit semantic field names scoped by DateTimeToolId; deterministic heading IDs. `CalendarPicker.tsx`, `TimePicker.tsx`, `DateTimePicker.tsx` accept optional explicit IDs; unrelated consumers retain `useId` fallback.
- IDs assume one instance of a given tool per document (current route design). If a future split view embeds the same tool twice, supply a stable instance scope shared by SSR/client rather than duplicating these IDs.
- `components/ThemeToggle.test.tsx`: actual document hydration, system/saved/blocked-storage themes, keyboard changes, and proof descendant mismatches remain visible.
- `components/date-time-hydration.test.tsx`: generated-ID drift reproduction and stable hydration across all 16 tools, retained server nodes, valid label/ARIA links, picker selection, conditional fields, and calculations. Deliberately different hydration namespaces reproduce the reported symptom, not the underlying Next/Suspense cause.
- Checks: `npm test` 142/142; typecheck passed. Dev HTTP smoke for age calculator confirmed stable field labels. No production build while active dev server uses `.next` on port 3000. Browser opened age page but site-access approval is needed to inspect the live console.
- Next: fully reload `/tools/age-calculator` to discard old HMR markup and verify the console. Production-build verification requires stopping the server first. Existing lint/audit gaps below are unchanged.

## Current task — Date & Time expansion (2026-10-02)

Added all 16 requested tools; retained `/tools/timestamp-converter` and existing processing behavior. No SEO/AEO/GEO content was added. All date inputs and calculations stay in client memory.

## Architecture and files

- `config/date-time-tools.ts` — typed metadata for the new tools; imported by the central `config/tools.ts`. Date ↔ timestamp routes are paired.
- `components/DateTimeStation.tsx` / `.module.css` — tailored conversion, zone, clock, difference, relative, format, week, leap-year, weekday, and age interfaces.
- `lib/tools/date-time-station.ts` — explicit parsing, runtime IANA/DST resolution, Gregorian calendar arithmetic. Corrected fractional-format parsing (`.007`) and same-day inclusivity during review.
- `components/ToolWorkspace.tsx`, `app/tools/[slug]/page.tsx` — lazy station/legacy workbench selection without adding branches to the existing giant workbench.
- Tests: `lib/tools/date-time-station.test.ts`, `config/date-time-tools.test.ts`, `components/DateTimeStation.test.tsx`. `vitest.config.ts` adds JSX/alias support. Testing Library and jsdom are dev-only dependencies in `package.json` / `package-lock.json`.
- Updated project/architecture/decision docs. Complete semantics and smoke steps: `docs/DATE_TIME_STATION.md`.

## Actual verification

- `npm test` — 109 tests passed across 8 files.
- `npm run typecheck` — passed.
- `npm run build` — passed, 158 generated pages, 151 prerendered tool URLs.
- `TZ=America/Los_Angeles npm test -- lib/tools/date-time-station.test.ts config/date-time-tools.test.ts` — 55 passed.
- HTTP smoke: all 16 additions plus timestamp, JSON Formatter, Regex Tester, and Text Counter returned 200 with their expected controls. Station links present.
- `CI=1 npm run lint < /dev/null` — exit 1; deprecated `next lint` prompts for missing ESLint configuration. Not passed.
- `npm audit --omit=dev --audit-level=high` — exit 1; existing Next/PostCSS chain reports high/moderate findings. Do not run `audit fix --force` blindly.
- Browser visual review — open timed out, no tab created. No claim of visual/mobile/cross-browser approval.

## Runtime / Git

- Validated on Node 22.19.0 and npm 10.9.3; use Node 22.13+ for jsdom 29 tests.
- No `.git` directory: no branch, diff base, or commit. No Git initialization was performed.
- Production preview was started with `npm run start -- -p 3001`, timeout disabled. Verified `http://localhost:3001/tools/timezone-converter`. Stop that process before rebuilding `.next`; simultaneous servers/builds previously caused missing-chunk errors.

## Next concrete steps

1. Configure ESLint and remediate the Next/PostCSS dependency findings in a separately verified maintenance change.
2. Complete the real-browser checklist in `docs/DATE_TIME_STATION.md` (mobile, themes, date/time widgets, DST errors, copy/download).
3. Preserve semantic limits: DST gaps reject, folds choose earlier/later; business days exclude Saturday/Sunday only; clock tools show device-clock snapshots, not server time.
