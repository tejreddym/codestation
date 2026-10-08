# Code Station brand kit

Dark means charcoal artwork for a light background. Light means ivory artwork for a dark background. The primary SVGs and transparent PNGs have no background, including inside the icon frame.

## Requested SVG masters

- svg/icon-{dark,light}.svg: icon only, 104×104 viewBox.
- svg/icon-small-{dark,light}.svg: optically simplified 32×32 icon for 16–48px use.
- svg/logo-horizontal-{dark,light}.svg: logo + Code Station on one line, 480×128.
- svg/logo-stacked-{dark,light}.svg: logo beside Code / Station on two lines, 360×200.
- svg/wordmark-{dark,light}.svg: text only, 540×100.

Additional SVGs: centered vertical lockup, stacked text, monochrome icon, opaque app tile, maskable tile and three social canvases. All lettering is path artwork; no fonts, external images or scripts are required. SVGs scale to any size. Preserve aspect ratio and do not stretch.

## Raster and platform sizes

- Transparent PNG icons: 16, 20, 24, 32, 40, 48, 64, 96, 128, 144, 152, 180, 192, 256, 384, 512 and 1024px.
- PNG wordmarks/lockups: native SVG size at 1×, 2× and 3×. Use these for email and systems that do not support SVG.
- ICO fallback: 16/32/48px frames, one file per color variant.
- Adaptive SVG favicon follows browser light/dark preference. Safari pinned-tab icon is monochrome.
- Apple touch icons: opaque 120/152/167/180px.
- PWA/Android: opaque 192/512px and separate maskable 192/512px. Maskable foreground fits within the central 80% safe circle.
- Social: landscape 1200×630, square 1080×1080, header 1500×500. Their backgrounds are intentional; unlike the core logo assets, these canvases are opaque.

Use the appropriate variant for background contrast. Keep at least one brace-width of clear space outside the supplied artwork. Use the compact icon below 48px; use the horizontal lockup at 180px wide or larger. Monochrome artwork is available for stamps, engraving and single-ink applications. SVG is vector artwork for print; final CMYK, bleed and substrate requirements belong to your printer. No one finite icon set guarantees every platform specification.

## Integration example

The kit is available at /brand/. This task creates assets; it does not replace the existing header, favicon configuration or web app manifest.

```html
<link rel="icon" type="image/svg+xml" href="/brand/favicon/favicon-adaptive.svg">
<link rel="icon" sizes="32x32" type="image/png" href="/brand/icons/icon-dark-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/brand/platform/apple-touch-icon-light-180.png">
<link rel="mask-icon" href="/brand/favicon/safari-pinned-tab.svg" color="#151713">
```

The SVG uses fixed colors, not theme-dependent page CSS. For an image over a dark page choose a -light filename. For Android/PWA use purpose:any with android-chrome files and purpose:maskable only with maskable files. Avoid transparent touch icons on platforms requiring an opaque background.

## Source and reproduction

The rounded brace frame, slight tilt and three indicator dots are derived from components/StationMark.tsx and app/globals.css. Palette variants follow the actual site tokens. Wordmark outlines preserve the site's Arial Bold lettering and -0.035em tracking; braces preserve its monospace treatment. The compact icon reduces optical detail but retains frame/braces/three dots.

Fixed phrase outlines are stored in source/wordmark-outlines.json; no font software is distributed. Run node scripts/generate-brand-assets.mjs from the project to reproduce all assets and the ZIP using the already installed sharp and fflate packages. This needs no network, font installation or new runtime dependency. The generation script is also included as source/generate-brand-assets.mjs in this download; use it from the project scripts directory.

See asset-manifest.json for exact names, dimensions, transparency and measured byte counts. Open index.html for a downloadable visual catalogue.
