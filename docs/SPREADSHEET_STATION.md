# Spreadsheet Station

20 browser-local tools at `/stations/spreadsheet`: CSV/TSV/JSON↔XLSX, safe HTML/JSON/text export, viewer/inspector, sheet extraction, transpose/reorder/filter/deduplicate/analyze/empty cleanup, merge/split and split-by-column.

CSV/TSV/JSON/XLSX directional pages participate in the shared capability registry. Compatible source files/text are held only in the root memory session while a registered target route changes; selected workbook sheets remain local state and target choices never claim unsupported mappings.

`exceljs@4.4.0` is dynamically imported inside a local worker. `fflate@0.8.3` validates ZIP directory declarations and bounded inflation before ExcelJS receives bytes. Files are capped at16MiB; inflated archives64MiB; workbooks64 sheets,20k rows,512 columns and250k cells. Encrypted, legacy, macro/ActiveX/embedded-object, external-workbook-link and malformed archives reject. No uploads, server fallback, storage, logs or cell analytics.

The first row is the header row for CSV/JSON conversion and spreadsheet object conversion. Duplicate/blank headers receive deterministic names. Nested JSON values serialize as JSON strings. Text exports protect strings beginning with `=`, `+`, `-` or `@` with an apostrophe; native numeric negatives remain numbers. Formulas and cached values can be retained, but Code Station does not recalculate formulas or rewrite references after transformations. Unsupported workbook metadata (including some charts, merges, tables, validations, comments and named ranges) is not claimed as preserved; hyperlinks are flattened to displayed text.

Viewer previews are bounded (100 rows/50 columns), table cells are inert text, and sheet selectors appear only after local inspection. All outputs are genuine XLSX/CSV/TSV/HTML/JSON values; downloads use actual Blob bytes. Edits, Clear, unmount and cancellation abort worker work and revoke download URLs.

## Verification

Automated gate: typecheck passed; **240 focused tests / 5 files** passed, including genuine XLSX roundtrips, multi-sheet and formulas/caches, duplicate headers, Unicode, CSV/TSV escaping, filters, deduplication, transformations, merge collisions, split naming, malformed/bounded ZIPs, worker cancellation and UI controls. Live browser observed the landing and CSV-to-Excel controls at310×444; workbook selection, worker processing, genuine downloads, viewer switching, theme/responsive/console/CSP are **NOT VERIFIED**.

Final repository verification also passed `npm test` (**5,205 tests / 72 files**), `npm run typecheck`, and `npm run build`. A production HTTP smoke check returned200 for both the station and representative spreadsheet routes. This HTTP check is not live browser acceptance.
