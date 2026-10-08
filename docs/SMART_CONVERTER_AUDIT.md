# Smart Converter Audit — 2026-10-06

| Station | Outcome | Changes or reason | Limitation |
|---|---|---|---|
| Image | Upgraded | Capability registry, validated source reconciliation, Output Format controls and memory-only File sessions for raster/SVG routes. | Native AVIF encoding remains unavailable; live route-boundary/download checks open. |
| Spreadsheet | Upgraded | XLSX/CSV/TSV/JSON capabilities, Output Format controls, memory-only source/file session and selected-sheet preservation path. | Current engines do not provide every cross-family text mapping; live worker/download checks open. |
| JSON & Data | Upgraded | Genuine JSON/YAML/CSV/XML/TOML capabilities, explicit route-backed target selection and text session preservation. | Ambiguous text is not auto-detected; structural mappings retain existing limitations. |
| Markdown | Upgraded | Markdown/HTML capabilities, route-backed target control and memory-only text session. | Markdown/HTML reverse semantics require an explicitly matching source route; live checks open. |
| Encoding | Already compliant | Existing reciprocal encode/decode routes remain specialized; shared registry records meaningful pairs only. | No generic encoding dropdown is introduced. |
| Security & Crypto | Intentionally unchanged | Hashes and cryptographic operations are not reversible format conversions. | No converter capability applies. |
| Regex | Intentionally unchanged | Regex operations are transformations/tests, not format conversion. | No converter capability applies. |
| Date & Time | Already compliant | Existing explicit date/timestamp direction and unit/timezone contracts remain separate. | No ambiguous format dropdown is introduced. |
| Text | Already compliant | Existing tab/space and line-ending directional routes are recorded as real text capabilities. | Specialized text tools remain separate. |
| Cron | Intentionally unchanged | Schedule parsing/evaluation is specialized and not a reversible converter. | No converter capability applies. |
| SQL & Database | Already compliant | Existing supported SQL INSERT mappings are recorded with subset/dialect limitations. | No universal SQL dialect converter is claimed. |
| Web | Intentionally unchanged | URL/parser/reference/generator tools do not convert compatible document formats. | Favicon remains a specialized image route. |
| API | Already compliant | cURL↔Fetch representation pair is recorded; existing static subset and no-execution safety remain. | No generic request-format dropdown or hidden network action. |
| Color & CSS | Upgraded | Seven scoped tools, shared sRGB engine, color capability entries and converter session integration. | Only sRGB HEX/RGB/HSL; live browser acceptance open. |
| Converters | Upgraded | Added derived `/stations/converters` discovery, canonical identity deduplication, and stable-route Unit, Temperature, and Number Base capabilities. | Existing conversion engines remain owned by their original stations; live browser checks remain open. |

## Evidence

Automated registry/session and affected station suites passed after the upgrade. Converters adds 30 numeric engine tests plus discovery/UI/regression coverage. Final typecheck, **5,282 tests / 83 files**, lint with warnings only, and production build passed. The live browser did not yet provide a fresh Converters interaction session; no inspected clipboard result, responsive/theme, console, or network result is claimed. No source content was persisted or sent remotely.
