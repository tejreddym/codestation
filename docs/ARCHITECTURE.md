# Architecture

## Implemented baseline

Code Station uses Next.js 15 App Router, React 19, TypeScript, and CSS tokens/modules. No conversion API, database, authentication, payment, or ad service is implemented. Netlify is the target, not a verified deployment.

The presentation layer is standardized in `docs/UI_VISUAL_STANDARD.md`. Shared semantic tokens in `app/globals.css` style the shell, navigation, cards, catalogs, panels, native controls, and responsive layout without changing the client boundaries or tool state model. Specialized CSS modules continue to own editor, file, image, spreadsheet, table, and picker presentation.

## Discovery and routing

`config/tools.ts` is the public metadata registry. Homepage search, station links, `/tools` filtering, `/tools/[slug]` params, and the existing sitemap consume it. `config/date-time-tools.ts` supplies a typed metadata-only station catalog; `RegisteredToolId` includes those IDs without putting processing code into discovery bundles. Existing `ToolId` remains the legacy workbench ID union.

Each tool retains its route. Date to Timestamp and Timestamp to Date share a conversion family but have independent registry identity and pair metadata. No new SEO/AEO/GEO content layer was introduced.

Cron adds six `cronContract` entries, SQL & Database adds 17 `sqlContract` entries, and Web adds 21 `webContract` entries to that central registry. `config/stations.ts` is now an explicit allowlist for all 15 implemented station landings, deriving metadata, unique tool lists, counts, canonical routes, and related navigation. `StationLanding`/`ToolCatalog`/`ToolCard` provide the shared breadcrumb, local search/filter, card, empty-state, and related-station pattern; station-specific workspaces remain specialized.

## Client boundaries and data flow

API contributes 16 metadata-only `apiContract` entries and `/stations/api`. `ApiStation` lazily loads bounded cURL/static Fetch converters and shared HTTP/header/query/body/local GraphQL/response helpers on action. Only `executeApiRequest` in `lib/tools/api/request.ts` invokes direct browser fetch on explicit Send Request, with AbortSignal, credentials omitted, no retries or backend proxy. All returned markup stays inert text. Existing JSON and `saxes` are reused; no dependency is globally introduced. Supported literal/executable subsets and CORS restrictions are documented in `API_STATION.md`.

Image, Spreadsheet and Markdown add metadata-only local contracts and dedicated lazy stations. Image uses browser File/Blob/bitmap/canvas adapters and strict static SVG parsing; output AVIF encoders are not exposed. Spreadsheet dynamically imports ExcelJS in a cancellable local worker after ZIP/header bounds checked with fflate; formulas are preserved/cached but never recalculated and macros are rejected. Markdown uses a bounded native parser plus YAML frontmatter; generated HTML is sanitized source text and never trusted application markup, while safe remote image URLs in a preview may still be requested by the browser. Their station docs record limits and browser gaps.

Smart converters use `config/conversion-capabilities.ts` for implemented source/target/route/runtime mappings and `components/ConverterSession.tsx` above the route boundary for memory-only source preservation. Image, Spreadsheet, JSON & Data and Markdown use the model where mappings are genuine; Encoding, Text, SQL and API contribute only real directional capabilities. Target changes use client navigation, preserve the original source session, invalidate result state and never put content in history or storage. See `SMART_CONVERTER_STANDARD.md`.

Color & CSS adds seven local tools behind `ColorCssStation` and the shared `lib/tools/color/engine.ts`. All color parsing and serialization uses one sRGB/alpha model. Contrast, palette and CSS generators use local values and remain specialized; only Color Converter participates in converter target/session semantics.

Converters adds a second discovery surface through `config/converter-tools.ts`, derived from the central capability registry and canonical `config/tools.ts` identities. It does not duplicate tool definitions or routes. `/stations/converters` filters those entries by discovery category and lazy-loads no processing engines. Unit, temperature and number-base tools are registered as stable-route numeric capabilities and are dispatched through `NumericStation`; their authoritative catalogs live in `config/unit-tools.ts`, `config/temperature-tools.ts`, and `config/number-base-tools.ts`, with pure engines under `lib/tools/{unit,temperature,number-base}`.

```text
Registry → server tool route → ToolWorkspace (client)
                                 ├─ dynamic WebStation → bounded native URL/reference/generator engines → local Blob/canvas favicon conversion
                                 ├─ dynamic SqlDatabaseStation → disposable parsing worker / bounded builders → per-dialect lazy parser/formatter
                                ├─ dynamic CronStation → bounded native parser / disposable Next Run worker → Date/Intl IANA intervals
                                ├─ dynamic TextWorkspace → small local operations / disposable worker → lazy text diff
                                ├─ dynamic RegexWorkspace → disposable worker → native JavaScript RegExp/replace/split
                                ├─ dynamic SecurityStation → native CSPRNG/Web Crypto or disposable worker → lazy MD5
                                ├─ dynamic EncodingStation → native/small work or selective worker → lazy encoding engines
                                ├─ dynamic JsonDataStation → disposable worker → lazy JSON/CSV/markup engines
                                ├─ dynamic DateTimeStation → date-time helpers
                                  ├─ dynamic NumericStation → authoritative unit/temperature/BigInt base engines
                                  └─ dynamic legacy ToolWorkbench → existing stations
```

Date & Time now has 17 exact `dateTimeContract` definitions in the central registry, native date/time controls, searchable IANA inputs and conditional custom-weekend checkboxes. `DateTimeStation` lazily loads `lib/tools/date-time/engine.ts` on action, returning only contracted structured rows with exact Copy/Clear. It reuses the unchanged Date/Intl helpers; existing calendar/clock widgets remain available to other consumers. CSS modules reuse theme variables without altering the theme toggle.

Date field IDs are explicit `date-time-<toolId>-<fieldName>` values shared across server/client, including calendar and clock pickers; each current route renders one instance. This avoids depending on generated ID namespaces across lazy boundaries. Repeated instances of the same tool would require a stable additional instance scope. The only intentional hydration suppression is on the root `<html>` for the prepaint theme attribute; descendant form mismatches are never suppressed.

`lib/tools/date-time-station.ts` uses native Date/Intl with strict parsing and validated IANA zones. The new contract engine adds exact decimal timestamp parsing, required ISO offsets, six date-only formats and explicit business weekends/holidays. Public tools reject both DST gaps and folds rather than exposing an extra disambiguation input. Required zones start empty; tools without zone fields disclose browser-local interpretation. See `DATE_TIME_STATION.md` for calendar conventions and boundaries.

## Privacy and state

The homepage and shared site navigation use registry metadata only; global/station search is client-local and does not persist or transmit query text. `config/site.ts` accepts a canonical origin only when it is an explicit clean HTTPS deployment value. `SITE_INDEXING=index` is required alongside that origin; otherwise page metadata is noindex, robots disallows crawling, and the XML sitemap is empty. Informational pages and generated third-party notices are separate public artifacts and do not add a contact backend, analytics, cookies, or user-content persistence.

All new calculations run from local event handlers. Date values, zone choices, and results live only in component state; changing options invalidates results. There are no server actions, requests, analytics events, URL input parameters, or local-storage history for Date & Time. Current Time reads the device clock on refresh, and Age checks browser-local today on calculation. Copy writes only on explicit action; no Date & Time Download controls remain.

The pre-existing theme control uses local storage. Other older stations contain generic dispatch and limited parser implementations, which require separate conformance/UX work rather than broad claims of correctness.

## JSON & Data contract boundary

`config/json-data-tools.ts` contributes all 46 specified public routes to `config/tools.ts`. Its `dataContract` is the shared source for input fields, output formats, examples and actions. Related/pair metadata drives real route links, not in-place hidden direction toggles. Registry-derived `next.config.ts` redirects retain six legacy URLs without duplicate public tools.

`JsonDataStation` mounts empty inputs with deterministic route-scoped IDs. Only explicit actions run processing. Engines are lazy-loaded in a cancellable, 15-second worker; edits/clear/unmount terminate it. Inputs never enter URLs, requests or storage. Output markup is inert React text. Schema validation uses an interpretive library; XML DTDs/remote schema references are disabled. The fallback without Worker is bounded but synchronous.

Only JSON/Data pages receive new canonical metadata and concise purpose/usage/related content. No existing ad/analytics/Pro service abstraction was present and no replacement service was added. Other station sources and the shared theme remain unchanged. Details and explicit format/resource limitations: `JSON_DATA_STATION.md`.

## Verification and delivery

SQL & Database uses `node-sql-parser@5.4.0` lazily by dialect and `sql-formatter@15.9.0` on action, with a native source-preserving lexer, exact literal INSERT extraction and bounded DDL grammar. Shared dialect/identifier/literal/condition utilities serve typed builders, data conversions and local credential representations. Parsing/formatting/extraction/DDL always require disposable15-second workers; small generated text/connections stay local. ER uses safe SVG plus full text with declared relationships only. There is no SQL executor, database connection, driver, remote payload, content persistence or telemetry. `SQL_DATABASE_STATION.md` documents parser/session-mode limitations, SQL Server REFERENCES workaround, conversion losses, resource bounds and pending browser acceptance.

Cron syntax defaults to five Unix fields, with a supplied optional Second enabling a clearly labeled six-field seconds-first extension. Native parsing/explanation/human conversion is bounded and local; Next Run always requires a disposable ten-second worker. Selected wall dates and offset intervals implement strictly-after matching, skipped DST gaps and both folded instants, within the disclosed eight-year/1970–2099 limits. All schedule input/result/search state remains in memory; no execution, server processing, telemetry or persistence. See `CRON_STATION.md` for Vixie day rules, unsupported dialects and partial browser acceptance.

Text contributes 31 exact `textContract` entries to the existing registry. Exact-ID `TextWorkspace` dispatch precedes legacy workbench routes, including Regex Line Extractor. The station uses Intl grapheme segmentation with fallback, line-record-preserving helpers and literal replacement; local LCS diff loads only on demand. Regex line extraction always requires a 1,500 ms worker, diff/large work uses 10-second disposable workers. Results are inert labeled text/cards with exact Copy/Clear; no generator source fields, uploads, telemetry or new dependency. Legacy sources/global theme remain unchanged. See `TEXT_STATION.md` for conventions and pending browser checks.

Regex contributes nine exact `regexContract` definitions through the same central registry. `RegexWorkspace` is lazy-selected by exact tool ID before the legacy workbench. Its client runs all user-supplied regex operations in a disposable 1,500 ms worker, never a synchronous fallback; bounded escape/build operations do not execute user patterns. Native semantics are preserved with strict flags and explicit resource errors, structured nullable captures and paginated text results. Existing legacy RegexStation/helpers remain for old consumers to avoid other-station behavior changes. No dependencies, analytics or global design changes. See `REGEX_STATION.md` for policies and pending browser acceptance.

Security contributes 22 exact `securityContract` definitions through the same central registry. The dedicated lazy station does not load the legacy workbench on public Security routes. SHA/HMAC use native Web Crypto; generators use getRandomValues with rejection sampling. File requests and larger text run in disposable 30-second workers, bounded to 64 MiB files and 1M code units; MD5 loads on demand. Clear/edit/navigation invalidate results and release file state. No new dependencies, analytics, ads provider or secret persistence. See `SECURITY_STATION.md` for contracts, estimate limitations and browser verification gaps.

Encoding follows the same central-registry/lazy-workspace pattern through `encodingContract`, without changing JSON/Data contracts. `lib/tools/encoding/bytes.ts` uses bounded native UTF-8/byte operations; `structured.ts` lazy-loads complete HTML5/IDNA tables. Small linear conversions stay on the client thread; Base58 and larger inputs use an abortable ten-second worker. JWT/Data URI have individual labeled text outputs; neither source nor decoded markup is executed. See `ENCODING_STATION.md` for representations, strict validation policies, production verification and browser gaps.

Vitest runs helper/registry tests in Node and selected component tests in jsdom via Testing Library. `vitest.config.ts` supplies the app's `@` alias and automatic JSX transform. Production is built with `next build` and served with `next start`. Never mutate `.next` under an active dev/production server.

Standalone lint currently completes with existing accessibility, image, and hook warnings; it is not a clean lint pass. The existing Next/PostCSS dependency chain has audit findings recorded in `HANDOFF.md`; passing TypeScript/build is not a substitute for resolving those gates. Real-browser visual and cross-browser tests remain separate from jsdom tests.
