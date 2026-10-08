# Cloudflare Workers deployment

Code Station uses the OpenNext Cloudflare adapter to preserve the existing
Next.js 15 App Router application while producing a Cloudflare Worker. This
is an intentional compatibility choice for the current application; Cloudflare
currently recommends vinext for new Next.js projects, but its migration path
is not the scope of this release.

## Local commands

Use the pinned Node/npm versions (`.nvmrc` is Node 22.19.0 and `package.json`
requires Node 22.13+ and npm 10.9.3), then install the locked dependencies:

```bash
npm ci
npm run dev
```

The normal Next.js checks remain available:

```bash
npm run typecheck
npm test
npm run build
```

To build and run the application in the Cloudflare Workers runtime locally:

```bash
npm run preview
```

With the preview running, verify the Worker-facing routes and security headers
with:

```bash
EXPECTED_ORIGIN=https://codestation.in npm run cf:verify
```

For an intentionally indexing-enabled local preview, set
`EXPECTED_INDEXING=index` as well and provide `SITE_INDEXING=index` through
`.dev.vars`. The verification script defaults to the safer noindex behavior.

The preview command builds `.next`, generates the offline asset manifest, and
then creates `.open-next` before starting Wrangler. Stop any existing process
using `.next` before running it. `.open-next`, `.wrangler`, and generated
`public/offline-assets.json` are intentionally ignored by Git.

`npm run deploy` is the explicit production deployment command and requires a
Cloudflare login. `npm run upload` uploads a version without serving it
immediately, for gradual-deployment workflows. Neither command is run as part
of local verification.

## Files committed for the adapter

- `wrangler.jsonc` points at `.open-next/worker.js` and `.open-next/assets`,
  enables `nodejs_compat`, and enables Worker observability.
- `open-next.config.ts` selects the Cloudflare OpenNext configuration.
- `public/_headers` gives immutable caching to Next static chunks.
- `next.config.ts` calls `initOpenNextCloudflareForDev()` so `next dev` can
  interoperate with Cloudflare bindings if they are added later.
- `.dev.vars.example` documents the local Worker runtime selector. The real
  `.dev.vars` file is ignored and must not contain committed secrets.

The app currently does not require R2, KV, D1, Images, or other Cloudflare
bindings. Do not add a binding until a feature needs it.

## Workers Builds setup

After the repository is pushed, connect `tejreddym/codestation` in Cloudflare
Workers Builds and select the production branch (`main`). Use these commands:

- **Build command:** `npx @opennextjs/cloudflare build`
- **Deploy command:** `npx @opennextjs/cloudflare deploy`
- **Preview command:** `npx wrangler preview` (or the OpenNext preview command
  if preview builds are configured to build in that step)
- **Root directory:** repository root

Cloudflare's current Workers Builds flow separates the build and deploy
commands. The OpenNext guide specifies the adapter commands above; do not use
plain `next build` as the Worker deploy command.

Add these **Build variables and secrets** before the first production build:

```text
NEXT_PUBLIC_SITE_URL=https://codestation.in
SITE_INDEXING=index
```

`SITE_INDEXING=index` is an explicit launch decision. Keep it unset or use a
non-`index` value until the owner is ready for search indexing. Build variables
are needed because `NEXT_PUBLIC_*` values are bundled during the Next build.

Set `SITE_INDEXING` in the Worker’s **runtime Variables & Secrets** as well.
The robots and sitemap handlers read this non-public value at runtime, so a
build-only value is not enough for the deployed Worker. If indexing is not yet
approved, leave the runtime value unset; the Worker will return disallow/noindex
behavior. For a local Worker preview, copy `.dev.vars.example` to `.dev.vars`
and intentionally uncomment `SITE_INDEXING=index` only when testing the
indexing-enabled path.

Keep runtime secrets in the Worker’s **Settings → Variables & Secrets** area;
do not put secrets in `wrangler.jsonc`, `.env.local`, `.dev.vars`, or Git.

## Domain and release checklist

1. Create/connect the Worker named `codestation` in the intended Cloudflare
   account.
2. Confirm the `codestation.in` zone is in that account and attach the custom
   domain from the Worker’s Domains & Routes settings. Cloudflare manages the
   required route/DNS changes when the zone is active there.
3. Run a preview build and inspect representative station, tool, static asset,
   `robots.txt`, `sitemap.xml`, manifest, offline-pack, redirect, and direct
   refresh routes.
4. Deploy from Workers Builds or run `npm run deploy` from an authenticated
   machine—not both for the same release unless deliberately testing a second
   path.
5. Verify HTTPS, canonical URLs, response headers, the custom domain, and the
   production offline starter pack before enabling indexing.

This repository preparation does not prove Cloudflare account access, domain
ownership, DNS status, billing, or a successful production deployment. Those
are account-side checks and remain separate from the reproducible source
configuration here.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main` and pull requests. It uses
the pinned Node version, `npm ci`, lint, typecheck, the full Vitest suite, and
the production build. It keeps indexing disabled in CI while supplying the
public origin for canonical-route coverage. Workers Builds remains the
Cloudflare deployment gate and should use the OpenNext build/deploy commands
above.

## Upstream references

- [Cloudflare OpenNext adapter guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [OpenNext Cloudflare get started](https://opennext.js.org/cloudflare/get-started)
- [OpenNext Cloudflare develop and deploy](https://opennext.js.org/cloudflare/howtos/dev-deploy)
- [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
