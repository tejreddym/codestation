# Site foundations

## Origin and indexing

`NEXT_PUBLIC_SITE_URL` is optional and is accepted only as a verified HTTPS origin: no credentials, query, fragment, path, localhost name, or private IPv4 address. The old unverified fallback hostname was removed. `SITE_INDEXING=index` is an explicit production switch and works only when that origin is valid. Missing/unsafe origins and every other indexing setting produce `noindex, nofollow`; robots disallows crawling in that state. The XML sitemap is empty without a valid origin and otherwise contains the root, `/tools`, all implemented `/stations/*` registry routes, canonical tool routes, and informational pages. Query/filter station routes and redirects are excluded and routes are deduplicated.

`metadataForPage(path, title, description)` is the informational-page metadata API. It adds an absolute canonical and Open Graph URL only when the verified origin exists, and always applies the indexing robots setting. `metadataForRoute(path, title, description)` is used by station/tool routes; it keeps the canonical route path and applies the same opt-in robots policy. `siteConfig.domain` is intentionally the empty string when no origin is configured for compatibility with current string consumers; the root metadata caller must guard it before passing it to `new URL()`.

## Observed behavior and privacy boundaries

Most tools process data in the browser. No application analytics sink was found in the inspected source. This does not claim that browser, hosting, network, or third-party destination logs do not exist. The theme toggle stores only its selected theme in `localStorage` under `code-station-theme`.

The API Request Tester performs explicit outbound browser requests only after Send Request. It uses `fetch`, omits ambient credentials, and does not provide a backend proxy or CORS bypass. Markdown SafePreview sanitizes markup but permits safe `http(s)` `src` attributes; remote images can therefore be requested by the browser. The public notices must not say that nothing leaves the device.

## Legal status

The operator/host, verified contact, retention period, governing law, and jurisdiction are unknown. `/privacy` and `/terms` are explicitly provisional and contain no invented entity, address, or jurisdiction. No fake contact form or address is provided.

## Licensing and assets

There is no root project license in the inspected workspace. `THIRD_PARTY_NOTICES.md` is repeatable output from `package-lock.json` and installed production package license files. Missing exact texts remain marked unresolved; SPDX/package labels alone are not treated as notices. The illustrated theme toggle is present, but its source/provenance and license are unresolved. The owner must confirm attribution and permission before treating the asset notice as final.

## Confirmed public origin — 2026-10-07

The user confirmed `https://codestation.in`. `.env.local` and `.env.example` set `NEXT_PUBLIC_SITE_URL` to that origin. Supply the same environment value for production builds; the XML remains registry-driven rather than a separately maintained public file. Verified the local `/sitemap.xml` response as valid XML containing 317 unique absolute URLs (home, directory, 15 stations, 295 tools and five information pages). Indexing remains a separate opt-in; no deployment or search-engine submission was performed. Coverage and exclusions are tested in `app/sitemap.test.ts`.
