# Handoff

**Updated:** 2026-11-27 · **Branch:** `main` · **Baseline:** **383 tools / 30 stations**

## Environment & Tooling Guardrails

- **Node Toolchain:** Validate and lock to Node `>=22.13.0 <23` (`.nvmrc` pins `22.19.0`) and npm `10.x` before running `npm ci` or updating `package-lock.json`. Never run `npm audit fix --force`.
- **Generated Artifacts:** `public/pdfjs/`, `public/offline-assets.json`, `public/THIRD_PARTY_NOTICES.md`, `THIRD_PARTY_NOTICES.md`, and `.eslintcache` are `.gitignore`d build outputs. `npm run build` automatically runs `copy-pdfjs-assets.mjs` and `generate-third-party-notices.mjs` before `next build`, then `generate-offline-manifest.mjs` after it, keeping `/licenses` (`app/licenses/page.tsx`) backed by `public/THIRD_PARTY_NOTICES.md`.
- **Single `.next` Owner:** Stop any running `next dev` or `next start` server before building or previewing OpenNext.

## Recent Work Completed (Pending User Approval to Push)

1. **Tools & Stations (pushed earlier in `48b8f25`, `8625806`):**
   - `video-trimmer` (`/tools/video-trimmer`), `pdf-compressor` (`/tools/pdf-compressor`), Canva-style overlay studio inside `video-thumbnail-generator`, and `invoice-generator` (`/tools/invoice-generator`).
   - Fixed CSS Module print selector purity in `components/InvoiceGeneratorTool.module.css`.
2. **Open-Source Community Files (committed locally in `ce24440`, not yet pushed):**
   - Added `LICENSE` (MIT, Tej Reddy 2026), `SECURITY.md`, `CONTRIBUTING.md`, `.github/dependabot.yml`, `.github/ISSUE_TEMPLATE/{bug_report,tool_request}.yml`, `.github/pull_request_template.md`, and updated `README.md` with CI/npm/license badges and screenshots.
3. **ESLint 9 Flat Config Migration & Clean Pass (uncommitted working changes):**
   - Migrated `.eslintrc.json` -> `eslint.config.mjs` (ESLint 9 + `@eslint/eslintrc` `FlatCompat` extending `next/core-web-vitals`, preserving bundled `jsx-a11y`), switched `package.json` `"lint"` script to `"eslint . --cache"`, and fixed all 18 lint problems (0 errors, 0 warnings).
4. **Repository Hygiene & Docs Consolidation (uncommitted working changes):**
   - Converted `THIRD_PARTY_NOTICES.md` to build-time generated `public/THIRD_PARTY_NOTICES.md` (`npm run generate:notices` wired into `build`), added to `.gitignore`, and untracked the 1.5 MB root/public copies from git.
   - Consolidated historical status/handoff/session logs into [`docs/archive/HISTORICAL_LOGS.md`](docs/archive/HISTORICAL_LOGS.md), leaving crisp snapshots in `PROJECT_STATUS.md`, `HANDOFF.md`, and active-only items in `TODO.md`.

## Next Steps for Incoming Agent

1. Check [`TODO.md`](TODO.md) for remaining active items (cross-browser codecs, real-browser station acceptance checklists, owner compliance/provenance decisions, or new scoped features).
2. Verify `git status` and only push local commits once the user gives explicit approval (`okay`).

Historical logs (2026-10-02 – 2026-11-16) are preserved in [`docs/archive/HISTORICAL_LOGS.md`](docs/archive/HISTORICAL_LOGS.md).
