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
  preserves the `codestation.in` custom domain and smart placement, enables
  `nodejs_compat`, and enables Worker observability.
- `open-next.config.ts` selects the Cloudflare OpenNext configuration.
- `public/_headers` gives immutable caching to Next static chunks.
- `next.config.ts` calls `initOpenNextCloudflareForDev()` so `next dev` can
  interoperate with Cloudflare bindings if they are added later.
- `.dev.vars.example` documents the local Worker runtime selector. The real
  `.dev.vars` file is ignored and must not contain committed secrets.

The app binds one Cloudflare KV namespace (`LICENSE_KV`) for storing one-way
SHA-256 hashes of Code Station Pro license keys.

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
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_Tli5WVYM3S0zhH
```

Add these **Runtime secrets** in Worker Settings → Variables & Secrets:

```text
RAZORPAY_KEY_ID=rzp_test_Tli5WVYM3S0zhH
RAZORPAY_KEY_SECRET=oZnLs4H38FXMcI7BHt1WH815
```

Advertising is a separate, owner-approved opt-in. Keep these build variables
`false` (or unset) unless the privacy, consent, regional, and inventory review
in [ADVERTISING.md](ADVERTISING.md) is complete:

```text
NEXT_PUBLIC_ADS_ENABLED=false
NEXT_PUBLIC_ADS_SOCIAL_BAR_ENABLED=false
NEXT_PUBLIC_ADS_POPUNDER_ENABLED=false
NEXT_PUBLIC_ADS_NATIVE_ENABLED=false
```

Production indexing for `codestation.in` is owner-approved.
`SITE_INDEXING=index` is declared as a committed runtime variable in
`wrangler.jsonc` `vars`, so `robots.txt` and `sitemap.xml` read it at request
time without a separate dashboard step. Build variables still need
`SITE_INDEXING=index` alongside `NEXT_PUBLIC_SITE_URL` because `siteConfig`
is evaluated during the Next build for page metadata. The local/default
examples and CI deliberately keep indexing disabled.

For a local Worker preview, copy `.dev.vars.example` to `.dev.vars` and
intentionally uncomment `SITE_INDEXING=index` only when testing the
indexing-enabled path. `.dev.vars` values override `wrangler.jsonc` `vars`
locally.

Keep runtime secrets in the Worker’s **Settings → Variables & Secrets** area;
do not put secrets in `.env.local`, `.dev.vars`, or Git. Non-secret runtime
variables like `SITE_INDEXING` belong in `wrangler.jsonc` `vars`.

## Domain and release checklist

1. Create/connect the Worker named `codestation` in the intended Cloudflare
   account.
2. Confirm the `codestation.in` zone is in that account and attach the custom
   domain from the Worker’s Domains & Routes settings if it is not already
   present. The committed Wrangler route preserves that custom domain on
   subsequent deployments.
3. Run a preview build and inspect representative station, tool, static asset,
   `robots.txt`, `sitemap.xml`, manifest, offline-pack, redirect, and direct
   refresh routes.
4. Deploy from Workers Builds or run `npm run deploy` from an authenticated
   machine—not both for the same release unless deliberately testing a second
   path.
5. Verify HTTPS, canonical URLs, response headers, the custom domain, the
   production offline starter pack, `robots.txt`, and the sitemap after each
   production deployment.

The repository configuration does not prove Cloudflare account ownership,
billing, or every production health check. Workers Builds has completed a
production deployment for this release; future deployments should keep the
custom-domain route declared in `wrangler.jsonc` and review the deploy warning
if the dashboard configuration changes.

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
