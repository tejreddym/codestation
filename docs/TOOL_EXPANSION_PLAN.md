# Tool Expansion Plan — 17 Candidates

Status: Batches 1–3 delivered (2026-11-16). Batch 3 also fixed FIN-D1, FIN-D2 and FIN-D3 from Batch 1. Batches 4–5 are planned, not started. This plan is based on a codebase audit of the registry, station,
PDF, audio, image and worker layers; every claim below cites the file that
controls it.

## 1. Decisions

| Decision | Rationale |
| --- | --- |
| Build the Finance & Calculators station first | Pure client-side arithmetic, no new dependency, no file handling, and one station scaffold reused four times. |
| Defer Video Trimmer and Video to GIF | The only broad engine is the ~30 MB GPL `@ffmpeg/core`, which exceeds Cloudflare's 25 MiB per-file static-asset limit and needs COOP/COEP for multithreading. WebCodecs + Mediabunny is a research spike with partial Safari support, not a station increment. |
| Defer PDF Compressor (or ship only a labelled “rasterize & downscale” variant) | `pdf-lib` cannot decode or recompress embedded images; real compression needs a GPL/AGPL engine (Ghostscript) or rasterizing every page, which loses text, links and forms. A tool that silently destroys text is not shippable under the current quality bar. |
| Defer OCR for scanned PDFs | Introduces model downloads and a different privacy disclosure. Out of scope until explicitly requested. |
| PDF text tool gets the slug `pdf-to-text` | `pdf-text-extractor` is already the route of the existing “PDF Metadata & Info” tool. Existing routes must not change, so the new tool uses a new identity. |
| No new dependency in Batch 1 | `pdfjs-dist` is introduced only in Batch 2, lazily, with self-hosted worker, cmaps and fonts. |

## 2. Audit of the existing project

- **Stack.** Next.js 15 App Router, React 19, strict TypeScript, CSS Modules,
  Vitest 3.2, OpenNext on Cloudflare Workers.
- **Registry chain.** `config/<category>-tools.ts` → `config/tools.ts` →
  `config/stations.ts` → `app/tools/[slug]/page.tsx` → `components/ToolWorkspace.tsx`.
  Every tool is a `LocalDefinition` from `config/local-contract.ts`; category
  files export an id tuple, an id union, the definitions and an `isXToolId`
  guard.
- **Routes and SEO are derived.** `app/tools/[slug]/page.tsx` generates
  `generateStaticParams`, metadata, three JSON-LD schemas (SoftwareApplication,
  HowTo, FAQPage), WebMCP data attributes and the related-tool block from the
  registry. `app/sitemap.ts` and `lib/tool-search.ts` are automatic.
- **Station fallback trap.** `app/tools/[slug]/page.tsx` links to
  `getStationByName(tool.category)?.route ?? "/stations/image"`. A category that
  is missing from `implementedStationNames` sends its tools to the Image station.
- **UI system.** `docs/UI_SYSTEM.md`; tokens in `app/styles/tokens.css`;
  primitives in `components/ui/` (ToolLayout, Panel, Field, controls, Button,
  OutputPanel, DataTable, Tabs, Callout, StatusLine, PrivacyNote, DropZone,
  CanvasStage, useCopy, downloadBlob).
- **Worker strategy.** Workers exist for cron, encoding, JSON/data, regex,
  security, spreadsheet, SQL and text. PDF, audio and image processing run on
  the main thread; PDF has no progress or cancel.
- **ZIP and downloads.** `fflate` (MIT) is already installed; `downloadBlob`
  revokes the object URL immediately. Multi-file outputs must revoke every URL.
- **Privacy.** Per-station notices in `components/StationLanding.tsx`, per-tool
  notices in the contract, and a generic page paragraph. New file tools need
  explicit “no upload / no OCR / rasterized” copy.
- **WebMCP.** Every tool registers automatically, but execution requires a case
  in `lib/webmcp/dispatcher.ts`; the default case is a non-executable notice.
  The stdio MCP server keeps a separate static list.
- **Counts that will break.** `tools.length` 380 and 30 categories in
  `lib/engine/__tests__/e2e/contract.e2e.test.ts`; 30 stations in
  `tests/engine/registryContract.test.ts`, `tests/e2e-homepage-perf.test.ts`,
  `components/StationLanding.test.tsx`; per-station counts in
  `config/*-tools.test.tsx`; “370+ … 30 stations” copy in `config/site.ts`,
  `components/HomeSearch.tsx`, `components/DocsRepo.tsx`, `app/docs/page.tsx`,
  `lib/webmcp/registry.ts`, `docs/WEBMCP.md`, `docs/UI_SYSTEM.md`,
  `PROJECT_STATUS.md`.
- **Metadata weakness.** `localDefinition` builds a formulaic description,
  keywords from name words only, and related tools only from `pairedTool`.
  Finance tools need hand-written descriptions, synonyms and related tools.

## 3. Candidate audit

| # | Candidate | Status | Closest existing / reuse | Effort | Decision |
| --- | --- | --- | --- | --- | --- |
| 1 | PDF Compressor | New | `pdf-lib` only | L | Deferred (see §1) |
| 2 | PDF Text Extractor | New, slug taken | pdfjs + OutputPanel + Tabs | M | Batch 2 — delivered as `pdf-to-text` |
| 3 | PDF to Images | New | pdfjs + CanvasStage + fflate | M | Batch 2 — delivered |
| 4 | PDF Page Reorderer | New | pdf-lib `copyPages` + thumbnail grid | M | Batch 2 — delivered as `pdf-reorder-pages` |
| 5 | Audio Converter | New | `audio-trimmer`, Web Audio | M/L | Batch 4 — delivered as `audio-converter` |
| 6 | Audio Compressor | New | `audio-trimmer`, OfflineAudioContext | M | Batch 4 — delivered as `audio-compressor` |
| 7 | Audio Merger | New | `audio-trimmer`, OfflineAudioContext | M | Batch 4 — delivered as `audio-merger` |
| 8 | Video Trimmer | New | none | L | Deferred |
| 9 | Video to GIF | New | none | L | Deferred |
| 10 | Video Thumbnail Generator | New | canvas + download pattern | S/M | Batch 3 — delivered |
| 11 | EMI Calculator | New | form + DataTable | S | **Batch 1** |
| 12 | Loan Prepayment Calculator | New | form + DataTable | S/M | **Batch 1** |
| 13 | GST Calculator (India) | New | form + DataTable | S | **Batch 1** |
| 14 | SIP Calculator | New | form + DataTable | S | **Batch 1** |
| 15 | Resume Builder | New | Policy print pattern | L | Batch 5 (needs print surface) |
| 16 | Invoice Generator | New | Policy print pattern | M/L | Batch 5 (needs line-item editor) |
| 17 | Pomodoro Timer | New | Panel + StatusLine + ProgressBar | S | Batch 3 — delivered |

## 4. Build order

**Batch 1 — Finance & Calculators (delivered).** EMI, Loan Prepayment, GST,
SIP. New station `finance-calculators`. Dependencies: none. Shared pieces:
ToolLayout, Panel, Field, controls, DataTable, OutputPanel, Callout,
PrivacyNote, downloadBlob. Risks: rounding and assumption disclosure, GST rate
accuracy. Acceptance: see §8.

**Batch 2 — PDF (delivered).** `pdfjs-dist@6.5.438` (Apache-2.0), installed as
an exact runtime pin and imported only through `lib/tools/pdf/pdfjs.ts` inside
async calls. The worker, cmaps and standard fonts are copied from the package
into gitignored `public/pdfjs/` by `scripts/copy-pdfjs-assets.mjs` (wired to
`postinstall` and the start of `build`); no CDN is used. Delivered
`pdf-to-text` (per-page extraction, page selection, search counts, TXT
download, no-text page warnings, no OCR), `pdf-to-images` (72/150/300 DPI,
PNG/JPEG, sequential render with working cancel, per-page downloads, ZIP via
fflate, object-URL cleanup) and `pdf-reorder-pages` (thumbnails, drag and
keyboard reordering with focus retention, remove/reset, export verified by
reopening). Shared pieces added: `ProgressBar` and pure helpers in
`lib/tools/pdf/` for ranges, text assembly, filenames and reorder mapping.
PDF station owned 12 tools / 375 registry tools afterwards.

**Batch 3 — Media and productivity quick wins (delivered).** Delivered
`video-thumbnail-generator` in the Image station (file validation, metadata,
playhead and 1–12 evenly spaced frame capture, PNG/JPEG quality, Original/
1920/1280/640 max width with a 4096 px hard clamp, sequential ProgressBar and
Cancel, per-frame downloads and a store-mode fflate ZIP, full object-URL
revocation; browser codec dependent and no audio) and the new Productivity
station with `pomodoro-timer` (focus/short/long 1–120 minutes, 2–8 sessions,
optional auto-start, opt-in Web Audio beep, absolute-time countdown resynced on
visibility change, Start/Pause/Resume/Reset/Skip, no storage, notifications or
title changes). Both need no dependency. Also fixed FIN-D1 (manual SEO title
suffix removed), FIN-D2 (live copy now 377 tools / 30 stations, 370+ tools) and
FIN-D3 (oversized finance inputs fail field validation with `aria-invalid`).
Final registry: 380 tools / 30 categories / 30 stations.

**Batch 4 — Audio (delivered).** Added `audio-compressor` (offline
DynamicsCompressorNode, threshold/ratio/attack/release/knee/makeup gain,
optional −1 dBFS peak normalisation, measured input/output peak and RMS,
gain reduction as an RMS delta, 16-bit PCM WAV), `audio-merger` (two or more
files in listed order, Move up/down with focus retention, remove/clear,
0–5 s gaps, highest-sample-rate two-channel normalisation, 30-minute cap,
WAV) and `audio-converter` (WAV via the existing encoder; WebM/Opus rendered
through OfflineAudioContext then recorded with MediaRecorder at 96/128/192 kbps,
real-time progress and Cancel). No dependency was added; MP3 is explicitly
unavailable, unsupported WebM is disabled with a visible message, and no
format is silently changed. Audio tools dispatch as `manual-file-required`.
Final registry: 380 tools / 30 categories / 30 stations, Audio owns 4.

**Batch 5 — Productivity.** Resume and Invoice first need a shared print
document surface and a repeatable line-item editor, then the two tools.

## 5. Design-system fit

Reused directly: ToolLayout (`form`), Panel, Field/Hint, TextInput, Select,
Checkbox, RangeInput, DataTable, OutputPanel, Callout, StatusLine, PrivacyNote,
Button, useCopy, downloadBlob.

Genuinely missing, to be added only when its batch starts:

| Piece | Needed by |
| --- | --- |
| Sortable thumbnail grid | PDF reorder, PDF-to-images preview — delivered as a local grid in `PdfReorderTool` (Batch 2); not promoted to `components/ui` yet |
| Dual-handle timeline | Audio/video trimming |
| Progress bar primitive | Delivered as `components/ui/ProgressBar.tsx` in Batch 2 |
| Chart primitive (optional) | Finance projections; tables are sufficient for batch 1 |
| Print document surface | Resume, invoice |
| Repeatable line-item editor | Invoice, resume sections |

## 6. Architecture

- One category file `config/finance-tools.ts` with the id tuple, union,
  definitions and `isFinanceToolId`.
- Pure calculation logic in `lib/tools/finance/` (no React), one module per
  calculator, each returning a typed result with the schedule as rows.
- `components/FinanceStation.tsx` as the single client station, dispatching on
  tool id; registered in `components/ToolWorkspace.tsx` before the
  ToolWorkbench fallback.
- Station registration: `implementedStationNames`, `localStations`, a notice in
  `StationLanding`, an icon in `StationMark`.
- WebMCP: explicit dispatcher cases calling the same pure functions.
- No worker: the arithmetic is O(months) and far below a frame budget.

## 7. Risks

- **Count drift** across tests and copy (§2). One coordinated update per batch.
- **Rounding disagreements.** Publish the assumption (reducing balance, monthly
  rate = annual/12, EMI rounded to paise, last instalment absorbs the residual).
- **Tax accuracy.** GST rates change; presets are editable, dated, and labelled
  as user-selected, never as authoritative law.
- **Investment claims.** SIP projections are hypothetical, with an explicit
  disclaimer and inflation-adjusted “real value”.
- **MCP/JSON-LD parity.** New tools register in WebMCP; the FAQ text claiming
  universal stdio MCP support should not be widened.
- **Sensitive input.** No autosave, no URL parameters, no logging of entered
  amounts.

## 8. Testing strategy

- Unit tests per calculator with independent reference values: EMI formula
  cross-check, amortization principal sum equals loan, interest sum equals total
  interest, zero-rate and one-month edge cases, last-instalment residual.
- Prepayment: baseline vs extra-payment scenario, reduce-tenure vs reduce-EMI,
  charges, payoff month.
- GST: exclusive/inclusive symmetry, CGST+SGST equals IGST, custom rate, line
  items, zero rate.
- SIP: monthly compounding, step-up years, inflation adjustment, comparison
  rates.
- Registry tests: `config/finance-tools.test.tsx` in the existing pattern (h1,
  labels, station link, metadata), plus updated global counts.
- Gates: `npx tsc --noEmit`, `npm run audit:ui`, `npm run lint`, `npm test`,
  browser checks at 1440/390 in light and dark, keyboard focus, real input
  acceptance.
- No uploads: confirm through the network panel that no request carries input.

## 9. Delivery checklist

Implemented in Batches 1–3: registry, Finance and Productivity stations,
four finance tools, three PDF tools, the video thumbnail tool and the Pomodoro
timer, WebMCP cases, pure-helper and component tests, counts and docs. Deferred:
PDF compressor, video trimmer, GIF, OCR. Not started: Batches 4–5.
