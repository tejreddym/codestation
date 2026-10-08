# Text Station

Implementation verified 2026-10-03; documentation completed 2026-10-05. Scope: the **31 specified Text routes only**. All public tools now use exact contracts from `config/text-tools.ts`, composed into the existing central `config/tools.ts`. No dependencies added.

## Audit and corrections

The legacy UI used broad name matching, unrelated operation/selectors, source fields on generators, a regex switch for literal replacement, unique-only extraction, extra output metadata and incomplete Clear. Regex Line Extractor was intercepted by the legacy Regex branch. Public Text routes now use an exact-ID lazy `TextWorkspace` branch before the legacy workbench; legacy components/helpers remain unchanged for other consumers.

| Route (`/tools/…`) | Exact inputs | Results / corrections |
|---|---|---|
| text-counter | Text | Six separate character, whitespace-free character, word, line, estimated sentence and paragraph counts. No count-type selector. |
| case-converter | Text, Case type | Transformed text; exactly nine specified cases, Unicode marks and punctuation preserved as documented below. |
| duplicate-line-remover | Text, Case sensitivity | First occurrences in original order; no generic line-operation controls. |
| sort-lines | Text, Sort order, Case sensitivity | Stable ascending/descending sorting without trimming or deduplication. |
| reverse-lines | Text | Reordered lines, not reversed line contents. |
| reverse-text | Text | Grapheme-aware reversal with code-point fallback. |
| whitespace-cleaner | Text | Collapse spaces/tabs and trim each line without discarding blank-line structure. |
| empty-line-remover | Text | Remove whitespace-only lines; preserve remaining content. |
| prefix-suffix-adder | Text, Prefix, Suffix | Literal affixes on every record, including empty records; no automatic punctuation or skip-empty setting. |
| find-replace | Text, Find text, Replace text, Case sensitivity, Replace all | Updated text and replacement count; both search and replacement literal. Empty Find errors explicitly. |
| text-diff | Text A, Text B | Labeled diff cards and added/removed/unchanged content. No view selector or internal library metadata. |
| slug-generator | Text | Lowercase, accent-normalized, hyphenated Unicode slug. No generator settings. |
| lorem-ipsum-generator | Amount, Unit | Generated Lorem Ipsum and exact generated unit count; Words/Sentences/Paragraphs. No source input. |
| random-text-generator | Length, Unit | Generated placeholder text and count; Characters/Words/Sentences/Paragraphs. No source input. |
| url-extractor | Text | HTTP/HTTPS occurrences and URL count, including duplicates; no network checks. |
| email-extractor | Text | Email-like occurrences and count, including duplicates; no delivery/existence checks. |
| number-extractor | Text | Signed integer/decimal occurrences and count; no unit/currency conversion. |
| regex-line-extractor | Text, Regex pattern, Flags | Matching original lines and matching-line count. Exactly g/i/m/s/u/y/d; native JavaScript semantics and timed worker. |
| line-deduplicator | Text, Case sensitivity | Deduplicated text and removed duplicate count; retains its separate public identity. |
| line-shuffler | Text | Unbiased Fisher–Yates permutation preserving line contents/count. |
| text-normalizer | Text | Fixed NFC plus LF normalization; no normalization selector. |
| tabs-to-spaces | Text, Spaces per tab | Every tab becomes 1–16 spaces; default 4. |
| spaces-to-tabs | Text, Spaces per tab | Complete space groups become tabs; remainder spaces unchanged. |
| line-ending-converter | Text, Line ending | Normalize all separators to LF/CRLF/CR without doubled breaks. |
| lf-to-crlf | Text | Fixed CRLF direction; no format selector. |
| crlf-to-lf | Text | Fixed LF direction; standalone CR also normalized. |
| bom-detector | Text | Leading BOM status and type; U+FEFF does not prove an original UTF-8 encoding. |
| bom-remover | Text | Remove one leading U+FEFF only, preserve later characters. |
| sentence-counter | Text | Estimated sentence count; repeated punctuation is not counted repeatedly. |
| paragraph-counter | Text | Paragraphs separated by blank/whitespace-only lines, not ordinary line breaks. |
| character-counter-without-spaces | Text | Grapheme count excluding all whitespace; old `character-counter-no-spaces` permanently redirects. |

## Shared implementation

- `components/TextWorkspace.tsx` / `.module.css`: exact visible labeled controls, stable IDs, associated errors, keyboard actions, theme-token styling, responsive panels and exact per-value Copy. Empty strings remain copyable. Clear resets fields/options/results; edits and navigation abort/invalidate work. No uploads, fake generator inputs, Download or Use output as input controls.
- Diff rows explicitly say Added/Removed/Unchanged with symbols, not color alone. Cards paginate 50 per page with total/range; every accepted row remains accessible. Card Copy copies its exact original text, including terminator; aggregate content outputs have their own exact Copy. No hidden serialized diff is copied as though it were the visible card content.
- `lib/tools/text/{engine,shared,unicode,types}.ts`: bounded processing, line parsing/rendering, secure rejection-sampled shuffle/generation and Unicode segmentation. `diff.ts` is a small lazy-loaded local LCS implementation, not a new dependency.
- `lib/tools/text/client.ts` and `workers/text-station.worker.ts`: mandatory workers for Regex Line Extractor and Text Diff, worker generation when available, and offloading when aggregate string inputs exceed 16,384 UTF-16 units. Small simple operations run locally on action, not on every keystroke.
- `ToolWorkspace.tsx`, the shared route shell and `next.config.ts` integrate only Text dispatch, factual metadata and one legacy alias. Tabs↔Spaces and LF↔CRLF have real reciprocal URLs, paired metadata, distinct descriptions/actions/examples/output labels and keyed state reset.

## Text and line conventions

- Characters/reversal use `Intl.Segmenter` grapheme clusters where available; older runtimes fall back to code points. Word counts use word-like segments with a Unicode letter/number/mark fallback. Sentence counts are estimates and ignore punctuation-only segments. Results can vary with runtime segmentation data and are not linguistic truth.
- Whitespace-free character counting removes JavaScript whitespace before segmentation. Paragraphs are separated by blank or whitespace-only lines; leading/trailing empty regions do not count.
- Line operations recognize LF, CRLF and CR. They preserve the first encountered separator style; mixed endings normalize to that separator, as disclosed in the UI. A final newline terminates the last record rather than adding a phantom record. Empty text has zero records. Internal empty records are retained unless removal/deduplication specifically applies.
- Reordering an empty record to the final position may require a terminator to represent that blank record faithfully. Existing terminal newlines are retained while records remain. Removing all records yields empty text. Sort compares stable JavaScript lexical keys, optionally lowercased, not locale/natural-number collation; case-insensitive deduplication lowercases comparison keys only.
- Native textarea editing can normalize pasted CRLF/CR to LF before an application receives the value. Engines preserve the supplied string according to the above rules; generated output and Copy retain exact CR/LF characters. Textareas are not byte-preserving file editors and no file input was added.
- Case conversion is not language-specific parsing. Identifier styles recognize camel/acronym boundaries and transform whitespace/underscore/hyphen separators; other punctuation and emoji remain, so output is not guaranteed to be a valid programming identifier. Combining marks remain attached. Slugs retain non-Latin letters/marks while folding Latin accents; non-ASCII slugs may need URL encoding by a consumer.
- Find & Replace escapes literal search internally and uses a callback for literal replacement, so `$&`, `$1` and similar strings are not replacement syntax. Case-insensitive matching follows native Unicode regex case equivalence without altering preserved text or using case-folded string indexes.

## Extraction, generators and limits

- URL extraction recognizes HTTP/HTTPS only, preserves spelling/order/duplicates and strips common surrounding prose punctuation/unbalanced closing brackets while retaining balanced brackets. This is a heuristic: meaningful terminal URL punctuation can be ambiguous. Native URL parsing checks syntax locally; domain existence is not queried.
- Email extraction recognizes pragmatic ASCII email-like forms surrounded by Unicode text, not every RFC mailbox or internationalized address. Numbers are signed integer/decimal fragments, including `.5`; scientific notation, grouping separators, currency and percentages are not interpreted semantically.
- Regex Line Extractor uses the selected flags unchanged and resets `lastIndex` before each line, including global/sticky modes. Duplicate/unsupported flags and invalid patterns error without echoing content. Empty regex follows native behavior. Every regex execution requires a disposable worker with a **1,500 ms** deadline; no main-thread fallback. This contains excessive backtracking but does not claim regex is ReDoS-immune.
- Lorem Ipsum is deterministic local vocabulary. Random text uses local placeholder vocabulary and browser randomness; it is not sourced from user content and is not advertised as a password/token generator. Each generated sentence contains 12 words; each paragraph contains three sentences. Requested unit counts are exact.
- Maximum generation amounts: **100,000 characters**, **10,000 words**, **1,000 sentences**, **100 paragraphs**. Minimum is 1; invalid amounts error, never clamp. Randomness uses Web Crypto rejection sampling; unavailable randomness errors rather than faking output.
- Inputs: **1,000,000 UTF-16 code units per field**, **100,000 line records**. Output budget: **4,000,000 units**, including labels and duplicated structured diff payload. Extraction: **10,000 occurrences/matching lines**, with an explicit error on overflow, not partial success.
- Diff: **2,000 raw line tokens per side**, **4,000,000 comparison cells**. Raw terminators participate in comparison, so final-newline and CR/LF differences are detected. Input reconstruction and changed/unchanged partitions are tested. Large accepted comparisons run in a worker; no diff library loads globally.
- Worker deadline is 10 seconds except regex's 1.5 seconds. Completion, errors, Clear, edits and unmount terminate workers. Without workers, regex/diff and large text fail explicitly; only small simple processing and small Words/Characters generation can fall back locally. Time/resource limits can reject valid large workloads.

## Privacy and scope

No processing input/result goes to network requests, analytics, logs, URLs, localStorage or sessionStorage. Extracted URLs/emails are inert text, not clickable navigations or remote checks. React renders results as text; no HTML injection, eval or Function execution. Local worker messages stay in browser memory. Clipboard writes occur only on explicit Copy; clipboard retention is controlled by the browser/OS.

No existing AdSlot, analytics or Pro/account abstraction was found; none was invented. Global theme tokens and animated toggle remain unchanged. Legacy `TextStation`, legacy text helpers and the generic workbench are preserved; public Text routes bypass them, fixing Regex Line Extractor's old misrouting without modifying Regex Station.

## Executed verification

Baseline before changes: typecheck, **2,141 tests / 30 files** and production build passed. `git status` confirmed no Git repository. The active workspace dev server was stopped before building.

- `npm run typecheck`: passed.
- `npm test`: **2,676 tests / 34 files passed**, including **535 new Text tests**: engine 326, client 9, UI 162, metadata 38.
- Every public tool has exact example/output, empty/boundary/large-text/Unicode workflow coverage where applicable. Generators cover every unit at minimum/larger/maximum amounts and invalid boundaries, and UI tests prove no source field exists. Transform tests cover ASCII, combining accents, Telugu, Hindi, emoji sequences/flags, CJK and Arabic; mixed line endings, terminal/blank records, all case types, literal replacement, native regex flags, extraction duplicates/limits, NFC, BOM and newline-sensitive diff reconstruction.
- UI checks cover all 31 tools under both DOM theme attributes, keyboard submit/Copy/Clear, exact visible clipboard strings including empty/CRLF values, error associations, no fetch/XHR/storage/log calls, labeled paginated diff, XSS-safe rendering, worker cancellation, all four directional route states, clipboard denial and 31 SSR→hydrate stable-node/ID checks. These are not screenshots or real-browser worker evidence.
- `CI=1 npm run lint < /dev/null`: **exit 1 / blocked** by existing absent ESLint configuration and deprecated `next lint`. No pass claimed and no unrelated configuration migration attempted.
- `npm run build`: passed; **160 prerendered tool URLs / 167 total generated pages**.
- `node scripts/verify-text.mjs`: passed **31 production pages**, exact fields/defaults, generator isolation, direction links, title/description/canonical/index metadata, **34 navigation links**, **9 page scripts**, **one 308 alias** and **five other-station routes**.
- Production script executed all **31 emitted-worker examples**, Unicode reversal, exact CRLF, literal-dollar replacement, diff and regex-state vectors in a Node worker-thread/VM harness. An actual catastrophic-backtracking fixture was terminated after 1,500 ms and a fresh worker succeeded. Both worker/diff assets served successfully. This proves bundled code/isolation in the harness, not browser/CSP compatibility.
- Scope: **100 protected pre-existing source hashes** matched baseline; all **129 non-Text runtime registry entries** unchanged. Existing helper/components/tests for other stations and global theme preserved. No dependency additions, Git commit, push or deployment.

Historical scope snapshot (local verification data): `/private/var/folders/69/l4j48t2j7pd9npmrwgw19ldc0000gn/T/opencode/text-contract-3R5WvQ/`. On resuming 2026-10-05, this temporary snapshot was absent (`ENOENT`), so the earlier scope comparison could not be repeated.

Resumed checks on 2026-10-05: typecheck, **2,676 tests / 34 files**, a fresh production build and the complete production/emitted-worker script passed again. Lint remained exit 1. The previous preview was offline; the first HTTP check failed with connection refused, then passed after starting the rebuilt production server. No active workspace server was present during the build.

## Browser acceptance — pending, not passed

Earlier navigation/observation returned `needs_attention` for website-access review. On resuming 2026-10-05, no conversation browser tabs remained; opening the preview timed out and a fresh tab inspection still returned none. No live browser verification was possible. CSS and jsdom theme checks do not establish visual/mobile acceptance.

For each of the **31 routes**, once access works:

- [ ] Direct load/refresh: matching URL, title, breadcrumb, controls, examples and metadata; no console/hydration errors.
- [ ] Keyboard entry, selectors/flags, visible focus, processing, exact Copy, full Clear and understandable validation.
- [ ] Light/dark contrast and unchanged animated toggle; mobile 320/375/768 px and desktop, touch targets, textarea usability and internal long-line scrolling without page overflow.
- [ ] Tabs↔Spaces and LF↔CRLF links, Back/Forward/refresh: correct route-specific state, labels, output and examples.
- [ ] Generator units/counts and no source inputs; extraction occurrences remain text only; diff pages/labels and empty-result copying.
- [ ] Real worker timeout/cancellation/recovery, clipboard allow/deny and exact resulting CRLF bytes where clipboard inspection permits.
- [ ] With public fixtures only, confirm no text/pattern/extraction/diff payloads in requests, storage, URLs/history, analytics or logs.

Preview: `http://localhost:3000/tools/text-counter`. Stop the production server before rebuilding `.next`. Existing lint and dependency-audit findings remain separate maintenance tasks.
