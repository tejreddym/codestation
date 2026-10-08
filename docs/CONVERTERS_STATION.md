# Converters Station

The Converters Station is a discovery surface at `/stations/converters`. It groups implemented conversion capabilities without copying tools or creating alias URLs. Every card resolves to the existing canonical `/tools/<slug>` identity, so global search, favorites, counts, breadcrumbs, and sitemap entries remain based on one tool registry.

## Discovery categories

Categories are derived from `config/conversion-capabilities.ts` and `config/converter-tools.ts`:

- Images
- Spreadsheets
- Structured Data
- Markdown & HTML
- Colors
- Units & Temperature
- Numbers
- Encoding
- Other Supported Conversions

Validators, generators, hashes, inspectors, request testers, and other specialized tools are not included merely because they manipulate text. Encoding is shown separately from format conversion.

## Canonical existing tools

Image, Spreadsheet, JSON & Data, Markdown, Color & CSS, Encoding, Text, SQL & Database, and API capabilities are linked from their existing routes. Ownership remains their original station/category; Converters is an additional discovery relationship, not a second registration. Numeric tools are owned by `Converters` and use stable canonical routes:

- `/tools/unit-converter`
- `/tools/temperature-converter`
- `/tools/number-base-converter`

These numeric tools do not generate unit-pair or base-pair URLs. Their source and target controls stay on one canonical route, preserve source text on target changes, invalidate stale results, and support an explicit Swap action only after a valid result exists.

## Numeric semantics

`config/unit-tools.ts`, `config/temperature-tools.ts`, and `config/number-base-tools.ts` are the authoritative catalogs. Unit factors are finite decimal constants normalized through a category base; calculations use bounded JavaScript finite-number arithmetic and are approximate at ordinary floating-point limits, not arbitrary-precision decimal math. The UI displays up to 15 significant digits, normalizes negative zero, and rejects non-finite, ambiguous grouping, and overlarge values. Calculation precision and display text are separate, so changing a target does not chain through displayed rounding.

Unit categories are length, mass, area, volume, speed, and digital storage. Length uses international inch/foot/yard/mile definitions. Mass uses avoirdupois ounce/pound. Volume distinguishes US liquid gallon/fluid ounce from Imperial gallon/fluid ounce. Digital units distinguish bit/byte, decimal k/M/G/T prefixes, and binary Ki/Mi/Gi/Tebi prefixes.

Temperature uses Celsius, Fahrenheit, and Kelvin absolute scales. Values below absolute zero are rejected; this tool does not convert temperature differences. Number bases 2–36 use exact `BigInt`, case-insensitive digits, lowercase output, signed mathematical notation, leading-zero normalization, and a 4,096-character limit. `0b`, `0o`, `0d`, and `0x` are accepted only when matching bases 2, 8, 10, and 16; prefixes are never inferred for other bases.

Definitions were checked against [BIPM's SI Brochure](https://www.bipm.org/en/publications/si-brochure) and [NIST SP 811](https://www.nist.gov/pml/special-publication-811), including NIST's conversion-factor appendix. Knots use the international nautical mile definition (1,852 m) through the speed factor.

## Privacy and verification

Numeric values and results stay in component memory. No values enter URLs, history state, storage, analytics, or network requests. The landing page lazy-loads only discovery metadata; numeric engines are imported by the numeric tool boundary.

**AUTOMATED VERIFIED:** numeric engine tests (**30 tests**), discovery/UI/regression coverage, typecheck, full suite (**5,282 tests / 83 files**), lint with existing warnings, production build, and fresh HTTP 200 smoke for the Converters landing, all three numeric routes, and representative existing converter routes.

**LIVE-BROWSER VERIFIED:** record only direct browser observations made after starting the development server in the same session.

**NOT VERIFIED:** the built-in browser timed out with no retained tab, so clipboard bytes, responsive/theme visuals, direct browser history/refresh, console, network panel, and live calculation interactions remain unverified. HTTP smoke is not browser interaction proof.
