# TODO

Active, uncompleted items only. Shipped milestones are tracked in [`CHANGELOG.md`](CHANGELOG.md) and historical audits in [`docs/archive/HISTORICAL_LOGS.md`](docs/archive/HISTORICAL_LOGS.md).

## Real-Browser & Cross-Browser Verification

- [ ] **Real WebMCP host execution:** Verify live in-page execution against an active browser supporting `document.modelContext`.
- [x] **Cross-browser codecs & WebCodecs:** Automated `video-trimmer`, `video-thumbnail-generator`, `audio-converter`, and `audio-trimmer` capability detection, WAV transcode, invalid-media fallback, and runtime error checks across Chromium, Firefox, and WebKit via `tests/e2e/video-codecs.spec.ts` and CI `cross-browser-media`.
- [x] **OpenNext Worker build verification:** Automated post-upload Cloudflare preview verification (`npm run cf:verify`) inside `.github/workflows/preview-deploy.yml`.
- [ ] **Global UX & Accessibility E2E:** Remaining OS reduced-motion, browser zoom, physical touch targets, screen-reader flows, and ZIP download bytes verification (clipboard copy, `#state=` permalinks, offline starter pack install, `@axe-core/playwright` WCAG 2.1 AA, 390px mobile overflow, and real JSON/YAML/TS/PNG/PDF download bytes now automated in CI via Playwright).
- [x] **Automated all-station & top-tool E2E matrix (`tests/e2e/` + CI):** All 30 station landing pages (HTTP 200, 0 console/page errors, 390px horizontal overflow, WCAG 2.1 AA axe), ~34 high-traffic tools across 16 categories, light/dark themes, clipboard copy, `#state=` permalinks, `/embed/[slug]` framing, and non-empty file downloads are verified on every CI push/PR.
- [ ] **Station live-browser manual deep-dive checklists:** Remaining Safari/Firefox and multi-step visual edge checks documented in:
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
- [x] **Verify runtime `SITE_INDEXING` on Cloudflare Workers:** Automated daily production health check in `.github/workflows/prod-health.yml` verifying `https://codestation.in/robots.txt` returns `200` + `Allow: /`, `/sitemap.xml` returns `200` valid XML, and `/` returns `200`.

## Maintenance & Testing Debt

- [ ] **Production dependency advisories (`npm audit --omit=dev`):** Plan and separately test upgrades for Next/PostCSS, `exceljs`/`uuid`, and OpenNext/Wrangler advisories (do not run `npm audit fix --force`).
- [x] **Browser-level smoke & E2E matrix:** Covered automated checks for clipboard copy, Web Crypto SHA-256, Base64/URL/JWT encoding, responsive 390px overflow, WCAG 2.1 AA axe audits, offline starter pack PWA, `#state=` permalinks, `/embed/[slug]`, and real file download bytes (remaining niche edge cases: Regex worker timeout recovery in live browser).
- [ ] **Station architecture cleanup:** Continue replacing any legacy workbench paths with typed station-specific handlers (`lib/engine/`) and add station-level examples/related-tool links where sparse.

## Future Product Candidates (When Explicitly Scoped)

- [ ] Expand Productivity / Business tools if prioritized (e.g., `quote-generator`, `receipt-generator`, `timesheet-calculator`) and expand connected workflow source formats based on user feedback.
