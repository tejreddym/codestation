# API Station — contract and safety audit

## Scope and architecture

Exactly 16 public tools contribute `apiContract` metadata to the existing central `config/tools.ts` registry, with searchable `/stations/api`, existing station cards/navigation/theme and unique canonical tool routes. No Network or subsequent station was started. `ApiStation` is a lazy client boundary; local engines load on action, not globally. No dependency was added. Existing JSON helpers and `saxes` are reused.

Tools: cURL to Fetch; Fetch to cURL; cURL to Axios; cURL to Python Requests; HTTP Header Builder; HTTP Header Parser; REST API Request Builder; JSON Request Body Builder; API Response Formatter; GraphQL Formatter; GraphQL Query Builder; GraphQL Variables Formatter; HTTP Request Builder; Basic Auth Header Generator; Bearer Token Header Generator; API Request Tester.

There was no prior registered API station to preserve or migrate. UI controls now follow the exact contracts rather than a generic workbench. cURL ↔ Fetch uses separate public links; route, history, H1, breadcrumb, controls, example and metadata update together. No inputs are carried into route search parameters.

## Network and secrets boundary

- Only API Request Tester invokes `fetch`, and only after Send Request. It calls the entered HTTP/HTTPS endpoint directly in the browser with `credentials: omit`, an AbortSignal and no retry. No backend proxy, TLS bypass, client certificate, server forwarding or CORS bypass exists.
- Mount, examples, edits and Clear never send requests. Cancel, edits, Clear and unmount abort active work and discard stale completions. Aborting does not undo work already performed by an endpoint.
- Actual 4xx/5xx responses remain status/body results, not transport exceptions. Browser transport failures use “Network or CORS error”; browsers cannot reliably identify CORS as the definite cause. Only CORS-exposed response headers and final redirect results are visible.
- Elapsed response time is measured through response reading in the browser; it is not pure server execution time. Bodies are decoded as text, bounded to 200,000 characters; oversized responses fail rather than return silent truncation.
- Password and bearer fields are obscured, and sensitive structured header values become password inputs. Inputs/results remain component memory only: no storage, analytics, logs, URL payloads or credential harvesting. Generated Authorization/code outputs intentionally contain supplied secrets; copying them is explicit. Clear releases references, not secure memory erasure.
- Response HTML/XML/JS and generated snippets are inert text. No iframe, trusted HTML injection, `eval`, `Function`, shell execution, uploads or automatic schema introspection.

## Supported conversion and formatting subsets

- cURL: literal POSIX-style command quoting, URL, `-X`/`--request`, `-H`/`--header`, `-d`/`--data`, `--data-raw`, literal `--data-binary`, literal `--data-urlencode`, `-u`/`--user`, `--url`, `--globoff` and common attached forms. Unsupported options reject conversion explicitly; file references, shell substitutions, redirects, multiple URLs and unresolved expansion are rejected. This is not a complete cURL implementation.
- Static Fetch: literal URL/options, literal header objects/lists, string bodies and static `JSON.stringify` data. Unresolved variables/functions/computed values are unsupported. No JavaScript executes. Generated Axios/Python require those libraries in the recipient's own environment.
- REST: ordered repeated parameters and headers; JSON is validated, Text and already URL-encoded form body are explicit. GET/HEAD body warnings disclose omission from runnable browser Fetch/cURL output. Browser forbidden headers/ByteString normalization are disclosed; Unicode header values can be generated locally but may not be sendable.
- JSON body: strict typed fields, duplicate-key rejection, bounded nested JSON and lossless supported numbers. Top-level field order is preserved even for integer-like keys. Nested object formatting follows the existing helper behavior.
- Responses: Auto Detect is heuristic; JSON is source-preserving, XML is parsed locally with no DOCTYPE/entities, HTML is formatted only as source. Raw-text/preformatted/omitted-tag HTML may remain unchanged with a warning. Text stays exact.
- GraphQL: bounded native executable-document tokenizer/parser for query/mutation/subscription/fragments, aliases/directives/arguments/variables and nested selections. No SDL, schema/type validation or operation execution. Comments are retained at the document start with a warning. Query builder supports typed arguments and names/nested selection lists. Variables require an object JSON root; formatting preserves numeric spellings/duplicate properties without defining their application meaning.
- Basic Auth uses UTF-8 Base64; username colons are rejected, password colons supported. Encoding is not encryption: use HTTPS. Bearer edge whitespace is trimmed; internal whitespace/control characters fail.

## Limits and outputs

200,000-character input fields, 1,000 structured rows, aggregate input/node/nesting bounds. Local HTTP/GraphQL results have a complete serialized 200,000-character cap; conversions permit 1,000,000 output characters with token/option/header/body caps. UI performs additional bounded preflight. No unnecessary downloads were added. Copy cURL/Fetch are distinct on REST; Copy Response copies only the tester response body. Internal parsing diagnostics are not added as public outputs.

## Executed verification — 2026-10-05

- Baseline: Node 22.19.0; Git status confirms no repository; typecheck and 4,058 tests passed; lint exit 1 due to existing missing ESLint config. Initial build attempt failed during concurrent incomplete API integration; no baseline build pass is claimed. The detected dev process was stopped before final build.
- Final: `npm run typecheck` passed; `npm test` passed **4,582 tests / 55 files**, including all prior stations; `npm run build` passed **220 tool URLs / 231 generated pages**. Standalone lint remains exit 1, not a pass.
- API tests cover exact metadata/forms/actions, light/dark DOM themes, keyboard and focus, duplicate/Unicode/empty/malformed inputs, static conversion non-execution, all request methods/body types, GraphQL syntax/nested selections, inert response markup, private fields, Copy/Clear, mocked direct fetch HTTP statuses/CORS/network/abort/timing and SSR hydration. DOM theme tests do not establish visual layout.
- `node scripts/verify-api.mjs` passed read-only production markup checks for 16 tools, landing/home/sitemap and nine prior-station routes. It never executes tester snippets or sends requests to sample API endpoints. A final invalid-variables display correction also passed 191 targeted component/registry/integration tests and a fresh typecheck/build.
- Live browser: `/stations/api` loaded with all16 cards, exact description/count, search and related links in a 310×444 DOM observation. Image capture failed; this is not visual/workflow acceptance. No sample API endpoint was contacted. Existing AdSlot/analytics service abstractions are absent; none was invented.

## Remaining live-browser acceptance

- [ ] All 16 tools: actual processing, errors, Unicode, Copy/Clear, keyboard/focus, direct route refresh and paired history.
- [ ] Desktop/mobile layout, dark/light theme/toggle, long code/header/query controls and live accessibility.
- [ ] Tester: deliberately approved safe fixture endpoint requests covering CORS/network/HTTP errors, exposed headers, body/time and cancellation; no automatic send/retry and no proxy.
- [ ] Live console/hydration/CSP/network panel checks. Unit/mock/HTTP markup checks are not proof of these browser conditions.

Existing lint/dependency findings and previous stations' browser checklists remain separate unresolved gates. No commit, push or deployment occurred.
