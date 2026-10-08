# Smart Converter Standard

Permanent Code Station convention for converter tools.

## Scope and capability registry

A tool qualifies only when it has a real source representation, a real implemented target engine, a registered public destination route, and meaningful mapping semantics. Formatters, validators, inspectors, generators, analyzers, hash functions, regex tools, date calculators and other specialized operations do not receive a generic format dropdown.

`config/conversion-capabilities.ts` is the metadata-only authority. Each capability records family, source, target, route, input/output kind, output MIME/extension, runtime requirements and mapping limitations. `capabilitiesFor` filters targets and `capabilityForRoute` resolves the current page. Engines remain lazy; registry entries do not imply runtime/browser support. Every route must resolve through `config/tools.ts`.

Implemented support, runtime availability and current-input compatibility are separate. A target is offered only when all three are true. Missing routes, theoretical codecs and same-format operations are not offered.

## Detection and ambiguity

Binary sources use signatures/container validation and actual parser/decoder validation; MIME and filename are supporting hints. A mislabeled `.jpg` containing PNG bytes is PNG. ZIP is not XLSX without workbook structure validation. Text formats require parser or structural evidence. Permissive YAML, arbitrary comma text, generic JSON, Markdown and HTML are not confidently inferred without sufficient evidence; retain explicit source selection when ambiguous. Never call a guess verified detection.

## Memory-only source sessions

`components/ConverterSession.tsx` provides a client-memory-only session above the changing tool route. It may hold the original File/text, validated source format, metadata, selected sheet and a monotonic version. It never uses URL/history state, localStorage, sessionStorage, IndexedDB, server storage or analytics. Compatible target changes convert from the original source, never an earlier lossy result. Refresh, new tab and reopened tab start empty; leaving the family or Clear releases the session.

## Lifecycles and routing

Source replacement, Clear, family exit and unmount release File/Blob/object URL/decoded-parser/worker resources. Target/options changes invalidate preview, Copy, Download and success state; request/version guards reject late results. Download MIME, extension and bytes must match actual output.

Public directional routes remain separate. Automatic validated source reconciliation uses replace semantics; explicit Output Format selection uses push semantics. URL, history, breadcrumb, H1, title, description, source indicator, target controls, CTA, output label, MIME/extension, related links and canonical metadata must describe the same direction. Never label a WebP as PNG or original Markdown as HTML.

## Station rules

- Image: only verified PNG/JPEG/WebP/AVIF/SVG capabilities; AVIF output requires a genuine encoder; transparency-to-JPEG requires a background. Resizer/cropper/compressor/palette/metadata remain specialized.
- Spreadsheet: CSV/TSV/XLSX/JSON mappings retain sheet/header/type/empty/formula limitations. Formulas are not recalculated; macros never execute. Sheet selection is part of the source session.
- JSON & Data: each parser’s documented mapping applies; tabular JSON/CSV is not assumed lossless for every structure.
- Markdown: Markdown↔HTML remains sanitized/inert; Markdown/HTML/plain-text ambiguity is not guessed and previews never fetch resources.
- Encoding: meaningful encode/decode pairs remain distinct; hashes are not reversible converters.
- SQL: only dialect-aware implemented mappings are capabilities. API/Web/Date & Time/Text expose only genuine representation pairs; request execution, URL inspection, timezone semantics and specialized transformations remain separate.
- Security, Regex, Cron, Color & CSS and future Converters receive no generic converter surface without a real compatible engine and mapping.

### Stable-route numeric converters

Measurement, absolute-temperature, and integer-base converters may use one stable canonical route instead of generating every source/target pair as a public page. Their capability entries use `routeMode: "stable-numeric"` and may intentionally have the same conceptual source/target family. Same-unit identity results are allowed when explicitly useful for the measurement tool; this exception does not authorize same-format file conversion or a universal dropdown.

Numeric source changes (unit/base/scale) reinterpret the original entered text under the newly selected source. Target changes preserve that original source and recalculate directly; they never feed displayed rounded output back into the engine. Exact integer converters use arbitrary-size integer arithmetic, while measurement display rounding remains separate from calculation precision. Unit catalogs and conversion definitions must be authoritative and verified before a new unit is added.

## Accessibility, privacy and checks

Use visible **Detected Source** or **Input Format** and **Output Format** labels, keyboard controls, focusable status/errors, responsive scrolling and existing light/dark tokens. Source content, sensitive filenames, workbook cells, Base64 and generated output never enter analytics or persistence. Previews are inert/sanitized and parsers make no remote requests.

Automated checks cover capability/route consistency, mislabeled binaries, malformed/ambiguous input, target filtering, same-format handling, options, route-boundary preservation, stale/late completion, Clear/cleanup, history reconciliation and actual MIME/extension/bytes. Browser checks cover direct routes, Back/Forward, refresh, title/canonical, keyboard, mobile/desktop, themes, console/network behavior and actual downloaded content. Record **AUTOMATED VERIFIED**, **LIVE-BROWSER VERIFIED** and **NOT VERIFIED** separately. HTTP smoke or server-rendered markup is automated route evidence, not live-browser interaction or download-byte verification.
