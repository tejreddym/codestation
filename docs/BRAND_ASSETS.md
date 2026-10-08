# Code Station brand assets — 2026-10-07

The downloadable kit is in `public/brand/`. Open `public/brand/index.html` for the visual catalogue or download `public/brand/code-station-brand-kit.zip`.

## Identity and variants

Preserves the actual header identity from `components/StationMark.tsx` and `app/globals.css`: rounded brace frame, slight tilt, three indicator dots and tight Arial Bold wordmark. Core marks have fully transparent canvases, including inside the frame. Dark means charcoal artwork for light surfaces; light means warm ivory artwork for dark surfaces. Dot colors follow each existing theme. Small icons use a simplified upright frame/brace treatment to improve 16–48px rendering.

The requested SVG pairs are icon-only, one-line logo + text, logo beside two lines (`Code` / `Station`), and text-only. Additional SVGs include a centered vertical lockup, stacked text, monochrome icon, platform app tiles, maskable tiles, adaptive favicon, Safari mask and social canvases. All brand lettering is vector path artwork; no font or external image dependencies are embedded. Fixed outlined phrases are checked in under `public/brand/source/wordmark-outlines.json`.

## Deliverables

- 29 SVG files, including the overview sheet; 87 PNG exports; two ICO files.
- Transparent icons: 16, 20, 24, 32, 40, 48, 64, 96, 128, 144, 152, 180, 192, 256, 384, 512 and 1024px.
- Transparent lockups at 1×, 2× and 3×.
- Apple touch sizes: 120, 152, 167 and 180px; Android/PWA and maskable sizes: 192 and 512px.
- Social canvases: 1200×630, 1080×1080 and 1500×500.
- ICO containers have 16/32/48px transparent PNG frames. Adaptive SVG changes artwork color with the browser color-scheme preference.
- Apple/app/maskable and social canvases are deliberately opaque. Core logo/favicons remain transparent.
- ZIP: 1,588,140 bytes (about 1.51 MiB), 123 entries including source, catalogue, usage guide and dimension/size manifest.

These assets were created as a reusable kit. The application header, current `public/app-icon.svg`, active favicon metadata, web app manifest, routes, theme handling and tool functionality were not changed. Integration snippets are in the kit README. The separate static preview server runs at `http://127.0.0.1:3100/brand/index.html`; the existing app server was not restarted.

## Verification

All SVGs parse and have viewBox/title metadata. Logo SVGs contain no live text, raster images or scripts. Every PNG matches its advertised dimensions; transparent variants have clear corner pixels and non-empty alpha; opaque variants are fully opaque. Maskable foreground pixels fit within the central 80% safe circle. Both ICO files decode at all three sizes. ZIP CRC checks pass and the archive contains no font files.

The browser catalogue loaded all 20 preview images without broken assets or captured console errors/warnings. Both themes and 16/24/32/48px icon rendering were visually reviewed. See `docs/brand-assets/validation.json` and `small-icons-browser.jpg`.

Generation uses existing Sharp/fflate packages; no dependencies were added. Reproduce with `node scripts/generate-brand-assets.mjs`. Application tests/build were not rerun for this asset-only change; asset-specific validation was performed instead. Actual installation into OS launchers and browser pinned tabs was not tested. Vector masters support arbitrary print sizes, but final CMYK, bleed and substrate preparation remain printer-specific.
