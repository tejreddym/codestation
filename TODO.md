# TODO

- [x] Match the illustrated theme toggle to the station palette; verify behavior, mobile target and production build (2026-10-07).

- [x] Create and validate the dark/light SVG brand kit, transparent PNG sizes and platform/social assets (2026-10-07).

## Workbench release — 2026-10-07

- [x] Ship the eight prioritized improvements and Smart Detection with bounded first-release coverage; see docs/WORKBENCH.md.
- [x] Wire feedback to twnspace2@gmail.com using an explicit email draft, with local copy/download fallbacks.
- [x] Expand the codestation.in sitemap to 323 public pages and verify every route.
- [x] Verify offline JSON/text processing with the local server stopped; correct encoded dynamic-route cache keys.
- [x] Resolve JSON station registry ID/slug lookup (all 46 tools discoverable).
- [ ] Cross-browser clipboard focus/manual paste checks and physical device installation/offline checks.
- [ ] Verify completed ZIP download bytes in browsers with an observable download path.
- [ ] Expand workflows, batch source formats and contextual tool help based on feedback; current scope is documented.
- [ ] Keep ads and speculative new-tool candidates separate from this release. Finalize operator/legal details before launch and explicitly enable indexing when ready.

- [x] Configure codestation.in sitemap with all 317 public canonical page URLs and verify XML coverage (2026-10-07).

## Site-wide design follow-up — 2026-10-07

- [x] Extend homepage identity to all existing page families; preserve tool functionality and session state.
- [x] Verify directory completeness, existing tests, typecheck, lint, production build and all public destinations.
- [x] Capture matched desktop/mobile light/dark comparisons; record limitations in docs/site-redesign/VERIFICATION.md.
- [x] Resolved in the workbench functionality release: station-owned IDs now resolve by ID, restoring all 46 JSON & Data entries.
- [ ] Broader manual verification: OS reduced motion, browser zoom, physical touch, screen readers and cross-browser download completion.


## Homepage reinvention — 2026-10-07

- Replaced the homepage composition with a centered editorial hero and native search, original Station Assembly SVG, compact quick links, three illustrated showcases, a registry-driven ruled station index, processing note and lime wordmark footer. All 15 stations and existing counts/routes remain; Developer Math is pending.
- Added scoped ivory/charcoal/lime tokens and an 800ms CSS-only entrance with reduced-motion rules. Four decorative SVGs measure **5,635 raw bytes / 1,472 gzip bytes**. No dependencies, fonts, engines, routes, providers, search algorithms, input types or theme persistence changed.
- Checks: **5,293 tests / 87 files passed under Node 22.19.0**; typecheck and production build passed; lint completed with existing warnings. All **30 distinct homepage destinations** return HTTP 200. Contrast, canonical links and decorative semantics verified with `scripts/verify-homepage.mjs`.
- Browser: inspected 320, 390, 768, 1024 and 1440 widths, including 1024×600; verified search/no-results/Clear, keyboard link selection and focus, mobile Menu/Close/Stations anchor, theme and refresh, and JSON formatting/Clear. Image route retains native file/number/select controls. Production browser recorded no console errors. Matched before/after desktop and mobile screenshots cover both themes.
- Limitations: live OS reduced-motion, browser zoom, physical touch, full network trace and cross-browser/screen-reader testing were not performed. Asset-origin/source checks found only local homepage assets; this is not a network-capture claim. Initial Node 25 test run had nine unchanged theme-test storage failures; documented Node 22 passes all tests.
- Design/reference/motion details: [docs/HOMEPAGE_DESIGN.md](docs/HOMEPAGE_DESIGN.md). Evidence and detailed check boundaries: [docs/homepage-redesign/VERIFICATION.md](docs/homepage-redesign/VERIFICATION.md). No Git repository or deployment. Stop after homepage work; no new station was started.


## Now

- [x] Complete presentation-only visual redesign across homepage, `/tools`, all 15 station landings, tool-page shell, specialized workspace styles, supporting pages, native controls, cards, panels, responsive layouts, and shared tokens. See `docs/UI_VISUAL_STANDARD.md`.

- [ ] Finish live visual acceptance at desktop widths and in both themes for every implemented station/workspace. Automated tests and representative 310px browser renders pass; full interaction, console/network, clipboard/download, uploads, and editor/theme persistence remain open.

- [x] Redesign the homepage, standardize all 15 implemented station landings, add shared scoped search/cards/counts, responsive header/footer, informational pages, third-party notices, origin-gated sitemap/robots, and evidence-based policy content. Developer Math remains pending. See `docs/STATION_PAGE_STANDARD.md` and `docs/SITE_FOUNDATIONS.md`.

- [ ] Resolve owner facts before treating `/privacy`, `/terms`, `/licenses`, or deployment indexing as final: operator/legal entity, contact, hosting/retention, jurisdiction, project license, and illustrated-theme provenance.

- [ ] Complete Converters Station live browser acceptance for discovery, units, temperature, and number bases. Automated/full gates and HTTP smoke are complete; see `docs/CONVERTERS_STATION.md`.

- [ ] Complete Color & CSS live browser acceptance for converter/picker/palette/contrast/gradient/shadow/radius. Automated gates are complete; see `docs/COLOR_CSS_STATION.md`.

- [x] Add shared smart-converter capability registry, memory-only source sessions, route-backed Output Format controls and explicit all-station audit. Focused typecheck/448 tests passed.
- [ ] Complete live smart-converter acceptance: Image mislabeled/transparency/stale/download, Spreadsheet multi-sheet CSV/JSON/TSV routing, JSON/Data and Markdown route preservation, Back/Forward/refresh, metadata, themes/mobile, console/network. Production HTTP smoke passed; browser interaction/download bytes remain open. See `docs/SMART_CONVERTER_STANDARD.md` and `docs/SMART_CONVERTER_AUDIT.md`.

- [x] Implement Image, Spreadsheet and Markdown stations sequentially:28 Image workflows,20 Spreadsheet tools,18 Markdown tools; focused automated gates passed.
- [ ] Complete live browser acceptance for all three stations: processing, genuine downloads/clipboard, themes, responsive/mobile, accessibility, workers/codecs, sanitization/CSP and console. Browser evidence is limited to Image/Spreadsheet landing and controls; Markdown tab could not be reopened. See station docs.

- [x] Image station gate:28workflows, typecheck and265 focused engine/UI/registry tests.
- [ ] Image live-native processing/clipboard/download/AVIFdecode/cropper/theme/responsive/console acceptance; browser landing/controls only verified. `docs/IMAGE_STATION.md`.

- [x] Implement exactly16 API tools and `/stations/api`, static cURL/Fetch conversions, HTTP/JSON/GraphQL/auth utilities and explicit direct-browser tester; typecheck,4,582 tests,231-page build and16-route production/regression script passed.
- [ ] Complete API all16-tool live-browser Copy/Clear/keyboard/theme/mobile/desktop, paired history/refresh, approved safe tester endpoints/CORS/cancel/no-retry and live console/hydration/CSP acceptance. Narrow landing DOM verified; image check failed. See `docs/API_STATION.md`.

- [x] Implement exactly 21 Web contracts and `/stations/web`, local URL/reference/generator engines, browser-local PNG favicon conversion, structured accessible controls, downloads and privacy boundaries; typecheck, 4,058 tests and production build passed.
- [ ] Complete Web real-browser all-21-tool processing/Copy/Clear/download, favicon native decoding, no-network/CSP/console, light/dark/mobile/desktop, paired route/history and live accessibility acceptance. Checklist: `docs/WEB_STATION.md`.

- [x] Implement all17 SQL/Database contracts and `/stations/sql-database`, lazy four-dialect parser/formatter, typed builders, strict conversions, redacted credentials and declared-only ER; pass automated/production/regression checks.
- [ ] Complete SQL/Database real-browser all17-tool processing/Copy/Clear/CSV download, worker/CSP, credential privacy, light/dark/mobile/desktop, ER and live-console acceptance. Partial narrow light landing/Formatter observed; checklist: `docs/SQL_DATABASE_STATION.md`.
- [x] Add reused UTC calendar/clock to Cron reference date/time and an explicit per-click Current date and time action; verify precision, host-DST independence, Clear/cancellation and existing picker regressions.
- [ ] Complete live-browser Cron reference picker/current-time mobile and keyboard acceptance; automated component, build and production markup checks passed.
- [x] Implement only six Cron contracts and `/stations/cron`, explicit Unix/seconds syntax, local parser/worker evaluator, deterministic human phrases, IANA/DST conventions, exact actions and registry/navigation/metadata; automated/production checks passed.
- [ ] Complete Cron real-browser all-six-tool processing/Copy/Clear, light/dark/mobile/desktop, worker/CSP/timeouts, search/navigation and live-console acceptance. Partial 310 px Next Run/theme check succeeded; shared header overflow remains a separate global-layout gap. Checklist: `docs/CRON_STATION.md`.
- [x] Audit/correct all 31 Text contracts, Unicode/line handling, literal replacement, generators without fake inputs, occurrence extraction, bounded local workers, diff and direction-specific registry/metadata; automated/production checks passed.
- [ ] Complete Text real-browser acceptance when browser access works (latest open timed out, no tabs retained): theme/mobile/toggle, keyboard, exact clipboard/CRLF, diff pagination, worker timeout/recovery, directional history/refresh and live console. Checklist: `docs/TEXT_STATION.md`.
- [x] Audit/correct all 17 Date & Time public contracts, strict timestamp/ISO/IANA handling, custom weekends/holidays, native controls, per-row Copy/Clear and direction-specific metadata; pass automated/production checks.
- [ ] Complete current Date & Time browser acceptance after selecting the tab and reviewing website access: light/dark/mobile/toggle, native controls, direction Back/Forward/refresh, clipboard and live console. Current checklist: `docs/DATE_TIME_STATION.md`.
- [x] Audit/correct all nine Regex public routes: exact contracts, native selected-flag semantics, worker isolation, structured/paginated results, Copy/Clear, registry/metadata and automated/production checks.
- [ ] Complete Regex real-browser light/dark/mobile/toggle, clipboard, keyboard, worker/CSP/timeout recovery, direct refresh/history and console acceptance. Built-in browser timed out; checklist: `docs/REGEX_STATION.md`.
- [x] Audit/correct all 22 Security & Crypto routes, exact controls, native crypto/CSPRNG, bounded local workers, privacy, registry, redirects and automated/production checks.
- [ ] Complete Security real-browser dark/light/mobile/toggle, direct refresh/history, keyboard, clipboard, workers/CSP, privacy and live-console acceptance. Browser navigation/observation timed out; checklist: `docs/SECURITY_STATION.md`.
- [x] Audit/correct all 35 Encoding routes, exact controls, strict engines, paired navigation, local processing and metadata; pass automated/production checks.
- [ ] Complete Encoding real-browser light/dark/mobile, direction links/Back/Forward/refresh, live console and workers/clipboard checks. Browser observations timed out; checklist in `docs/ENCODING_STATION.md`.
- [x] Audit and correct all 46 JSON/Data route contracts, isolated interfaces, engines, local worker safety, registry, metadata and automated tests. See `docs/JSON_DATA_STATION.md`.
- [ ] Complete JSON/Data real-browser acceptance: both themes, mobile/desktop layout, all inverse links with refresh/Back/Forward, actual workers, clipboard/download and console. Browser observations timed out; jsdom/HTTP/built-worker checks passed.
- [x] Make every breadcrumb clickable, including station and current-page segments; verify destinations across the registry.
- [ ] Verify the hydration repair with a fresh page load in the live browser console (browser access approval pending); run production build after stopping the active dev server.

- [ ] Resolve the existing Next/PostCSS production dependency audit findings; test any framework/dependency update separately (no blind force fix).
- [ ] Finish the updated Date & Time real-browser checklist in `docs/DATE_TIME_STATION.md`; jsdom/HTTP/compiled-engine checks passed, browser website-access review pending.
- [x] Add the 16 Date & Time tools, metadata, shared engine, specialized UI, DST/calendar validation, and interaction tests.
- [x] Integrate open-source `react-calendar` and `react-clock` components across all date and time inputs with DD MM YYYY formatting and analog clock dial.
- [x] Add robust JSON parse-location errors and JSON/Data utility tests in the dedicated station.
- [ ] Add ESLint flat config and accessibility smoke tests.
- [ ] Expand Color or other subsequent stations only when explicitly requested; SQL implementation has its documented parser/resource and browser-acceptance limits.
- [x] Isolate public Security/Hashing routes in a dedicated lazy station alongside JSON/Data, Encoding and Date & Time; legacy workbench remains for other consumers.
- [ ] Add browser-level tests for clipboard, Web Crypto, and responsive controls.
- [x] Replace the public JSON/Data processing path with strict schema, XML/TOML and CSV engines and canonical route aliases.
- [x] Add contract-specific JSON/Data layouts, selected CSV column controls and schema/query secondary inputs.
- [x] Add focused fixtures for JSON Schema, XML, TOML, YAML and CSV edge cases; full official conformance-suite coverage is not claimed.
- [ ] Replace manual workbench dispatch with typed station-specific handlers as the registry grows.
- [x] Add station-specific Encoding UI with exact labels/examples for every directional route and complete route synchronization.
- [ ] Add browser compatibility smoke tests for `atob`, `btoa`, TextEncoder, and TextDecoder fallbacks.
- [x] Add dedicated Security Station layouts for algorithm selection, file hashing, HMAC secrets, and random-value options.
- [ ] Add browser-level privacy tests confirming file hashing and password inspection do not upload data.
- [ ] Complete live-browser Regex timeout and structured-match/builder coverage; Node-thread timeout/recovery and jsdom contract workflows are tested, not visual proof.
- [ ] Complete visual/E2E Text diff, literal replacement counts, regex line extraction and line-ending/indentation acceptance; jsdom/production checks are not live visual proof.
- [ ] Add dedicated station-level examples and related-tool navigation as the library continues to grow.

## Next

- [x] Add reproducible Cloudflare Workers/OpenNext configuration, static caching headers, runtime scripts, and deployment documentation (2026-10-08).
- [x] Add a pinned Node toolchain, GitHub checks workflow, and repeatable Worker preview smoke script (2026-10-08).
- [ ] Connect Workers Builds to `tejreddym/codestation`, set production build variables, attach `codestation.in`, and complete a production smoke check.
- [ ] Establish CI checks beyond the Cloudflare Workers Build gate.
- [ ] Add authentication, billing, persistence, ads, and admin boundaries when product scope requires them.

## Later

- [ ] Continue useful station expansion in verified batches, not to satisfy an arbitrary tool count.

## Blocked

- Standalone lint: completes with existing accessibility, image, and hook warnings; a clean lint baseline remains open.
- Deployment readiness: Cloudflare account/domain setup, production dependency audit, and cross-browser/manual checks remain open.
- [ ] Complete live-browser acceptance for the Converters landing and numeric converter controls (search/category filters, conversion, Copy/Clear, responsive/theme/console checks).
