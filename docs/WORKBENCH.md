# Workbench release — 2026-10-07

## Scope

First implemented release of the eight prioritized improvements plus Smart Detection. Existing 295 tools and 15 stations remain authoritative. Six public pages were added: `/workbench`, `/settings`, `/workflows`, `/batch-images`, `/feedback`, `/offline`. The sitemap now lists 323 unique canonical pages on the owner-confirmed `https://codestation.in` domain. Indexing remains opt-in; no deployment or ads were added. Developer Math and the four speculative new-tool candidates are not part of this release.

## Features and boundaries

- **Favorites and recent tools:** star controls on tool pages and directory rows; personal lists on Home and Workbench. Persist canonical tool identifiers only, with up to 100 favorites and 12 recent tools. Settings can clear lists and disable recent tracking. Preferences are defensive against malformed storage and unknown tool IDs; no tool content enters storage.
- **Search everywhere:** header search and Control/Command K open a native modal dialog. Native search input, Escape, arrow selection, Enter and ordinary Tab links work. Existing exact/name/keyword/description ordering is retained, with a lower-ranked all-token fallback. The tools directory has a native search field and category grouping. Homepage input type is unchanged.
- **Smart Detection:** a lightbulb opens text clipboard detection. Recognizes JSON, HEX colors, UUID-shaped identifiers, JWT structures, HTTP(S) URLs, probable printable Base64 and text fallback. JSON offers Formatter/Tree Viewer/Validator; ambiguous input never auto-opens. A single confident match may open and populate the primary field, without running the tool. Settings can disable this behavior. Manual opening replaces that primary field; the interface says so.
- **Optional focus checks:** off by default. On return to the tab, inspect only when the browser reports clipboard-read permission already granted. No background polling or repeated permission requests. Automatic navigation is restricted to Home, Tools and Workbench, so active tool pages receive suggestions instead. A manual paste textarea works where clipboard APIs are unavailable. Detection limit: 200,000 characters, rejected rather than truncated. Clipboard text remains in memory. The handoff has a 60-second expiry, an explicit target and one-shot token, and uses each tool’s own edit/invalidation path. Root converter-session provider stays mounted.
- **Connected workflows:** seven existing operations: CSV→JSON, JSON-array→CSV, JSON→YAML, YAML→JSON, JSON Formatter, JSON Minifier and JSON Key Sorter. Conversion edges come from the capability registry; formatter operations are explicit. Up to six compatible steps; three starting recipes; original input retained for every run. Real disposable data workers execute each step. Edits/cancellation invalidate prior results and abort the worker. Step failures stop the chain with the engine’s error. CSV cells remain strings; conversions retain existing engine limits. JSON results can be handed to the existing Formatter in memory.
- **Shareable recipes:** versioned source format and tool-slug list only. Strict import rejects additional properties, unsupported chains and more than six steps. URL fragment contains no input/result. Copyable JSON remains available if clipboard access fails. No server or personal recipe account.
- **Batch images:** genuine PNG sources to JPG or WebP using the existing image engine. Up to 20 files, 16 MiB each and 64 MiB combined source/output caps. Native file/select/number/color controls. Sequential processing, progress, per-file failures, individual downloads and a successful-files ZIP via existing fflate. Native encoding already underway cannot be interrupted, but cancellation discards late output and prevents later files. Options/clear invalidate all results. Metadata removal, transparency and animation limits are disclosed.
- **Examples/error guidance:** targeted contextual help for JSON Formatter, JSON Validator, URL Parser, JWT Decoder, Color Converter and Text Counter. Existing engine validation is preserved. Workflow errors identify the stopped step and offer recovery guidance; batch errors remain attached to their file.
- **Offline/installable starter pack:** optional download in Settings, with manifest and local SVG app icon. Supports full-page visits to `/offline`, JSON Formatter and Text Counter. Application code is cached only after the explicit download; ordinary homepage visits do not download engines. The pack includes all emitted application-code chunks to support worker/dynamic imports, but only three HTML pages are supported offline. Cache completion marker prevents partial packs from serving; failed updates retain the prior ready pack. Query URLs, non-GET requests, external origins, RSC requests and unsupported pages are not cached. Remove action deletes this feature’s caches and unregisters its worker. Browser eviction remains possible. Use the offline page’s full document links; other navigation needs a connection.
- **Feedback:** `/feedback` and per-tool Report a problem links. Owner-approved destination `twnspace2@gmail.com`; mailto opens a draft only. Copy/download alternatives are local. No automatic input, device details, attachments, backend submission or sent-success claim.

## Architecture and design

`WorkbenchProvider` sits inside the existing stable `ConverterSessionProvider`. It owns preferences and a separate transient handoff. Engine modules remain dynamically imported. No processing engine, native control type, legacy canonical route, station availability or theme mechanism was replaced.

Shared warm ivory/charcoal/lime tokens are reused. New feature pages use compact ruled lists, clear numbered workflow sections, existing native controls, and visible status text. Native modal semantics provide focus containment and Escape. The 320px header uses two purposeful rows; larger mobile widths use one. No new animation framework, font request or runtime dependency was added. Reduced-motion rules were not changed.

The JSON & Data station’s old 46-heading/40-entry discrepancy is resolved by looking up station-owned IDs by ID rather than passing them to the slug-only lookup. The registry and counts themselves are unchanged.

## References

The user requested DevToys-style detection: [DevToys](https://devtoys.app/). The browser implementation adapts the idea rather than claiming native clipboard-monitoring parity.

Browser constraints informed the implementation: [MDN Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API), [readText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/readText), [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), [fetch events](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/fetch_event).

The previous editorial design references and original homepage graphics remain documented in the homepage/site design documents. This release adds useful workflows within that identity, rather than changing the logo or tool artwork.

## Build and operation

Node 22.19.0 was used. `npm run build` now runs Next and then `scripts/generate-offline-manifest.mjs`. Deploy the generated `public/offline-assets.json` together with the matching build and public service worker; never reuse it from another build. Dynamic route asset segments are URL-encoded in the manifest. This matters for `[slug]` chunks and was verified with the server stopped.

The final local production preview runs at `http://localhost:3000`. Stop it before rebuilding or starting development against the same `.next` directory. No Git repository is present; a baseline hash manifest and changed-existing-file list are recorded instead of a commit.

## Verification

- `npm test`: **5,341 tests passed across 93 files** (42 new tests).
- `npm run typecheck`: passed.
- `npm run lint`: exited successfully with 14 pre-existing warnings; no new warnings. Next lint also emits its deprecation notice.
- `npm run build`: passed, **328 static pages**. Final focused rerun: 42 tests passed after the last copy/CSS changes.
- Parsed `/sitemap.xml`: **323 unique HTTPS codestation.in URLs**; all 323 returned HTTP 200 from the final local production server.
- Browser: ambiguous JSON suggestions, actual JSON handoff without execution, unique HEX auto-open and filled Color input, auto-open setting disabled, favorites after refresh, recent tools, actual CSV workflow and native workers, keyboard search/Enter/Escape, mobile menu, both themes, feedback mailto address/escaping (no email sent).
- Browser batch: two generated 32×32 PNGs converted; invalid PNG failed independently. ZIP action reported a download request. The browser automation did not expose the completed downloaded file, so saved ZIP bytes were not inspected.
- Offline browser: download/update/removal verified. With the local server stopped, JSON Formatter processed `{"offline":true,"value":7}` and Text Counter reported 13 characters for `Hello offline`. Refresh returned an empty input. An initial encoded-chunk cache mismatch was found and fixed before the successful repeat.
- Unit tests cover oversized/ambiguous detection, preferences stripping content, real workflow-engine chains, recipe rejection, batch bounds and cancellation, stale result invalidation, feedback encoding, offline request isolation and incomplete-cache behavior.
- Workflow document bounds checked at **320, 390, 768, 1024 and 1440px**, including 1024×600. No horizontal overflow measured. Mobile detection was visually inspected and compacted so suggestions appear sooner. Fresh final production tab logged no errors or warnings during workflow/settings/feedback checks.

Evidence: [release screenshots](workbench-release/index.html), [automated logs and measurements](workbench-release/), [route results](workbench-release/routes.json).

## Size and dependency measurements

No new runtime dependencies. Existing fflate and existing engines are reused.

| Asset | Raw bytes | gzip bytes |
| --- | ---: | ---: |
| App icon SVG | 308 | 225 |
| Service worker | 3,308 | 1,359 |
| Web app manifest | 330 | 234 |
| Generated offline asset manifest | 7,260 | 2,238 |

Final optional offline code pack: **142 files, 4,831,438 uncompressed bytes (4.61 MiB)**, plus three HTML page shells, icon and web app manifest. This is an explicit download, not an eager homepage load. It includes code for other families because shared/dynamic chunks must be available; only the two named tools are supported offline in this release. No performance score is claimed.

## Remaining limitations

Clipboard focus behavior depends on browser permissions; native app parity, Safari/Firefox manual clipboard prompts and physical mobile devices were not fully tested. The automatic focus-permission path was not exercised against a real clipboard containing user data. No screen-reader audit, physical touch test, OS reduced-motion toggle, browser zoom audit or exhaustive network trace was performed in this feature release. No new continuous motion was added.

Browser installation was not accepted end-to-end; install availability depends on the browser. Offline scope is intentionally two tools and requires a production pack. The pack can consume more disk space than transferred compressed network bytes. Download completion and ZIP bytes could not be observed through the browser automation.

Workflow coverage is seven operations and six steps, batch coverage is PNG→JPG/WebP, and contextual guidance covers six tools. Broader families and the speculative new tools remain future work. Existing 14 lint warnings and provisional legal/operator details remain. Ads, deployment, public indexing enablement, analytics and monetization changes were not performed.
