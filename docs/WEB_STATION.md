# Web Station

## Scope

Web Station provides exactly 21 browser-local tools at `/stations/web` and `/tools/<web-tool-id>` for URL parsing/building, query strings, local HTTP/MIME/header references, heuristic User-Agent parsing, inert metadata generation, sitemap/robots/manifest generation, local raster favicon conversion, HTML entity lookup, and URL fragment/path/percent-encoding inspection.

Entered URLs are treated as data. The station never visits URLs, fetches pages or images, crawls, proxies, performs DNS checks, sends analytics payloads, stores input, or places values in route search parameters. Generated HTML is escaped text, not trusted markup. Favicon conversion uses File/Blob, native image decoding and canvas in the browser; SVG and ICO output are intentionally unsupported.

## Contracts and limitations

- URL Parser masks its source field and never returns an embedded password value; it reports password presence only. URL Builder accepts HTTP/HTTPS and structured decoded rows, encoding each value once.
- Query parser/generator preserve order, duplicate keys and empty values. Native `URLSearchParams` behavior means spaces decode from `+` and encode to `+`.
- Status, MIME and header lookups use curated local tables. Unknown status codes retain only their numeric class and an unassigned message; MIME mappings do not prove file contents.
- User-Agent parsing is bounded heuristic interpretation of supplied text and does not fingerprint the current browser.
- Metadata, Open Graph, Twitter/X, canonical, robots, sitemap and manifest generators validate local input and return inert text. Open Graph preview uses a textual image placeholder and is not guaranteed to match a third-party platform.
- Sitemap dates are never invented; sitemap priorities are 0–1. `robots.txt` is crawler guidance, not access control. A manifest alone is not a complete PWA.
- Path and percent-encoding inspection preserves invalid sequences with warnings and reports positions as zero-based UTF-16 offsets. HTML entity lookup supports Unicode scalars and named multi-code-point entities.
- Text fields are capped at 200,000 units, aggregate generator input at 1,000,000 units, lists at 1,000 rows and outputs at the station UI bound. Favicon input is capped at 16 MiB, 8,192 pixels per side and 16 million pixels.

## Verification

Executed on 2026-10-05: `npm run typecheck`; `npm test` — **4,058 tests / 48 files**; final `npm run build` — **21 Web tools, 214 generated pages**, clean of the initial CSS alignment warnings. Focused Web suites cover 616 tests, exact controls, keyboard structured editors, copy, clear, local Blob downloads, favicon lifecycle, SSR hydration, malformed/Unicode/boundary inputs and no-network/privacy sinks.

## Browser acceptance checklist

The jsdom checks are not a substitute for live-browser acceptance. Still to verify in a real browser: all 21 examples and errors, clipboard permission behavior, native favicon decoding on PNG/JPEG/transparency/non-square inputs, actual download save dialogs, dark/light theme visuals, 310px/mobile and desktop layouts, direct refresh/history for paired routes, CSP/console/hydration behavior, and no unexpected network requests. The Open Graph preview must remain a placeholder rather than an external image request.
