# Advertising integrations

Code Station's Adsterra integrations are implemented as an explicit, production-
only opt-in. Every switch is `false` in `.env.example`, and no advertising
format is enabled by this change or by local development.

## Formats and placements

| Format | Source | Placement | Switch |
| --- | --- | --- | --- |
| Social Bar | `https://bauval.org/14/63bf50be8c148bc60eb10a44e5ad23b3` | Global root layout, loaded once after interactive | `NEXT_PUBLIC_ADS_SOCIAL_BAR_ENABLED` |
| Popunder | `https://abscloud.org/1/e03072b30061fdd916e81456aa8185bf` | Global root layout, loaded once after interactive; no fake button or download hook | `NEXT_PUBLIC_ADS_POPUNDER_ENABLED` |
| Native Banner | `https://bauval.org/21/14efe1c7efaabb7ed1d8cdc2a828d40d` | One responsive homepage placement between the showcase and station directory; container `container-14efe1c7efaabb7ed1d8cdc2a828d40d` | `NEXT_PUBLIC_ADS_NATIVE_ENABLED` |

The master switch is `NEXT_PUBLIC_ADS_ENABLED`. A format loads only when the
master switch and that format's switch are exactly `true`, and only when the
deployment is a production build. The supplied URLs are loaded directly with
`next/script`; they are not proxied, rewritten, or copied into application
processing paths. All three scripts preserve `data-cfasync="false"`.

## Enabling a production deployment

Do not enable advertising merely because the components are present. Before an
owner enables any format:

1. Confirm the operator, privacy notice, advertising account, inventory
   settings, and regional requirements. Adult or otherwise unsuitable ad
   categories must remain disabled in the advertising account.
2. Choose and deploy an applicable consent-management approach for regions and
   audiences that require consent. This repository does not provide a consent
   platform, infer consent, or claim regulatory compliance.
3. Update the public privacy notice and any required terms/disclosures to name
   the advertising provider, possible third-party requests, purposes, and user
   choices. Review the provider's current terms and privacy documentation
   separately.
4. Set the switches as build variables for the production build. `NEXT_PUBLIC_*`
   values are bundled by Next.js, so changing a Cloudflare runtime variable
   after the build does not change the rendered application.

For an intentional production enablement, the values are:

```text
NEXT_PUBLIC_ADS_ENABLED=true
NEXT_PUBLIC_ADS_SOCIAL_BAR_ENABLED=true   # choose only the formats approved
NEXT_PUBLIC_ADS_POPUNDER_ENABLED=false
NEXT_PUBLIC_ADS_NATIVE_ENABLED=true
```

Keep unapproved formats `false`. Never put provider credentials or private
account data in the repository or in public environment variables.

## Failure and layout boundary

The app does not depend on an advertising response. A blocked, unavailable, or
failed third-party request leaves the surrounding page usable; the Native
Banner has a bounded responsive container and reserved space to reduce layout
shift. Tests verify production gating, exact source attributes, independent
format switches, and the single homepage container. They do not claim that a
third-party endpoint is reachable or that an ad will render in every browser.

## Verification

Run the focused contract checks without enabling real advertising requests:

```bash
npx vitest run config/ads.test.ts components/Ads.test.tsx
npm run typecheck
```

Use the default disabled values for local development. If an owner later needs
an enabled production-like check, use a temporary isolated build environment,
inspect the resulting DOM and network behavior, and remove the temporary
values afterward. Do not commit enabled ad variables.
