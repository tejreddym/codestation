# Date & Time Station

Updated 2026-10-03. This audit supersedes the earlier 16-tool expansion. All **17 specified public tools** now follow exact contracts through `config/date-time-tools.ts`, composed into the existing central `config/tools.ts`. No new dependencies, servers, analytics or advertising providers were added.

## Per-tool audit and corrections

| Public route (`/tools/…`) | Exact inputs | Outputs and corrected behavior |
|---|---|---|
| unix-timestamp-converter | Timestamp, Unit | Date/time, ISO 8601, UTC representation, Local representation. Explicit Seconds/Milliseconds; no timezone input. Old `timestamp-converter` permanently redirects here. |
| unix-timestamp-generator | Date, Time, Timezone | Unix seconds, Unix milliseconds, ISO 8601. Uses the supplied date/time, not a current-clock snapshot. |
| unix-milliseconds-converter | Timestamp in milliseconds | Date/time, ISO 8601, UTC representation, Local representation. Always milliseconds; removed unit/zone selectors. |
| iso-8601-converter | ISO 8601 date/time | Normalized ISO 8601, UTC date/time, Local date/time. Requires an explicit offset; removed source/destination timezone and other outputs. |
| date-to-timestamp | Date, Time, Timezone | Unix seconds, Unix milliseconds, ISO 8601. Separate date/time fields and explicit IANA zone. |
| timestamp-to-date | Timestamp, Unit, Timezone | Date/time, ISO 8601, UTC date/time, Selected timezone date/time, UTC offset. Instant preserved; selected zone changes its representation. |
| timezone-converter | Date, Time, Source timezone, Destination timezone | Source date/time, Destination date/time, both UTC offsets, UTC time. IANA rules at the selected date; no extra timestamp or DST-choice fields. |
| current-time-in-timezone | Timezone | Current date/time, UTC offset, Timezone ID. Refresh time captures a fresh device-clock instant; no extra timestamp outputs. |
| date-difference-calculator | Start date, End date, Start time, End time | Calendar difference, Total days/hours/minutes/seconds. Signed end minus start in the same browser-local context; no timezone input. |
| time-difference-calculator | Start time, End time, Optional start date, Optional end date | Hours, Minutes, Seconds, Total seconds. Without dates, an earlier end automatically crosses midnight once; removed the next-day toggle. With dates, exact signed local elapsed duration. |
| relative-time-generator | Target date/time, Reference date/time | Relative phrase, Exact difference. No inferred current reference, timezone selector or arbitrary unit selector. |
| date-format-converter | Date value, Input format, Output format | Converted date only. Exactly six date-only formats, no arbitrary token format or timezone controls. |
| epoch-converter | Epoch value, Unit | Date/time, ISO 8601, UTC representation, Local representation. Epoch-to-date only; removed in-page reverse conversion. |
| week-number-calculator | Date, Week convention | Week number, Week year, Day of week. ISO 8601 and Sunday-start conventions are distinct. |
| leap-year-checker | Year | Is leap year (Yes/No), Explanation. Removed unrelated year/day totals. |
| business-days-calculator | Start date, End date, Weekend definition, Holidays; conditional custom weekdays | Business days, Calendar days, Weekend days, Excluded holiday count. Added specified weekend choices and explicit holidays; removed endpoint configuration. |
| age-calculator | Birth date, Target date | Age in years/months/days, Total days. No birth time, implicit target, extra output metadata or leap-day policy selector. |

All initial date/time/timezone text is empty. Unit and other contracted selects have visible first-option defaults. Examples match the specific fields, including the supplied Kolkata conversion, Oct 1–10 business range with Oct 2 holiday, and Oct 27, 2004 birth date. Loading an example does not calculate a result or read a clock.

## Shared architecture

- `components/DateTimeStation.tsx` / `.module.css`: exact-contract native date/time controls, searchable IANA input/datalist, conditional weekday checkboxes, stable semantic IDs, associated validation, structured result rows, exact per-row Copy and complete Clear. No Download control. Editing invalidates results; async module loading and clipboard feedback have stale-state guards.
- Existing `CalendarPicker`, `TimePicker`, `DateTimePicker` and their styles/dependencies remain unchanged for other consumers. Public station inputs now prefer native date/time controls as requested. Their display format follows the browser locale; field hints and engine input contract are explicitly YYYY-MM-DD / 24-hour time.
- `lib/tools/date-time/engine.ts` implements the new exact tool contracts and returns only their rows. `types.ts` defines values/results and a deterministic test environment. The existing `lib/tools/date-time-station.ts` remains unchanged and supplies strict Gregorian parsing, Date/Intl IANA resolution, calendar age, ISO weeks and relative formatting.
- Date processing is lazy-loaded on action; no new heavyweight library or worker is needed. Business counts use whole-week arithmetic plus bounded explicit holidays, not a loop over every date in a long range.
- Date to Timestamp and Timestamp to Date remain reciprocal public routes with paired metadata and real links. Keyed station state resets controls, examples, errors and output on direction changes. The server route shell supplies direction-specific title, description, canonical/index directives, H1, breadcrumb, factual purpose/usage and related links.

## Parsing, timezone and numerical policies

- Proleptic Gregorian years **0001–9999**, millisecond precision, no leap seconds. Impossible dates/times fail rather than roll over. Calendar-only tools use date arithmetic independent of timezone/DST.
- Timestamp units are explicit, never guessed. Zero and negative values are supported. Milliseconds must be integral decimal text; seconds accept up to three fractional digits. BigInt arithmetic parses decimal seconds exactly before conversion to Date milliseconds. Extra precision, exponent notation, separators and out-of-range values fail; no silent rounding. Generated Unix seconds retain millisecond fractions, including `-0.001`.
- ISO converter accepts extended `YYYY-MM-DDTHH:mm[:ss[.SSS]]` with `Z` or `±HH:mm`. Date-only, missing offset, unknown `-00:00`, leap seconds and malformed/impossible input fail. Basic, ordinal and ISO week-date input forms are not supported. Normalized ISO is UTC and preserves the instant.
- Required timezone fields start empty. Suggestions include UTC and common zones, extended on mount with `Intl.supportedValuesOf('timeZone')` when available; typed supported names/aliases are also accepted. `Intl.DateTimeFormat` validates and canonicalizes them. Browser aliases may be displayed under a different canonical spelling (for example Kolkata/Calcutta).
- Every displayed zoned representation includes date/time, IANA identifier and UTC offset for that instant. Historical offsets can include seconds. Runtime IANA data supplies DST and historical rules; no application offset table is hardcoded. Database freshness depends on the browser/OS.
- Nonexistent local wall times and repeated rollback times are **both rejected**. No silent earlier/later choice or extra disambiguation input. Error guidance suggests another unambiguous time or the ISO converter with an explicit offset.
- Local representation and tools without timezone fields use the browser-configured IANA zone, disclosed in notices. Near supported year boundaries, a zoned representation outside years 0001–9999 is rejected even if the UTC instant is in range.

## Calendar conventions and limits

- Date Difference requires all four date/time fields. Calendar difference uses clamped year/month anniversaries and remaining wall-clock days/time; elapsed totals use actual local instants. A displayed calendar day can correspond to 23 or 25 elapsed hours around DST. Reversed ranges retain a negative sign.
- Time Difference accepts both optional dates or neither, not one alone. Undated times are wall-clock arithmetic with at most one midnight crossing; equal times mean zero. Dated values use browser-local IANA rules and signed elapsed duration. Hours are total whole hours, Minutes/Seconds are remainder components, with signs applied consistently.
- Relative Time always requires the supplied reference. Offset-bearing inputs identify absolute instants; offset-free values explicitly use browser-local rules with gap/fold rejection. Same instant displays “now.” Phrases round automatically; months/quarters/years approximate 30/91/365 elapsed days. Exact difference is signed seconds retaining milliseconds.
- Format Converter supports only YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD, DD-MM-YYYY and MM-DD-YYYY, in both directions. Numeric field widths and separators must match. `03/04/2026` has meaning only through the selected input format; no locale inference.
- ISO weeks start Monday and week 1 contains January 4 / the first Thursday. Sunday-start uses the calendar year, week 1 contains January 1 and each following Sunday increments the number. Only ISO week-year can differ from calendar year near New Year.
- Business Days includes **both endpoints**, rejects reversed dates, and counts Saturdays+Sundays, Fridays+Saturdays, Sunday only, or selected custom weekdays. Empty custom selection excludes no weekends. Explicit holiday lists are comma/newline-separated YYYY-MM-DD, deduplicated; only in-range non-weekend holidays add to excluded holiday count. No country holidays are fetched or inferred. Calendar days = business days + weekend days + excluded holidays.
- Holiday input is limited to 10,000 characters and 1,000 parsed entries. Other inputs are bounded by field-specific validation. Oversize values error rather than being sliced. Counting the full supported date range is practical via week arithmetic.
- Age requires an explicit target date; no automatic “Today” value. Birth dates after target **or after browser-local today** fail. Calendar anniversaries clamp to month end; February 29 uses February 28 in non-leap years. This is the fixed, disclosed convention, not a claim about legal age rules. Total days are elapsed calendar days, independent of DST.
- Device clock is read only for Current Time and Age's future-birth validation. Current Time refreshes only on action and is not server-synchronized. None of the other tools substitute the current date/time.

## Privacy and accessibility

No user dates, timestamps, timezone selections, holidays or calculated results are sent to requests, logs, analytics, URLs, localStorage or sessionStorage by this station. Results are rendered as text. Native APIs and bounded parsers are used; no eval, Function or arbitrary code execution. Copy writes only on the user's action; clipboard retention is controlled by browser/OS.

No AdSlot/analytics/Pro/account abstraction was present to reuse, so none was invented. Existing theme storage is unrelated and unchanged. Global design tokens, illustrated toggle and all other station implementations remain intact.

Every input has a visible label, keyboard access, focus styling and error association. Custom weekend checkboxes are named and grouped; timezone inputs accept keyboard typing and suggestions. Outputs use individual labels and focusable, horizontally scrollable monospace values. Mobile grids stack, controls retain touch sizing, and long output remains accessible without page overflow. These design rules are tested statically; live layout still needs acceptance.

## Executed verification

Baseline before changes: no Git repository (`git status` failed as expected); typecheck, **1,925 tests / 28 files** and production build passed. Both workspace Next servers were stopped before building.

- `npm run typecheck`: passed after final edits.
- `npm test`: **2,141 tests / 30 files passed**. Updated exact-contract component/hydration/discovery tests, added 158 engine tests and 20 route-contract tests. Date-specific suite has 277 tests across five files; existing helper/picker tests remain.
- `TZ=America/New_York npm test -- lib/tools/date-time/engine.test.ts lib/tools/date-time-station.test.ts`: **195 tests / 2 files passed**.
- Coverage includes all 17 examples/exact outputs, empty/invalid inputs, leap/year-boundary fixtures, 36 format combinations, explicit units and negative/zero/extreme timestamps, positive/negative/missing ISO offsets, DST gaps/folds, half-hour transitions, skipped civil dates, local elapsed differences, midnight rollover, all weekend modes/holiday overlaps, age anniversaries and current-clock refresh.
- UI workflows cover every tool in both dark/light DOM themes, keyboard actions, exact Copy/Clear, associated errors, direction-state reset, no input network/storage/log calls, custom-weekend controls and clipboard denial. Seventeen SSR→hydrate tests retain stable server nodes/IDs and report no hydration errors. The test harness explicitly enables React act support and awaits lazy engine results; an initial timing-sensitive test was fixed and the full suite rerun successfully.
- `CI=1 npm run lint < /dev/null`: **exit 1 / blocked** by absent ESLint configuration and deprecated `next lint` prompt. No standalone lint pass claimed; configuration/dependency remediation remains separate.
- `npm run build`: passed, **160 prerendered tool URLs / 167 total generated pages**.
- `node scripts/verify-date-time.mjs`: passed **17 public pages**, exact SSR controls/defaults, metadata, reciprocal direction links, **20 navigation links**, **9 page scripts**, **one 308 legacy redirect**, and **five other-station routes**. The emitted engine executed all 17 examples plus DST gap/fold and exact negative-timestamp vectors in an isolated VM; engine asset served successfully. This is production-bundle evidence, not browser acceptance.
- Scope: **91 protected pre-existing source hashes** matched baseline. All **143 non-Date/Time registry entries** matched the saved runtime catalog. Shared calendar/clock controls, existing helper library, global theme and other stations unchanged. No dependencies added.

Scope snapshot (local verification data): `/private/var/folders/69/l4j48t2j7pd9npmrwgw19ldc0000gn/T/opencode/date-contract-fRrV13/`.

## Real-browser acceptance — pending

The existing browser tab requires selecting it in the conversation's browser panel to review website access. Navigation and a fresh observation returned `needs_attention`; no live browser acceptance was possible. jsdom/HTTP/VM checks are not proof of visual themes/mobile layouts, actual history, clipboard permissions or live console behavior.

For **each of the 17 routes**, once browser access is approved:

- [ ] Direct load/refresh with correct URL, title, breadcrumb, labels, examples and metadata; no console/hydration errors.
- [ ] Keyboard-only entry, IANA suggestions, select/checkbox controls, calculate/refresh, exact Copy, Clear and readable errors/focus.
- [ ] Light/dark readability and unchanged animated toggle; 320/375/768 px and desktop layout, native date/time controls, touch targets and internal result scrolling.
- [ ] Date↔timestamp links, browser Back/Forward and refresh: all direction-specific controls/content reset correctly, without input values in URLs/history state.
- [ ] DST gap/fold errors, selected-zone offsets, explicit units, zero/negative timestamp, strict ISO offset requirement and native date input behavior.
- [ ] Current Time changes on refresh; Relative Time never substitutes now; business weekend/holiday handling and age future-date validation.
- [ ] With public fixtures, inspect network/storage/console for absence of date, holiday, timezone or result payloads; test clipboard allow/deny behavior.

Preview: `http://localhost:3000/tools/date-to-timestamp`. Stop its production server before rebuilding `.next`.
