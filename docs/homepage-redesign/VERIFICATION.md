# Homepage verification — 2026-10-07

## Automated verified

| Check | Actual result |
| --- | --- |
| `git status --short` | No Git repository; no branch/commit claimed. Baseline hashes substitute for scope comparison. |
| `npm run typecheck` | Passed (exit 0). |
| `npm run lint` | Passed with existing warnings, exit 0. Existing hook cleanup, image and input ARIA warnings remain in untouched components. |
| `npm test` with Node 22.19.0 | **5,293 tests / 87 files passed**. Includes four new discovery/contract regression tests. |
| Initial `npm test` with shell-default Node 25.1.0 | 5,280 passed / 9 failed: unchanged ThemeToggle tests failed because `window.localStorage.clear` was not a function. The documented Node 22 runtime passes all of them; no theme code was changed. |
| `npm run build` with Node 22.19.0 | Passed, exit 0; 322 static pages generated, existing warnings. Homepage route 8.23 kB; first-load JS 166 kB as reported by Next (not a Lighthouse score). |
| `node scripts/verify-homepage.mjs` | All 30 distinct homepage destinations HTTP 200 with H1, including all 15 canonical station landings and all selected tools. Homepage native text input contract, four decorative SVGs, reduced-motion rule and contrast assertions passed. |
| Source scope | 306 of 308 pre-existing application/reference assets unchanged; only `app/page.tsx` and `components/SiteFooter.tsx` changed. Added homepage module/graphics/test. All providers, registries, engines, routes, metadata, logo, theme toggle and globals unchanged. |

Commands ran in `/Users/tejreddym/Desktop/Dev_Tools`. Use `PATH=/usr/local/bin:$PATH` in this machine to select the documented Node 22.19.0. No dependency install was needed; lockfile/package manifest untouched. Development server was started in this same turn for browser checks, stopped before production build, then the built app was started for final verification. Never built under an active server. The verification server was stopped after checks; restart locally with `PATH=/usr/local/bin:$PATH npm run dev`. Original homepage/footer sources are retained as `.txt` files beside the before screenshots.

Raw command logs, scope hashes summary and computed route/contrast/size results are saved alongside this document. The static-page count includes framework-generated routes; it is not a tool-count claim.

## Live-browser verified

- Before/after screenshots at matching **1440×900 desktop** and **390×844 mobile** viewports, both themes. Browser exports omit the 15px scrollbar, so image content is 1425px / 375px wide. Full-page captures differ in height because composition changed. Original source was saved before edits and briefly restored to correct the first browser viewport mismatch; final code was restored before production build.
- Layout observed at **320×720, 390×844, 768×1024, 1024×600, and 1440×900**. At inspected widths scrollWidth did not exceed client width. The tablet showcases change to a wide data panel with two panels below; mobile stacks them. Directory remains a single mobile column. Footer/principle ending was visually inspected on mobile.
- Search types normally, returns the exact existing search matches, shows zero-results state, and Clear restores six registry-selected quick links. `png to webp` yields one matching tool. Tab moves through Browse all tools to the result; its visible focus outline is solid and Enter navigates to `/tools/png-to-webp`. The default input type is still `text`, with no explicit type attribute. Baseline had no command shortcut or arrow-key result handler; neither was introduced.
- Mobile Menu opens all three existing destinations. Stations closes the menu and reaches the index anchor. Home returns to the opening. Theme toggles work, and both light and dark preferences survived explicit production reloads.
- On 1024×600, search input was at y=388–428, visible before scrolling. On mobile, search precedes decoration. The input itself does not animate. Nonblank queries remove the decorative stage and place results immediately below the stable input.
- Existing JSON Formatter: entered `{"idea":"build","ready":true}`, formatted successfully, then Clear removed input/result. Input remains a textarea and existing Copy/Download actions appear with the result. Image conversion route retains file input, native output select and numeric quality control. Tool routes keep their original footer/shell styling.
- Production homepage loaded/refreshed with **no recorded browser console errors**. An initial CSS `align-items: end` compatibility warning was corrected to `flex-end`; development Fast Refresh messages are not production errors.
- Browser DOM reading order matches visual order. SVGs are hidden from the accessibility tree, not focusable, and cannot intercept input.

## Measured graphics and contrast

Four original inline SVGs, combined rendered markup: **5,635 bytes raw / 1,472 bytes gzip** (under 50 KB by a wide margin). Animation JavaScript: **0 added bytes**. New runtime dependencies: **0**. Fonts: existing stacks, no new font requests. The SVG markup is deterministic and local. Documentation screenshots are verification evidence, not shipped homepage assets.

Measured homepage text pairs: minimum **5.53:1** (secondary on light raised surface), primary **16.54:1** in both themes, dark secondary **9.30:1** on canvas, lime filled emphasis **15.26:1**. Search boundaries minimum **3.24:1**, focus indicators minimum **6.14:1**. Exact pairs and values are in `automated-results.json`. Decorative fine rules are not controls and are not asserted at 3:1. Existing global semantic states and theme-toggle artwork were not recolored or re-certified.

## Explicit limits

- CSS reduced-motion rule and absence of perpetual new animations verified automatically; live OS reduced-motion preference was not emulated. Existing theme system/preference/storage behavior is covered by its nine passing tests and the live explicit-toggle/refresh checks; live system-preference changes were not performed.
- Browser zoom, physical touch, actual screen-reader speech and cross-browser/device rendering were not tested. Mobile viewport interaction and accessibility-tree inspection are not substitutes for those checks.
- Current browser APIs did not expose a full network-request trace. DOM asset origins and source inspection found local scripts/styles and no new external resources; no claim that all network traffic was captured. Conversion processing beyond the representative JSON flow, actual uploads/download bytes and all tool flows were outside this homepage verification pass.
- Legal wording/license notices and their existing provisional limitations remain unchanged. No deployment, account feature, new tool, Developer Math station or reward guarantee.

## Matched screenshots

| View | Before | After |
| --- | --- | --- |
| Desktop dark, 1440×900 | [Original](before/before-desktop-dark.jpg) | [Redesign](after/after-desktop-dark.jpg) |
| Desktop light, 1440×900 | [Original](before/before-desktop-light.jpg) | [Redesign](after/after-desktop-light.jpg) |
| Mobile dark, 390×844 | [Original](before/before-mobile-dark.jpg) | [Redesign](after/after-mobile-dark.jpg) |
| Mobile light, 390×844 | [Original](before/before-mobile-light.jpg) | [Redesign](after/after-mobile-light.jpg) |

The composition change is structural: left/right hero → centered opening and assembly; tall featured cards → two-column compact rows; repeated station cards → ruled index with narrow introduction. The new three-panel illustrative section and lime wordmark ending establish distinct rhythms. These differences persist without color.
