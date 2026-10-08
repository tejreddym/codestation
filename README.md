# Code Station

Code Station is a browser-first developer toolbox. The first slice provides a searchable, responsive tool catalog and local-first JSON, encoding, security, timestamp, and text utilities.

## Getting started

Requirements: Node.js 22.13+ (validated with 22.19.0) and npm. The jsdom test dependency requires Node 20.19+, 22.13+, or 24+.

```bash
npm ci
npm run dev
```

Checks: `npm run typecheck`, `npm test`, and `npm run build`. `npm run lint` completes with the project's existing warnings; it is not a clean lint pass. See `HANDOFF.md` for current audit results.

Stop any server using `.next` before building. To preview a finished build: `npm run start -- -p 3001`.

## Date & Time Station

The existing Unix Timestamp Converter remains available. Sixteen additional tools provide explicit seconds/milliseconds, date/epoch conversion, time zones, relative dates, elapsed differences, ISO weeks, leap years, weekdays, and age. Browse `/tools?category=Date%20%26%20Time`.

Calculations are local. IANA zone rules come from the browser; skipped local times fail and repeated times require an earlier/later choice. Date differences measure elapsed 24-hour days, while age and business days use calendar dates. Business days exclude Saturday/Sunday only, not holidays. See `docs/DATE_TIME_STATION.md` for limits and verification.

Tests include helper vectors, DST boundaries, all 16 UI examples, reset, keyboard submission, clipboard failures, downloads, and network-call guards. Run just the station: `npm test -- lib/tools/date-time-station.test.ts config/date-time-tools.test.ts components/DateTimeStation.test.tsx`.

## Project context

- [`AGENTS.md`](AGENTS.md) — working rules for contributors and agents
- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — current state and gaps
- [`HANDOFF.md`](HANDOFF.md) — resumable handoff
- [`TODO.md`](TODO.md) — prioritized work
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — intended boundaries
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — recorded decisions
- [`docs/SESSION_LOG.md`](docs/SESSION_LOG.md) — session history

## Environment

Copy `.env.example` to `.env.local` when local configuration is needed. `NEXT_PUBLIC_SITE_URL` controls canonical URLs and sitemap output. The confirmed production value is `https://codestation.in`; supply this value to production builds as well as local configuration. Do not commit secrets.

## Cloudflare deployment

The production target is Cloudflare Workers through the OpenNext adapter. The
repository includes `wrangler.jsonc`, `open-next.config.ts`, and the standard
`npm run preview`, `npm run deploy`, and `npm run upload` commands. Read
[`docs/CLOUDFLARE_DEPLOYMENT.md`](docs/CLOUDFLARE_DEPLOYMENT.md) before
connecting Workers Builds or the `codestation.in` custom domain.

## Contributions

Keep changes focused, preserve existing routes, and update the context documents. No accounts or secrets are required for these browser-only tools; Cloudflare account, domain, and deployment steps are documented separately.
