# TODO

Active, uncompleted items only. Shipped milestones are tracked in [`CHANGELOG.md`](CHANGELOG.md) and historical audits in [`docs/archive/HISTORICAL_LOGS.md`](docs/archive/HISTORICAL_LOGS.md).

## Real-Browser & Cross-Browser Verification

- [ ] **Real WebMCP host execution:** Verify live in-page execution against an active browser supporting `document.modelContext`.
- [ ] **Cross-browser codecs & WebCodecs:** Verify `video-trimmer` and `video-thumbnail-generator` in Safari and Firefox across MP4/WebM fixtures.
- [ ] **OpenNext Worker build verification:** Confirm Cloudflare OpenNext bundle serves `public/pdfjs/`, `public/THIRD_PARTY_NOTICES.md`, and lazy `pdfjs-dist` / video chunks in a Worker preview (`npm run preview` + `npm run cf:verify`).
- [ ] **Global UX & Accessibility E2E:** Test OS reduced motion, browser zoom, physical touch targets, screen-reader flows, clipboard fallbacks, offline starter pack install, and completed ZIP download bytes in live browsers.
- [ ] **Station live-browser checklists:** Finish live-browser desktop/mobile, light/dark, keyboard, console/CSP, and network-isolation acceptance checks documented in:
  - [`docs/CONVERTERS_STATION.md`](docs/CONVERTERS_STATION.md) (discovery, numeric converters)
  - [`docs/COLOR_CSS_STATION.md`](docs/COLOR_CSS_STATION.md)
  - [`docs/SMART_CONVERTER_STANDARD.md`](docs/SMART_CONVERTER_STANDARD.md) & [`docs/SMART_CONVERTER_AUDIT.md`](docs/SMART_CONVERTER_AUDIT.md) (Image/Spreadsheet/JSON/Markdown session transfer, Back/Forward)
  - [`docs/IMAGE_STATION.md`](docs/IMAGE_STATION.md), [`docs/SPREADSHEET_STATION.md`](docs/SPREADSHEET_STATION.md), [`docs/MARKDOWN_STATION.md`](docs/MARKDOWN_STATION.md)
  - [`docs/API_STATION.md`](docs/API_STATION.md) (explicit safe tester CORS/cancel/no-retry flows)
  - [`docs/WEB_STATION.md`](docs/WEB_STATION.md), [`docs/SQL_DATABASE_STATION.md`](docs/SQL_DATABASE_STATION.md), [`docs/CRON_STATION.md`](docs/CRON_STATION.md) (also address shared 310 px header overflow)
  - [`docs/TEXT_STATION.md`](docs/TEXT_STATION.md), [`docs/DATE_TIME_STATION.md`](docs/DATE_TIME_STATION.md), [`docs/REGEX_STATION.md`](docs/REGEX_STATION.md), [`docs/SECURITY_STATION.md`](docs/SECURITY_STATION.md), [`docs/ENCODING_STATION.md`](docs/ENCODING_STATION.md), [`docs/JSON_DATA_STATION.md`](docs/JSON_DATA_STATION.md)

## Legal, Compliance & Owner Decisions

- [ ] **Provisional legal pages (`/privacy`, `/terms`, `/licenses`):** Confirm operator/legal entity, verified contact info, hosting/retention details, governing jurisdiction, and illustrated theme-toggle asset provenance before treating legal copy as final.
- [ ] **Adsterra production review:** Update public privacy/consent handling, confirm regional compliance and Adsterra inventory settings before enabling any `NEXT_PUBLIC_ADS_*` flags in production (see [`docs/ADVERTISING.md`](docs/ADVERTISING.md)).
- [ ] **Verify runtime `SITE_INDEXING` on Cloudflare Workers:** Ensure Cloudflare production Workers runtime variable `SITE_INDEXING=index` matches desired public crawlability (`robots.txt` / `sitemap.xml`).

## Maintenance & Testing Debt

- [ ] **Production dependency advisories (`npm audit --omit=dev`):** Plan and separately test upgrades for Next/PostCSS, `exceljs`/`uuid`, and OpenNext/Wrangler advisories (do not run `npm audit fix --force`).
- [ ] **Browser-level smoke tests:** Add browser-level automated checks for clipboard fallbacks, Web Crypto/file hashing network isolation, `atob`/`btoa`/Encoding fallbacks, responsive controls, Regex worker timeout recovery, and accessibility smoke coverage.
- [ ] **Station architecture cleanup:** Continue replacing any legacy workbench paths with typed station-specific handlers (`lib/engine/`) and add station-level examples/related-tool links where sparse.

## Future Product Candidates (When Explicitly Scoped)

- [ ] Expand Productivity / Business tools if prioritized (e.g., `quote-generator`, `receipt-generator`, `timesheet-calculator`) and expand connected workflow source formats based on user feedback.
