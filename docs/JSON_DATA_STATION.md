# JSON & Data Station — contract audit and implementation

Updated 2026-10-03. Scope: the 46 public JSON/Data tool routes in the supplied specification, not other stations or a broader SEO system.

## Baseline evidence

- Read project guidance, status, handoff, TODO, architecture, decisions, changelog, existing registry/routes/workbench, global theme tokens, and existing tests.
- `git status --short`: no Git repository. There is no commit/diff baseline; changes below are the scoped file ownership record, not a Git verification claim.
- Before edits: 300 tests / 12 files passed; typecheck passed. Stopped the active dev server before baseline build: 158 generated pages / 151 tool routes passed.
- Baseline and final standalone lint: exit 1; `next lint` requests missing ESLint configuration. This is not a lint pass.
- No AdSlot, analytics abstraction, account/Pro entitlement, or ad provider exists in the application source. None was invented. No ads or tool-content analytics are emitted, so Pro users are not exposed to ads either. Entitlement integration is not implemented.

## Per-tool audit and correction

All rows also receive exact input fields, accepted-format labels, a matching CTA/example, empty/error states, keyboard actions, related tools, local-processing notice, canonical metadata, and short factual purpose/usage content.

| Public slug | Baseline gap / correction |
| --- | --- |
| json-formatter | Removed indent/tab/sort controls and extra output metadata; fixed 2-space, source-preserving formatting. |
| json-validator | Stopped formatting valid input into output; syntax-only status with located errors. |
| json-minifier | Source-preserving whitespace removal, including numeric lexemes. |
| json-to-yaml | Actual directional route, compatible nested values, precision checks. |
| yaml-to-json | One document, explicit incompatible-value errors, formatted JSON. |
| json-to-csv | Strict object rows/compatible keys, first-record columns, JSON-serialized nested cells. |
| csv-to-json | Strict quoting/width/header validation; no dropped cells or duplicate-header overwrite. |
| json-diff | Recursive precise paths including arrays; formatting and object-key order ignored. |
| json-tree-viewer | Replaced text-only output with expandable/collapsible typed tree. |
| json-schema-validator | Replaced type/required-only subset with interpretive validator and schema checks. |
| json-schema-generator | Infer every array member, not only the first; supports mixed/null types. |
| jsonpath-tester | Safe selectors, recursive descent, unions, slices and filters; values/count only. |
| json-escape | Outputs a complete quoted string literal; no internal unescape mode. |
| json-unescape | Added distinct route; accepts only complete JSON string literals. |
| json-key-sorter | Recursive ascending/descending textual key order, including numeric-looking keys. |
| json-array-to-object | Required own key property, complete records, duplicate-key rejection. |
| json-object-to-array | Key/value records in source insertion order. |
| json-lines-formatter | Correct canonical slug; compact value per physical line, not multiline pretty JSON. |
| json-lines-validator | Correct canonical slug; all invalid physical line numbers, including after blank lines. |
| json-lines-to-json | Correct canonical slug and inverse navigation; ordered array output. |
| json-to-json-lines | Correct canonical slug; array required, ordered one-value-per-line output. |
| json-structure-inspector | Hierarchical paths/types only; removed scalar values from report. |
| json-statistics-analyzer | All nine contracted structural statistics, root depth zero. |
| csv-formatter | Strict parse and destination-safe quoting; no delimiter/header/trim settings. |
| csv-validator | Reject malformed quoting and inconsistent rows; located human-readable errors. |
| csv-column-analyzer | Analyze only the named column; counts, confident type inference, numeric bounds. |
| csv-delimiter-detector | Quote-aware multirow candidates; output only delimiter and column count. |
| csv-to-tsv | Tabs inside fields correctly quoted; route-based inverse. |
| tsv-to-csv | Correct tab parsing, comma escaping, route-based inverse. |
| csv-to-markdown | Escape Markdown/HTML-sensitive content and represent multiline cells safely. |
| csv-to-html-table | Canonical slug; escaped semantic table source, never injected into page. |
| csv-cleaner | Remove blank rows and trim field edges; retain internal whitespace/control content. |
| csv-column-reorderer | Exact requested names/order; reject unknown or duplicate names. |
| csv-row-filter | All nine operators; explicit numeric validation; always preserve header. |
| csv-data-deduplicator | Canonical slug; optional selected keys, empty selection means full row. |
| csv-transposer | Rectangular validation, every value retained, including empty fields. |
| json-to-xml | Fixed root and array item elements, escaped primitive text, valid name/character checks. |
| xml-to-json | Real strict parser; retain leaf attributes and repeated elements under root key. |
| json-to-toml | Real serializer for nested tables/arrays; reject incompatible/null values. |
| toml-to-json | Real TOML parser; malformed text is not accepted as arbitrary strings. |
| yaml-diff | Structural recursive differences rather than reference equality/whole-document replacement. |
| yaml-formatter | YAML document formatting, comments/anchors and compatible values retained. |
| yaml-validator | One-document syntax validation and located errors. |
| xml-formatter | Ordered parsing; preserve mixed text, attributes, CDATA, comments and xml:space. |
| xml-validator | XML 1.0 well-formedness rather than a permissive tag tokenizer. |
| xml-minifier | Remove newline indentation in element-only content; preserve mixed-content spaces/xml:space. |

## Architecture and changed files

- `config/json-data-tools.ts` is imported into the existing `config/tools.ts` registry, not a separate conflicting registry. Definitions own exact fields, examples, output formats/extensions, pairing and related tools.
- Legacy IDs are retained where useful. Six old public URLs (`jsonl-formatter`, `jsonl-validator`, `jsonl-to-json`, `json-to-jsonl`, `csv-to-html`, `csv-deduplicator`) redirect permanently using registry-derived rules in `next.config.ts`.
- `components/ToolWorkspace.tsx` lazy-loads `components/JsonDataStation.tsx` before the legacy workbench. The existing workbench/helpers remain for legacy consumers; they no longer process public JSON/Data routes.
- `components/JsonDataStation.module.css` uses existing theme variables, a two-column desktop layout, a stacked layout below 760px, 44px controls, focus outlines and scrollable output. No global theme, typography or illustrated toggle edits.
- `lib/tools/json-data/{json,csv,markup}.ts` implement the family engines; `index.ts` dispatches lazily. `types.ts` contains the shared input/result contract.
- `workers/json-data.worker.ts` and `lib/tools/json-data/client.ts` run calculations in a disposable local worker, terminate after 15 seconds, and abort on edit, Clear or unmount. A bounded direct fallback is used when Worker is unavailable; that fallback is synchronous while processing.
- `app/tools/[slug]/page.tsx` adds canonical/indexable metadata, short purpose/usage text and related links only for entries with the JSON/Data contract. Existing other-station content remains unchanged.
- Runtime dependencies added: `@cfworker/json-schema` 4.1.1 (interpretive, not generated code), `smol-toml` 1.9.0, and direct `saxes` 6.0.0. Existing `yaml` 2.9.1 reused. Lockfile updated; `npm ci` passed.
- Existing Date & Time, Encoding, Security, Regex and Text components/engines, global CSS, theme toggle, robots and sitemap implementations were not edited.

## Privacy and safety

Inputs live in component/worker memory only. No network submission, persistence, telemetry payload, `eval`, `Function` parser, or HTML injection exists in the new processing path. Schema references are local only; XML DTDs and external entities are rejected. Output is React text (including HTML/XML source). Clipboard/download are explicit actions; Blob URLs are revoked. Changing a field clears stale output and aborts pending work.

## Explicit semantics and limits

- JSON formatter/minifier/syntax validation preserve or accept numeric source lexemes, including integers outside JavaScript's safe range. Value-transforming JSON tools reject numbers that cannot round-trip without precision loss instead of rounding. Duplicate property names are syntactically accepted/preserved by formatter/minifier/validator, but rejected by value transformations because they are ambiguous. Object-to-array and key sorter preserve explicit source key order, including integer-like keys.
- JSON Lines ignores blank physical lines, emits compact one-value-per-line records, and reports all bad physical line numbers. Empty JSON Lines is invalid. An empty JSON array converts to empty JSON Lines/CSV; an empty array has no CSV headers to infer.
- JSON→CSV requires identical key sets across records; it rejects incompatible shapes rather than discarding later keys. Nested values use JSON strings; null uses `null`. CSV→JSON retains all cell values as strings. Duplicate/empty header names are rejected by operations that address headers. Blank rectangular rows are preserved except by Cleaner. Delimiter detection rejects ties/undetectable input rather than guessing.
- CSV selected-column inference uses an 80% confidence threshold; numeric mixtures become decimal, weak majorities remain text, and date-like detection accepts valid ISO-shaped dates/datetimes. Empty means the exact empty string; unique counts include it. Numeric ordered filtering requires finite supported numeric cells and rejects empty/nonnumeric cells. Numeric comparisons do not silently round unsafe integers.
- Reorder permits a subset and emits exactly the requested columns. Reorder/dedupe names are newline-separated, preserving commas and spaces in header names; a JSON string array can express names containing newlines. Dedupe with no keys compares the whole row, preserving its first occurrence.
- JSON Schema: drafts 4, 7, 2019-09 and 2020-12, default 2020-12. Local fragment references and common constraints/combinators are supported. Unsupported/unknown keywords/formats, remote references, dynamic references, nested resource IDs, custom vocabularies, mixed dialects, and guarded regex constructs fail explicitly. This is not a claim of complete official conformance-suite coverage. Generator output describes the supplied sample, not a domain model.
- JSONPath: root, dotted/quoted properties, array indexes (including negative), wildcards, recursive descent, unions, slices, and existence/comparison/logical filters. JavaScript, functions and nested filter operands are not executed and unsupported syntax fails clearly. No RFC-complete JSONPath claim.
- YAML formatting/validation accepts one YAML document and preserves document-level comments/anchors through the document API. JSON conversion/diff rejects non-string mapping keys, unsupported tagged/non-JSON values and cyclic aliases. Bounded compatible aliases expand. Transformation/formatting rejects detected numeric precision loss; syntax validation remains syntax-only.
- XML uses strict namespace-aware XML 1.0 parsing; DTDs are disabled. Newline indentation in element-only content is treated as formatting; inline separator spaces, mixed text, CDATA and `xml:space="preserve"` survive. Use `xml:space="preserve"` for intentionally significant element-only indentation. XML→JSON is the specified conventional projection, not a reversible encoding: root key, strings, `@attributes`, repeated sibling arrays, joined mixed `#text`; comments/PI and cross-name sibling ordering cannot be represented by that projection. JSON→XML uses fixed root/item elements and text for primitives (including `null`); invalid names/characters reject.
- TOML supports compatible nested objects, arrays and primitive values through a real parser/serializer. Null, nonfinite/unsafe integer values and date/time objects without a lossless JSON type reject explicitly. TOML floating-point parsing uses the library's JavaScript numeric representation. Quote precision-sensitive TOML decimals/date-time values before conversion.
- Inputs are limited to 1,000,000 characters per field. JSON/YAML/XML have depth/node budgets (100 levels / 50,000 nodes); schema/query work has additional complexity caps. Maximum output is 8M characters (4M for markup engines). Workers terminate after 15 seconds. Closed tree branches mount on expansion; wide branches reveal 200 children at a time. These bounds are deliberate browser-safety limits, not streaming support.

## Verification actually run

- `npm ci`: passed on Node 22.19.0.
- `npm run typecheck`: passed.
- `npm test`: **855 tests / 16 files passed**.
- New test files: `lib/tools/json-data/station.test.ts` (311), `lib/tools/json-data/client.test.ts` (3), `components/JsonDataStation.test.tsx` (186), `config/json-data-tools.test.tsx` (54). Existing suites remain passing.
- Every tool: example, empty-input policy, invalid format where meaningful, Unicode, larger text, excessive-size rejection; exact UI fields, keyboard traversal/action/copy/clear, appropriate download extension, no fetch/XHR. Raw-text Escape has no malformed-text case by design. Focused boundary assertions cover structured semantics, precision, prototypes, schema/query safety, strict CSV, XML mixed text/entities, YAML cycles and TOML incompatibilities.
- Every tool: actual renderToString/hydrateRoot test, stable IDs/server nodes and no observed jsdom console/hydration errors. Interaction matrix repeats under both dark/light DOM attributes. CSS breakpoint/token checks are static tests, **not** visual layout verification.
- Worker tests cover result, abort and 15-second timeout. The compiled production worker bundle separately executed all 46 examples in an isolated VM worker-like runtime; seven worker/parser JS assets returned HTTP 200. This is not a real-browser Worker test.
- `npm run build`: passed, **159 generated pages / 152 prerendered tool URLs**. Shared initial JS remains approximately 103 kB; tool shell approximately 115 kB. Parsers are deferred to the action path, not initial global loading.
- Production HTTP: all 46 JSON/Data routes returned 200 with SSR inputs, correct title/H1, canonical and index/follow metadata. All 49 collected breadcrumb/direction/related URLs returned 200; all six old aliases returned correct 308 locations. Age Calculator, Base64, Password Generator, Regex Tester and Text Counter still returned 200.
- Source checks found no network, persistence, unsafe HTML, eval or Function usage in the new processing path or the inspected new parser libraries.
- `CI=1 npm run lint < /dev/null`: **blocked**, exit 1, existing missing ESLint configuration. No unrelated lint migration was made.
- Built-in browser navigation succeeded but page observation/tool discovery timed out. No successful visual/console inspection is claimed.

## Remaining browser acceptance checklist

At `http://localhost:3000`, after a full reload, check every station route at desktop and 375px mobile widths in both themes. Run the example, test invalid input, use Tab/Enter for primary/copy/clear/download, and check focus, text contrast, wrapping/scrolling and the console. Verify actual worker execution and CSP compatibility in the target browser.

For each inverse pair, follow the direction link, verify URL/title/breadcrumb/description/fields/example/CTA/output/extension/related links, refresh directly, then use browser Back and Forward. These history and live browser checks remain pending; href, direct HTTP, metadata and keyed component reset tests have passed.

The production preview is running on port 3000. **Stop it before another `.next` build.** Existing repository-wide lint and dependency-audit gaps remain separate maintenance work.
