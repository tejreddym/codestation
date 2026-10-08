# Illustrated theme toggle — 2026-10-07

The existing hand-drawn sun/moon control now matches Code Station's palette. Day uses a lime sun (#D9F975), neutral sage sky and white clouds. Night uses charcoal (#151713 / #293222), an ivory moon (#F6F5F1), lilac craters (#B9ADF2) and lime stars. The tilted frame, square celestial objects and three dots retain the existing illustrated identity.

Changes are scoped to the `.theme-switch` styles in `app/globals.css`, its mobile size rule and an `aria-hidden` decorative wrapper in `components/ThemeToggle.tsx`. Theme state, native button type, labels, pressed state, saved preference key, system fallback and initialization script are unchanged. Providers, tools and source sessions are untouched.

The sun rays and shooting star have one 700ms pass; perpetual sun/meteor/aurora motion is removed. Existing reduced-motion rules disable the animations and minimize transitions. The decorative scene cannot intercept pointer events. A clear keyboard focus ring uses the existing semantic focus token. Its calculated contrast against the page is 6.14:1 in light mode and 15.26:1 in dark mode; the dark frame boundary is 4.80:1 against the page. These are specific color-pair measurements, not a blanket accessibility claim.

The native button is 79×44px on desktop and 64×44px below 420px. Mobile scales the illustration through its font size instead of shrinking the whole clickable button.

## Verification

- Existing ThemeToggle suite: 9/9 passed under Node 22.19.0. Includes saved/system preference, blocked storage, hydration and Enter/Space behavior.
- Typecheck passed. Lint completed with the 14 existing warnings. Production build passed, generating 328 static pages; the normal build regenerated the optional offline manifest (142 assets / 4,831,797 bytes).
- Browser: reviewed light/dark desktop at 1440px, mobile dark at 320px and mobile light at 390px. No horizontal overflow at the checked mobile widths; button measured 64×44px. Verified Enter and Space, mouse switching, dark preference after refresh, focus ring and mobile Menu/Close navigation. Production console returned no warnings/errors.
- Saved matching desktop before/after screenshots and mobile/detail after screenshots in this directory. Final after screenshots use the production build. Development server was stopped before building; production preview was restored at localhost:3000.
- No added dependencies, runtime JavaScript, fonts or external assets. Existing SVG artwork is reused. Full tool suite was not rerun for this scoped visual change. Reduced-motion CSS was inspected; live OS reduced-motion, physical touch, other browsers and screen readers were not independently tested. No deployment.

## Screenshots

| Theme | Before | After | Detail |
| --- | --- | --- | --- |
| Light | [Desktop](before-light.jpg) | [Desktop](after-light.jpg) · [Mobile 390px](mobile-light.jpg) | [Control](detail-light.jpg) |
| Dark | [Desktop](before-dark.jpg) | [Desktop](after-dark.jpg) · [Mobile 320px](mobile-dark.jpg) | [Control](detail-dark.jpg) |
