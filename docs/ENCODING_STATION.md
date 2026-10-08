# Encoding Station — audit, contracts and verification

Updated 2026-10-03. Scope is only the requested Encoding Station: **35 public tool URLs**, replacing 27 older registry entries. No global redesign or changes to other station implementations.

## Baseline

Read AGENTS, status, handoff, TODO, architecture, decisions and changelog; inspected registry/routes, old encoding/index helpers, generic workbench, local-worker pattern, CSS tokens, theme toggle and tests. No AdSlot, analytics or Pro/account abstraction exists in application source; no provider or placeholder integration was invented. No ads or tool-content telemetry is emitted.

- `git status --short`: no Git repository. No commit or Git diff claim.
- Baseline typecheck and **855 tests / 16 files** passed.
- Both existing servers (ports 3000 and 3001) used the same workspace. Stopped both before building `.next`.
- Baseline production build passed: 159 generated pages / 152 tool routes.
- Baseline/final standalone lint stops at missing ESLint configuration. No unrelated tooling migration was made.
- Took a SHA-256 snapshot of 40 protected source files. Final comparison passed, including existing components, theme/global CSS, other station metadata and helper sources covered by that snapshot. Shared registry/route/lazy-boundary/config integration files were intentionally excluded.

## Route-by-route audit and corrections

Every listed route has a unique registry identity/title/description, exact input/output definition, examples, related tools, canonical/indexable metadata, short factual purpose/usage content, labeled errors, Copy and Clear. Each pair has reciprocal public links; no hidden second processing mode.

| Routes under `/tools/` | Correction / verified behavior |
| --- | --- |
| `base64-encoder`, `base64-decoder` | Split old combined route; standard RFC 4648, correct UTF-8, strict alphabet/padding/unused bits; no replacement of malformed bytes. |
| `url-encoder`, `url-decoder` | Complete-URL URI semantics instead of component semantics or a hidden decode button; preserved structure, strict percent/UTF-8 validation. |
| `url-component-encoder`, `url-component-decoder` | Independent component routes and exact labels; reserved characters encoded/decoded as component data; `+` unchanged. |
| `jwt-decoder` | Only token input; three separately formatted/copied outputs; signature bytes checked structurally but never verified, authenticated or interpreted as UTF-8. |
| `html-encoder`, `html-decoder` | All five mandatory sensitive characters escaped; full HTML5 character references decoded without DOM injection. |
| `html-entity-encoder`, `html-entity-decoder` | Complete named/numeric references rather than a tiny case-insensitive replacement table; ordinary alphanumerics preserved. |
| `text-to-unicode`, `unicode-to-text` | Replaced combined route; one scalar code point per U+ token; supplementary characters correct, surrogate/out-of-range scalars rejected. |
| `unicode-escape-encoder`, `unicode-escape-decoder` | Preserve ordinary printable ASCII, handle literal backslashes and surrogate pairs, reject malformed escapes; no JavaScript evaluation. |
| `text-to-hex`, `hex-to-text` | Replaced combined route; contiguous uppercase UTF-8 hex output, strict complete-byte decoding. |
| `hexadecimal-encoder`, `hexadecimal-decoder` | Shared hex engine; removed lowercase/punctuation-tolerant behavior and misleading format labels. |
| `binary-encoder`, `binary-decoder` | Replaced combined route; exactly eight bits per byte, single-space encoding; specific digit/group errors and fatal UTF-8. |
| `text-to-ascii`, `ascii-to-text` | Replaced combined route; decimal-only 0–127, no exponent/hex notation, no non-ASCII UTF-8 substitution or huge spread call. |
| `base32-encoder`, `base32-decoder` | RFC 4648 uppercase with correct padding; reject misplaced/excess padding, dropped-bit ambiguity, hyphens and invalid alphabet. |
| `base58-encoder`, `base58-decoder` | Bitcoin alphabet and leading zero bytes; explicit bounds and worker execution for expensive BigInt conversion. |
| `base64-url-encoder`, `base64-url-decoder` | Unpadded output; strict URL alphabet, optional correct input padding and canonical trailing bits; no implicit JWT interpretation. |
| `data-uri-encoder`, `data-uri-decoder` | MIME is an explicit input, no upload/options; decoder outputs MIME, mode and decoded text separately, not just payload. URI/metadata/payload validated, never opened/rendered. |
| `punycode-encoder`, `punycode-decoder` | Replaced ad hoc combined conversion with validated nontransitional UTS46 IDNA labels; no URL/IP reinterpretation or DNS/network queries. |
| `text-to-octal`, `octal-to-text` | Replaced combined route; exactly three octal digits per byte, 000–377, incomplete groups/invalid UTF-8 rejected. |

Old URLs permanently redirect: `base64` → `base64-encoder`; `binary-encoder-decoder` → `binary-encoder`; `ascii-converter` → `text-to-ascii`; `unicode-converter` → `text-to-unicode`; `hex-converter` → `text-to-hex`; `punycode-converter` → `punycode-encoder`; `octal-converter` → `text-to-octal`.

## Shared implementation

- `config/encoding-tools.ts` contributes metadata to the existing `config/tools.ts`; it is not a competing registry. `encodingContract` owns only `input` and (Data URI encoder only) `mime`. Direction, output labels, examples and related links are route-specific.
- `components/EncodingStation.tsx` / `.module.css`: empty initial state, actual paired Next links, labeled textareas, exact copy (including empty strings), individual JWT/Data URI copies, Clear, relevant examples, busy/errors and stale-result invalidation. No upload, dropdown, verification key, download or preview controls.
- `components/ToolWorkspace.tsx` selects the lazy Encoding workspace. Existing generic helpers/workbench remain untouched for legacy consumers, but **no public Encoding route uses them**.
- `lib/tools/encoding/bytes.ts`: UTF-8, Base64/Base64URL, Base32, Base58, hex, binary, ASCII, Unicode code points/escapes and octal.
- `lib/tools/encoding/structured.ts`: URI/component semantics, HTML5 references, JWT, Data URI and IDNA. `index.ts` is the local dispatcher; `types.ts` is the shared result/input type.
- `client.ts` / `workers/encoding.worker.ts`: small linear work stays native; Base58 and inputs above 16,384 code units use a disposable local worker. Edit/Clear/unmount aborts it; deadline is 10 seconds. No persisted user input.
- Dependencies: `entities` 8.1.0 and `tr46` 6.0.0 are direct runtime dependencies, loaded only for relevant tools; `@types/tr46` 5.0.1 is dev-only. These were already related to the development dependency tree, but are now explicitly declared for browser runtime use. Native APIs handle ordinary byte/URI conversions; no general encoding package added.
- Shared route shell adds the requested small metadata/purpose/usage/related content conditionally for Encoding; existing JSON/Data and other station content remains intact. `next.config.ts` adds only the seven Encoding redirects alongside the existing JSON/Data rules.
- Production checking found the minifier folding a literal escaped surrogate-pair example into an emoji. Constructing that example from code units fixed SSR/client placeholders; the production verification script checks it.

## Explicit parsing policies and limits

- Text encoding rejects unpaired UTF-16 surrogates rather than allowing TextEncoder to replace them. Text decoding is fatal UTF-8; leading U+FEFF is retained (`ignoreBOM: true`). This station is text-oriented, not a general binary-file viewer.
- Empty text/byte representations produce an empty result with working Copy. JWT, Data URI decoder and domains require structure. Data URI encoder requires the user-supplied MIME type but permits empty content; Clear empties both fields.
- Standard Base64 and Base32 require RFC padding when needed, with no whitespace normalization. Base32 uses uppercase only. Base64URL accepts padded or unpadded URL alphabet but rejects noncanonical unused bits. JWT compact segments are unpadded only.
- Hex accepts contiguous even-length digits or whitespace-separated complete byte sequences, not `0x`, colons or dashes. Binary uses eight-bit groups; octal uses three digits 000–377. Numeric/code-point groups accept whitespace separators. ASCII accepts only decimal digit tokens 0–127. Unicode code points use `U+` plus four to six hex digits and must be scalar values.
- Unicode escapes interpret `\uXXXX`, valid surrogate pairs and doubled literal backslashes. Printable ASCII stays unescaped; controls/non-ASCII use escapes. Other ordinary text, including literal `\n`, is preserved. Braced JavaScript escapes and unpaired surrogates reject. Output has no enclosing quotes.
- Full URLs use `encodeURI` / `decodeURI`; decoder retains encoded reserved delimiters such as `%2F`, `%3F`, `%23`, `%26` so it does not change URL structure. Components use `encodeURIComponent` / `decodeURIComponent`. Neither treats `+` as a form-encoded space or validates domain existence.
- HTML decoding uses HTML5 text-context character-reference rules, including legacy semicolonless names and specified numeric replacement behavior. Unknown references remain ordinary text where HTML5 requires it. All resulting markup remains inert text; there is no innerHTML/DOMParser rendering step.
- JWT header and payload must be JSON objects; `alg` must be a nonempty string. Empty signature is allowed only for unsecured `alg:none`. Signature segment syntax is checked, not cryptographic validity, algorithm correctness, claim validity or expiry. Formatted JSON preserves number lexemes without rounding. JSON nesting is capped at 128.
- Data URI encoder uses deterministic percent-encoded UTF-8. MIME accepts a type/subtype and optional `charset=UTF-8`; no filename or arbitrary options. Decoder accepts valid MIME parameters, percent/Base64 payloads, UTF-8 or US-ASCII. Omitted media type defaults to `text/plain;charset=US-ASCII`; an explicit MIME without charset uses UTF-8 for this text decoder. Other charsets and non-UTF-8 binary bytes reject rather than being silently replaced. Whitespace, non-ASCII and `#` in URI payloads must be percent-escaped. Encoded and decoded Data URIs are never opened/fetched.
- Domain conversion is nontransitional UTS46, with STD3, bidi, joiner, hyphen and DNS-length validation. Encoder may normalize Unicode/case/separators as IDNA requires. Decoder requires ASCII domain labels. Optional final root dot is retained. Schemes/paths/ports/emails are not domain input. Conversion makes no existence, availability or safety claim.
- General input: 1M UTF-16 code units per source; MIME 1,024; output 8M characters. Base58 source is capped at 16,384 UTF-8 bytes; decoder accepts up to 22,528 characters with a 16,384-byte decoded ceiling, allowing maximum encoder output to round-trip. Larger inputs use workers; without Worker support, large work is rejected and only small bounded work falls back locally. This is not a streaming or unlimited-size implementation.

## Verification actually run

- `npm ci`: passed on Node 22.19.0.
- `npm run typecheck`: passed.
- `npm test`: **1,335 tests / 20 files passed**. Four new Encoding suites contribute **472 tests**: engine 247, worker selection/lifecycle 5, UI 176, registry/routes 44. The breadcrumb suite adds eight route cases as the central catalog grows. All existing suites passed.
- All 35 tools: valid examples, empty policy, malformed input policy, Unicode, larger inputs, size bounds. Text encoders have no malformed well-formed-text case; tests use ill-formed UTF-16, and HTML reference recovery follows the standard instead of falsely rejecting ordinary text.
- Boundary tests: RFC4648 vectors/padding/bits, fatal UTF-8 and BOM preservation, Base58 leading zeros/maximum round-trip, exact byte widths/ASCII range, Unicode scalars/surrogates/escapes, URI vs component reserved delimiters, full HTML5 references, JWT structure/JSON/signature segment, Data URI MIME/Base64/percent/errors, IDNA invalid labels/joiners/domain lengths.
- Both dark/light DOM-attribute matrices test exact fields, Tab/Enter conversion, copies of exact displayed values, Clear, no downloads, no fetch/XHR/storage calls and no jsdom console errors. Every tool has real SSR `renderToString` / `hydrateRoot` coverage with namespace-independent IDs and retained DOM nodes. Every pair has keyed component reset and route-specific label/example/action/output checks.
- `npm run build`: passed, **167 generated pages / 160 prerendered tool URLs**. Shared initial JS about 104 kB; tool route about 119 kB. Entity/IDNA tables are deferred, not global initial payloads.
- `node scripts/verify-encoding.mjs`: passed against production port 3000. All 35 pages: direct HTTP, canonical/title/description/robots, SSR field/placeholder/action/output labels. 38 navigation URLs, nine page scripts, seven 308 aliases, and five other-station smoke routes passed. All 35 compiled-worker examples plus Unicode regression passed in an isolated VM worker-like runtime; five worker/parser assets served successfully. This is **not** real-browser execution evidence.
- Protected source hash comparison: **40 existing source files byte-identical**. No changes to other station components/engines, global CSS or theme toggle were made. Shared integration files changed only as described above.
- Source inspection found no input requests/storage/analytics, eval/Function parser, or unsafe HTML injection in the new Encoding processing path.
- `CI=1 npm run lint < /dev/null`: **blocked**, exit 1, existing missing ESLint configuration.
- Built-in browser navigation and two observations timed out. Actual visual dark/light/mobile layout, real browser history navigation, live console, clipboard permissions and browser workers/CSP remain **unverified**, not passed.

## Remaining browser acceptance

Preview: `http://localhost:3000/tools/base64-encoder` (production server). Stop it before rebuilding `.next`.

For each route, test desktop and 375px mobile in light/dark themes: visible labels, readable output, comfortable controls, focus outlines, no overflow, example→convert→copy→clear, malformed input, and console/hydration errors. Copy multipart JWT/Data URI values individually and confirm decoded markup never renders. Confirm large/Base58 conversions use a worker and that Clear cancels pending work.

For each of the 17 pairs: keyboard-activate the direction link; verify URL/title/breadcrumb/description/input/placeholder/example/CTA/output/related content; refresh directly, then Back and Forward. Automated href, keyed reset, SSR/metadata and HTTP tests are not a substitute for browser history acceptance. Lint and repository-wide dependency-audit remediation remain separate maintenance work.
