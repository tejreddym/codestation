# Cron Station

Implemented 2026-10-05. Scope: **Cron only**, six public tools and `/stations/cron`. No other station engines/components/contracts were changed. No dependencies added.

## Reference picker follow-up — 2026-10-05

Cron Next Run now uses the existing `DateTimePicker` calendar and clock, with an opt-in UTC mode for absolute reference instants. Calendar selection and clock steppers/presets edit UTC fields and emit an explicit Z timestamp, preserving milliseconds. A manually supplied offset is interpreted as its absolute instant before picker edits; it remains unchanged until the user acts. The separate IANA timezone still defines the schedule’s wall clock. Keyboard users can tab to either picker button, open the calendar with ArrowDown from the reference input, and close with Escape (returning focus).

**Current date and time** is a separate explicit button: every click captures a new `new Date().toISOString()` device-clock snapshot. It does not prefill on load, continuously tick, change the schedule zone, or immediately calculate a result. Edits/current snapshots invalidate existing results and cancel in-flight work. Clear resets the reference and closes the popup. Raw manual input remains editable and invalid/oversized values are not silently truncated.

The shared picker’s default local mode is preserved for other consumers; its authorized UTC opt-in enhancement supersedes the original unchanged-shared-picker scope claim below. Popup sizing/calendar tiles are constrained by Cron-scoped CSS, not a global redesign. Reference bounds and strict parser semantics remain 1970–2099/explicit offsets.

Follow-up checks executed: typecheck, **2,978 tests / 38 files**, production build and updated `node scripts/verify-cron.mjs` passed. Seven new UI cases cover repeated snapshots/no polling, real calendar and clock selection, UTC offset/precision, host DST, keyboard/Escape/Clear, result invalidation and worker cancellation/late replies. All **49 Cron UI tests** also passed with `TZ=America/New_York`; prior shared picker/hydration tests passed. Production markup now checks calendar/clock/current-action availability. Full live-browser picker acceptance remains pending; existing lint blocker unchanged. Earlier counts/scope checks below describe the original Cron milestone, not this follow-up.

## Audit and architecture

There was no existing Cron engine, route, dialect selector or station landing route. The existing app exposes categories through the central tool registry, homepage station cards and `/tools?category=…` filters. It has the reusable `StationMark` icon, tool cards, tactile tokens, lazy workspaces and illustrated theme toggle; no implemented analytics, AdSlot or Pro/account service was found.

- `config/cron-tools.ts` contributes six `cronContract` definitions to `config/tools.ts`, not a parallel discovery registry.
- `config/stations.ts` derives existing station entries/counts from that central registry. Cron has ID `cron`, name `Cron`, description, `station-mark` icon, six tools, related Date & Time/Text/Regex stations and route `/stations/cron`. Existing stations retain their old filtered-catalog URLs; no new landing implementations for them.
- `app/stations/cron/page.tsx` and `components/CronCatalog.tsx` provide title, concise syntax/purpose notices, local searchable tool cards, no-result state and related station links. Homepage Cron navigation and sitemap point to the landing page.
- `components/CronStation.tsx` / `.module.css` provide exact inputs, route-scoped stable IDs, field-associated errors, safe inert monospace output, per-value Copy, full Clear and keyboard/touch/mobile styling using existing theme variables/buttons. Clear restores generator defaults (`*` for five fields, blank Second); other inputs reset empty. Edits/Clear/navigation invalidate results and cancel pending work. No uploads, Download, scheduler actions, extra timezone shortcuts or generic text fields.
- `ToolWorkspace.tsx` lazy-dispatches exact Cron IDs. The shared tool route conditionally adds Cron canonical/index metadata, factual input/output/purpose/usage/limitations and related links. Other tool page behavior stays unchanged.

| Route | Inputs | Outputs |
|---|---|---|
| `/tools/cron-generator` | Second (optional), Minute, Hour, Day of month, Month, Day of week | Cron expression; Human-readable schedule |
| `/tools/cron-explainer` | Cron expression | Field breakdown; Human-readable schedule |
| `/tools/cron-validator` | Cron expression | Valid/Invalid status; Error message |
| `/tools/cron-next-run` | Cron expression; Reference date/time; Timezone | Next run date/time; Time until next run |
| `/tools/human-to-cron` | Human schedule description | Cron expression; Parsed schedule |
| `/tools/cron-to-human` | Cron expression | Human-readable explanation, including field interpretations |

Explainer/To Human show original field notation and readable interpretations rather than raw parser objects. Their individually copyable field cards supplement the contracted text output. Invalid Validator input yields **Invalid + first meaningful error**, not a crashed form; syntax-valid impossible calendars are still Valid and explicitly may lack an occurrence.

## Supported dialect and notation

**Default:** five-field Unix-style Cron, `minute hour day-of-month month day-of-week`, evaluated at second 0. **Explicit extension:** six fields with seconds first. Generator leaves Second blank by default; entering any nonempty value, including `*` or `0`, visibly selects the seconds-first extension. Other tools identify five versus six fields from the supplied expression and label that convention in their UI. There is no pre-existing dialect selector to reuse and none was added.

Each field supports specific integers, `*`, inclusive ascending ranges, lists and positive steps: `*/5`, `5-20/3`, `5/10`. A stepped single value continues to the field maximum, not an unbounded elapsed interval. Steps restart inside the field, so `*/7` minutes means 0,7,…56 of each hour, not a continuous seven-minute timer.

Bounds: seconds/minutes 0–59, hours 0–23, day-of-month 1–31, months 1–12, weekdays 0–7. Case-insensitive JAN–DEC and SUN–SAT aliases are accepted. Sunday is 0 or 7; ranges/steps expand in raw 0–7 order before duplicate Sundays merge. Names use Sunday=0, so a descending named range such as MON–SUN is rejected; use MON–SAT plus SUN in a list or an appropriate numeric range.

The implementation uses **Vixie-style day semantics**: a leading `*` in either day field, including `*/n`, means both day selections must match. Otherwise restricted day-of-month and day-of-week selections use **OR**. Example: `0 9 1 * MON` matches first-of-month or Mondays; `0 9 */2 * MON` requires both the selected odd date and Monday. The UI discloses this rule; descriptions and Next Run use the same parsed semantics.

Rejected: Quartz/AWS `?`, `L`, `W`, `#`, Jenkins `H`, year fields, macros (`@daily`), command columns, comments, environment assignments, wrapping/descending ranges, zero/fractional/out-of-range steps and invalid bounds. A plain numeric six-field expression is interpreted only as the declared seconds-first extension, never inferred as another dialect. These tools do not convert Kubernetes CronJob configuration, Quartz, Jenkins or EventBridge specifications, nor certify compatibility with every Unix daemon. Scheduler-specific DST catch-up/suppression policies can differ from the evaluator’s policy below.

## Local utilities and deterministic phrases

`lib/tools/cron/{parser,explain,human,next-run,engine,client,types}.ts` implements a bounded native parser/evaluator; no Cron/NLP/date library was added. Syntax parsing and human conversion run locally on explicit action. `workers/cron.worker.ts` runs Next Run in a disposable browser worker, mandatory even for small expressions, with a **10-second deadline** and no server/main-thread fallback. Completion, failures and cancellation terminate the worker.

Human to Cron supports only anchored phrases (case-insensitive, outer whitespace allowed):

- `every minute` → `* * * * *`
- `every N minutes` (1–59) → `*/N * * * *` (1 uses `*`)
- `every hour` → `0 * * * *`
- `every day at 9:00` → `0 9 * * *`
- `every Monday at 10:30` (or another full weekday name) → `30 10 * * 1`
- `weekdays at 18:00` → `0 18 * * 1-5`

Times use a 24-hour clock; fuzzy, ambiguous, compound, AM/PM and unlisted descriptions fail rather than guess. This is not unrestricted natural-language understanding or an AI service.

## Next Run, DST and limitations

- Reference must be an absolute ISO `YYYY-MM-DDTHH:mm[:ss[.sss]]Z` or with `±HH:mm`; no naked local datetime, date-only input or implicit current time. Strict calendar validation rejects impossible dates, leap seconds, offset minutes >59, offsets beyond ±14:00 and fractions finer than milliseconds.
- Timezone is a required, initially empty IANA field with searchable suggestions; UTC is used only when selected/entered. The reference offset defines the instant; the separate selected zone defines the schedule’s wall clock. Browser IANA aliases/data and future rules can differ between runtimes.
- Next occurrence is **strictly after** the reference, with five-field seconds fixed to 0 or six-field selected seconds. Output has wall date/time, explicit offset and `[timezone]`; this bracketed display is not claimed to be a bare RFC3339 string. Elapsed duration is exact through reference milliseconds, not wall-clock subtraction.
- Scheduled **gaps are skipped**, never shifted into a different wall time. **Folds consider both instants**, choosing the earliest one after the reference—even when the reference wall time is later than the selected repeated time. This is a matching-instant evaluator, not a promise about every daemon’s DST execution policy.
- Search uses selected calendar dates and UTC offset intervals, not unbounded minute/second iteration. Six-hour probes around each matching date locate transitions to the second; verified wall candidates handle hour/half-hour shifts and skipped dates. The supported IANA-era assumption is that transitions do not occur twice within a single six-hour probe window; arbitrary custom timezone rules are not accepted.
- Reference years, UTC reference instants, selected-zone reference dates and output/search boundary are **1970–2099**. Search is bounded to **eight calendar years**, stopping by 2099. A valid expression such as `0 0 31 FEB *` can return an explicit no-occurrence error. No partially searched or truncated result is labeled success.
- Historical offsets containing seconds, such as pre-1972 Monrovia, error instead of rounding them to a misleading `±HH:mm` output. Timezone data correctness is an external runtime limitation.
- Resource caps: **1,024 characters/expression**, **128/generator field or timezone**, **500/human description**, **64/reference**; outputs are naturally bounded by fixed field/value ranges. Oversized input errors rather than truncates. Required generator fields cannot silently become `*` when cleared.
- Next Run requires Worker support/permissions. Without it, the page reports the missing capability; bounded generation/explanation/validation still work. No real-time polling, job execution, local commands, network validation or scheduler installation occurs.

## Privacy and scope

Inputs and results stay in component/worker memory. There are no schedule payload requests, telemetry, logs, URL/history parameters or storage calls in the Cron processing path. Search is likewise local. Results are React text, never executed HTML or commands. Explicit Copy writes to the OS/browser clipboard; retention there is outside application control. Clear removes application references, not a secure-memory-erasure promise.

Existing global CSS and theme toggle are unchanged; no ad, analytics or Pro abstraction was invented. Scope verification matched **112 protected pre-existing source hashes** and **all 160 non-Cron runtime tool entries**. Shared edits are limited to Cron dispatch/conditional page content, discovery navigation and the station sitemap entry. No SQL, Web, API, Network, Image, Spreadsheet, Markdown, Color, CSS, Git, DevOps, Files, Converter or Developer Math station was implemented. No Git repository/commit/push/deployment.

## Executed checks

Baseline: `git status --short` confirmed no repository; typecheck, **2,676 tests / 34 files** and production build passed. Standalone lint exited 1 for existing missing config. No workspace Next process was running before either build; earlier preview was no longer active.

- `npm run typecheck`: **passed**.
- `npm test`: **2,971 tests / 38 files passed**. New Cron suite: **288 tests** (229 engine, six client, 42 UI, 11 registry/landing). Seven additional cases are discovered by the unchanged all-tool/category breadcrumb matrix.
- Engine tests cover all fields’ values/wildcards/ranges/lists/steps, aliases, boundary/malformed/unsupported syntax, five/six mode, first-error validator and impossible calendars, Vixie day matching, deterministic phrases, minutely/hourly/daily/weekly/monthly/leap/year transitions, strict reference offsets/fractions and timezone differences. DST covers New York gaps/folds (including a reference between repeated instants), Berlin, half-hour Lord Howe and Apia’s skipped date. An independent direct UTC-minute oracle agrees on 48 schedule/zone/reference combinations; no parser matching function is used by that oracle.
- `TZ=America/New_York npm test -- lib/tools/cron/engine.test.ts`: **229 passed**, demonstrating independence from the host default zone.
- UI checks cover all six tools in dark/light DOM attributes, exact fields, example/keyboard submit, complete tab order, exact visible-value Copy (including field cards), Clear/default restoration, errors/retained inputs, oversized input, XSS-safe Unicode rejection, no fetch/XHR/storage/log calls, worker cancellation, clipboard denial and stable-node/ID SSR hydration. jsdom worker transport is synthetic and does not prove browser/CSP behavior.
- `CI=1 npm run lint < /dev/null`: **exit 1 / blocked**, existing absent ESLint config/deprecated `next lint`; no unrelated lint migration.
- `npm run build`: **passed**, **166 prerendered tool URLs / 174 generated pages**, including the Cron landing.
- `node scripts/verify-cron.mjs`: **passed** six production tool pages, exact emitted fields/defaults/labels, metadata/index/canonicals, station search/card markup, homepage/sitemap, **14 navigation links**, **nine page scripts**, **six other-station pages** and the emitted-worker asset. Next may stream lazy forms in hidden Suspense containers; this script checks that emitted form without claiming hydration proof.
- Emitted-worker VM/thread verification executed all six examples plus explicit seconds, deterministic human conversion, invalid/syntax-only validation, Kolkata next time, New York gap/fold, leap-date and fractional strict-next vectors and impossible-calendar errors. This is compiled-code evidence, not live browser Worker or console acceptance.
- New source privacy/unsafe-execution scan passed; no new dependencies. Protected hashes/catalog scope checks passed. Snapshot: `/private/var/folders/69/l4j48t2j7pd9npmrwgw19ldc0000gn/T/opencode/cron-scope-qULOSE/` (temporary local verification data).

## Partial browser check and remaining acceptance

Built-in tab `tab_muutbxbt_5` directly loaded the landing and Next Run. Observations show the real form, titles, labels/notices and stacked 310×444 narrow layout. Dark and light Next Run screenshots and an actual dark→light illustrated toggle change were observed and verified. This is **partial**, not full six-tool/mobile/desktop approval.

A Load example attempt returned `browser_operation_failed`; fresh observation was used instead of automatically repeating it. A theme attempt first encountered expired observation, then succeeded with a fresh one. Scrolling also reported failure; later observation showed a changed scroll position, so no action outcome is inferred from the failed receipt. Actual Copy/Clear/worker result, desktop layouts and live console were not verified.

At 310 px, screenshots show a horizontal page scrollbar and clipped existing header/theme control. Shared header sizing already exceeds that narrow width; global CSS/header were preserved by scope. A full overflow audit at supported mobile widths remains pending; no claim of overflow-free mobile acceptance.

- [ ] All six routes: actual valid/invalid processing, keyboard workflow, exact Copy and complete Clear.
- [ ] Generator seconds activation/default reset; all field notation and unsupported dialect errors.
- [ ] Real Next Run Worker/CSP, timezone suggestions, gap/fold outputs, cancellation and timeout recovery.
- [ ] All tools in light/dark, mobile 320/375/768 px and desktop; long output scrolling, header/page overflow and readable field cards.
- [ ] Landing search/no-results and navigation/refresh/history in browser, not only jsdom/HTTP.
- [ ] Browser console/hydration warnings, clipboard allow/deny and no content payloads in requests/storage/history/logs, using public fixtures only.

Preview: `http://localhost:3000/stations/cron` (also `/tools/cron-generator`). **Stop its server before rebuilding `.next`.** Existing lint/dependency-maintenance gates remain outside this station task.
