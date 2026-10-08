# Regex Station

Updated 2026-10-03. Scope: all nine specified public Regex routes, browser JavaScript `RegExp` only. No dependencies added, other-station implementation changes, global styling changes, new analytics or ad provider.

## Audit and exact contracts

The legacy path forced global replacement, silently sliced text to 200,000 characters, returned one Tester match, omitted `d`, deduplicated flags, did not perform independent flag comparisons, exposed unrelated fields/presets/downloads, and cleared only test text. These behaviors are replaced on public Regex routes by the dedicated lazy `components/RegexWorkspace.tsx`.

| Route (`/tools/…`) | Inputs | Outputs / corrections |
|---|---|---|
| regex-tester | Regex Pattern, Test text, Flags | Overall status, count and structured match cards with exact matched text, start/end positions and captures. All matches only with `g`; no mutation. |
| regex-escape | Plain text | Regex-escaped text only. No pattern test, flags or slash delimiters. All JavaScript pattern metacharacters escaped; `hello.world?` → `hello\.world\?`. |
| regex-replace-tester | Regex Pattern, Test text, Replacement text, Flags | Replaced text and replacement count. Native `String.prototype.replace` tokens, including `$&`, `$1`, `$2`, `$\``, `$'`, `$$`, `$<name>`. No forced `g`. |
| regex-match-inspector | Regex Pattern, Test text, Flags | Separate numbered matches with full text, start/end, length and capture groups, not just boolean or highlighted input. |
| regex-group-extractor | Regex Pattern, Test text, Flags | Per-match capture values, numeric indexes and named labels. Unmatched is `null`, distinct from empty string. Full test text is not the output. |
| regex-flag-tester | Regex Pattern, Test text | Eight independent rows: No flags, g, i, m, s, u, y, d; validity, match status, count and first match where applicable. No Flags input. Invalid configurations stay in their own row. |
| regex-pattern-builder | Literal text, Character matching mode, Quantifier, Case sensitivity | Generated pattern only. Exact text/Any character/Digit/Non-digit/Word character/Non-word character/Whitespace/Non-whitespace; Exactly once/Zero or one/Zero or more/One or more. Case-insensitive choice instructs use of `i`, never inserts flags. No presets, lookahead builder, anchors or extra settings. |
| regex-capture-group-tester | Regex Pattern, Test text, Flags | Source definitions separated into numbered/named captures, non-capturing groups and lookarounds; per-match full match and captured values. Definitions remain visible even with no matches. |
| regex-split-tester | Regex Pattern, Test text, Flags | Individually numbered native split parts and total count. Captured separators and unmatched captures preserved, not just separator matches. |

Flags are keyboard-operable checkboxes for exactly **g, i, m, s, u, y, d**. No flags are selected initially. Explicit examples load their documented flags. Duplicate, unknown, spaced or slash-delimited flag strings are rejected by the engine, never normalized. Pattern source is passed unchanged to `new RegExp`; `/pattern/flags` is not parsed as a convenience syntax. PCRE/Python/.NET syntax is not emulated or repaired.

## Semantics and shared utilities

- `config/regex-tools.ts` contributes metadata-only `regexContract` entries to the existing `config/tools.ts`; discovery still uses that single central registry. Existing IDs/slugs are unchanged; no redirects needed. Related links, unique titles/descriptions, canonical/index directives and two concise factual sections are route-specific.
- `lib/tools/regex/engine.ts` implements the nine actions with native RegExp, replace and split. First-match vs global/sticky semantics follow selected flags. Empty pattern/test strings are valid. Global empty matches advance safely by UTF-16 code unit or Unicode code point according to `u`; no infinite manual `exec` loop.
- Offsets/lengths are zero-based UTF-16 code units, end-exclusive—not grapheme indexes. `d` retains full/capture index ranges; capture ranges are shown when selected. Unsupported browser `d` produces a clear error, never an implicit downgrade.
- `structure.ts` scans only successfully compiled patterns for definitions/source spans. It respects escaped punctuation, character classes, named groups (including escaped names), nested captures and lookaround/noncapture distinctions. It is not another regex engine or a syntax validator.
- `replacement.ts` preflights native substitution output length without executing replacement text. Final substitution always uses native `String.replace`. Replacement limits are conservative: an intermediate projected length may trigger rejection before later shortening substitutions.
- Builder quantifiers apply to the entire escaped literal, using a non-capturing group when required (including empty or multi-code-unit literal text). Nonliteral modes ignore Literal text with an explicit field hint. Any character generates `.`, which excludes line terminators without `s`; `\d` and `\w` have JavaScript semantics, not full Unicode letter/digit classification. No slash delimiters or embedded flags are generated.
- Split follows native JavaScript behavior: `g` is unnecessary for splitting all separators, captured separators appear in parts, and unmatched captures display `null` to distinguish them from empty strings. The native split algorithm's internal sticky matching is not an application-added flag.

## UI, privacy and scope

`RegexWorkspace.tsx` and `RegexStation.module.css` use existing tactile theme tokens and the unchanged theme toggle. Inputs have visible labels, stable route-scoped IDs, monospace editors, associated readable errors and keyboard focus. Output uses structured match cards and per-value exact Copy. Empty output is copyable as zero characters; null is visibly `null` with an unmatched explanation. No Download controls. Clear restores every field/option, removes results/errors and cancels work. Editing/route changes also invalidate stale results.

Matches, groups, definitions and split parts paginate in groups of 50, with explicit total/range and Previous/Next controls. All accepted results remain reachable; pagination is not input truncation. Long values scroll inside focusable text areas rather than overflowing the viewport. Output is React text, never injected HTML.

No application input/output requests, persistence, logging, analytics payloads, user code execution, eval or Function exist in the new public processing path. A local Worker message is not a server upload. No existing AdSlot/analytics/Pro abstraction was found; none was invented. Clipboard writes occur only on Copy and clipboard retention belongs to the browser/OS.

The old `components/RegexStation.tsx`, `lib/tools/regex-station.ts` and `workers/regex.worker.ts` remain unchanged for legacy workbench consumers, including a pre-existing broad `regex-*` dispatch used outside this station. Public Regex routes bypass them through the exact-ID lazy workspace branch. Keeping that boundary avoids changing unrelated Text-station behavior. Legacy conformance debt is not claimed resolved.

## Worker safety and limits

- `lib/tools/regex/client.ts` dispatches every operation using a user-supplied regex to `workers/regex-station.worker.ts`. Even a very short pattern can backtrack catastrophically, so there is **no main-thread regex fallback**. Without Worker support, matching/replace/split/group/flag tools report an error. Bounded literal escaping and structured building may run locally without a worker because they do not execute a supplied pattern.
- Every matching worker is disposable: terminate on completion, error, edit, Clear, navigation or **1,500 ms** timeout. The UI can reject a stalled worker even while its native RegExp call is busy. This contains excessive work; it does not prove JavaScript regex is immune to ReDoS or make a dangerous pattern safe elsewhere.
- Limits: **16,384 pattern UTF-16 code units**, **200,000 text/replacement/literal code units**, **2,000 matches or split parts**, **4,000,000 output-budget units**. The output budget includes structural overhead and repeated capture/definition content, so some structured outputs fail earlier than the raw visible text length would suggest.
- Limits produce explicit errors with no partial-success result. The engine does not slice inputs. Split requests one extra part to detect overflow and errors rather than silently returning that limited array. Replacement size is checked before allocation. Flag comparison fails the whole run on a resource limit/timeout rather than presenting an incomplete matrix as complete.
- Limits may reject legitimate large workloads. Native browser syntax availability and maximum compilable pattern sizes vary. Long escaped/generated pattern source can exceed a downstream engine's resource limit even though construction is syntactically valid. No cross-engine equivalence, PCRE support or full parser-conformance claim.

## Executed verification

Baseline before changes: `git status` confirmed no Git repository; typecheck, **1,568 tests / 24 files** and production build passed. The running workspace dev server was stopped before the build. Standalone lint exited 1 for absent ESLint configuration.

Final checks:

- `npm run typecheck`: passed.
- `npm test`: **1,925 tests / 28 files passed**, including **357 new Regex tests** in engine/client/UI/registry files. Coverage includes each tool's exact contract, examples, valid/invalid/empty input where applicable, Unicode, special characters, zero/one/multiple matches, large input guards, all flags, native replacement tokens, capture definitions/unmatched values, native captured splitting, all 64 builder option combinations, and escape metacharacters.
- UI tests run every tool under dark/light DOM attributes and cover keyboard submit/flags/Copy/Clear, exact clipboard values (including empty strings), accessible error associations, clipboard denial, XSS-safe text, pagination, cancellation/stale replies and nine real SSR→hydrate node/ID checks. No fetch/XHR/storage/log calls occurred in those workflows. The UI transport is a test worker that invokes the real engine; not browser-worker proof.
- `CI=1 npm run lint < /dev/null`: **exit 1 / blocked**, missing ESLint config and deprecated `next lint` prompt. Build's “Linting” stage is not a standalone lint pass. No unrelated lint/dependency changes were made.
- `npm run build`: passed; **160 prerendered tool URLs / 167 total generated pages**.
- `node scripts/verify-regex.mjs`: all **9 Regex pages**, exact SSR fields/defaults/flag choices, title/description/canonical/index metadata, **12 navigation links**, **9 page scripts** and **5 other-station smoke routes** passed.
- The production script executes the actual emitted Regex worker in a Node worker-thread/VM harness. All **9 examples**, non-global replacement, Unicode zero-length advancement, captured splitting and invalid syntax vectors passed. An actual catastrophic-backtracking fixture was terminated after 1,500 ms; a fresh worker then processed a valid fixture successfully. The worker asset served successfully. This is isolation/bundler evidence, **not real browser/CSP acceptance**.
- Scope audit: **82 protected pre-existing source hashes** unchanged; legacy RegexStation also matched its saved pre-change hash. All **151 non-Regex runtime registry entries** matched the baseline. Other station implementations, global theme/styles and existing tests were preserved. No dependency additions.

Scope baseline is local verification data: `/private/var/folders/69/l4j48t2j7pd9npmrwgw19ldc0000gn/T/opencode/regex-scope-EOKLBo/`.

## Browser acceptance — pending, not passed

Navigation to the Regex preview and a fresh built-in browser observation timed out. No live visual/mobile, clipboard-permission, browser-worker/CSP, browser history or console result is claimed. CSS rules and jsdom theme/keyboard/hydration checks are not screenshot/layout evidence.

When browser access works, for **each of the nine routes**:

- [ ] Direct load/refresh: URL, H1, breadcrumb, description, exact inputs and empty output; no console/hydration errors.
- [ ] Keyboard: every input/flag/action/result scroll area, visible focus, readable associated errors, exact Copy and full Clear.
- [ ] Light/dark and unchanged animated toggle: labels, selected flags, matches, notices and errors remain readable.
- [ ] 320/375/768 px and desktop: input/result stacking, touch targets, readable editor, internal long-result scrolling and no viewport overflow.
- [ ] Normal/empty/invalid patterns and text, zero/many/Unicode matches; replace/split do not mutate test text; all selected flags retain native behavior.
- [ ] Worker timeout and cancellation remain responsive in the browser; subsequent run recovers; no late result appears after Clear/edit/navigation.
- [ ] Real clipboard success/denial, result pagination, direct related links, Back/Forward and refresh.
- [ ] With public test markers, verify no pattern/text/replacement/capture payloads in requests, URLs/history state, storage, analytics or logs.

Preview: `http://localhost:3000/tools/regex-tester`. Stop its production server before rebuilding `.next`. Existing lint/dependency-audit remediation remains a separate maintenance task.
