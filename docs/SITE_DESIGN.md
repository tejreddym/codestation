# Code Station — one identity, distinct page layouts

Implemented 2026-10-07 following the user’s explicit request to extend the new homepage vibe to all other pages. This supersedes the earlier homepage-only styling scope. Tool functionality and Developer Math remain outside the task.

## Composition

- **All tools:** editorial two-line heading, original bracket graphic, category jump index and numbered tool groups. Category order follows first appearance in the authoritative tool registry; tool order is preserved within each category. Every tool remains a canonical link. Existing `?category=` filtering and empty behavior remain intact. The sticky desktop index becomes a two/three-column list on smaller screens.
- **All 15 station landings:** strong station identity, a layered category illustration, registry count, processing notice, existing working search/filter controls, two-column compact tool rows and ruled related-station entries. Descriptions and counts remain visible. No tools are omitted by styling.
- **All 295 tool routes:** a compact bracket-led category header, restrained tool title and descriptive copy, original category stamp, neutral input/output panel headers, lime primary actions and an offset explanatory section with grouped related links. Specialized editors, file previews, tables, calendar controls and forms retain their internal structure.
- **About, Privacy, Terms, Licenses, Site Directory:** editorial heading, bracket-and-arrow graphic, a narrower offset reading column and fine section rules. Site Directory uses compact three/two/one-column links. All legal and informational wording remains untouched.
- **Shared shell:** aligned 68px header, existing logo and illustrated theme switch, lime navigation highlights, a compact footer wordmark and all five existing links. Homepage keeps its larger lime signature.

## Design lineage and original artwork

This work extends the already reviewed homepage references: [Non-Linear Studio](https://www.awwwards.com/inspiration/thumbnail-submission-66847be266d50304322775) informed a recognizable central object and typographic restraint; [Marga Navarro project grid](https://www.awwwards.com/inspiration/draggable-projects-grid-marga-navarro) informed layered planes and selective color; [Marga Navarro crossword](https://www.awwwards.com/inspiration/interactive-about-me-crossword-marga-navarro) informed precise rules, labels and graphic punctuation. Their live interaction technology is not reproduced. See HOMEPAGE_DESIGN.md for the original reference review boundaries.

`StationGlyph.tsx` is original deterministic inline SVG: outlined brackets surround two offset ivory/lilac sheets, a lime connector and the existing Lucide category icon. Reserved 14:9 dimensions prevent layout shift. The entire object is decorative, hidden from assistive technology and pointer events. The original SVG markup is **712 bytes, 327 bytes gzip**; the small category icon reuses the installed icon library. Information-page graphics and workspace stamps use CSS and existing icons. No runtime dependencies, external graphics, fonts, animation JavaScript or rendering engines were added.

## Tokens and motion

See UI_VISUAL_STANDARD.md for the shared token table. Light canvas/ink are `#F6F5F1`/`#151713`; dark reverses them. Secondary text is `#596153`/`#B7BCAF`. Links use olive `#476511` on light surfaces and lime `#D9F975` on dark surfaces. Filled actions always use lime with charcoal text, independently of link tokens. This separation also preserves existing calendar selection contrast. Lilac `#B9ADF2` is confined to illustration.

Semantic error, warning, success and information values are unchanged. Code output colors are unchanged. Generated image pixels, inline color swatches and gradients are untouched; generated SQL ER diagrams retain their prior color variables locally. Theme selection, saved preference, system default and prepaint script are unchanged.

New station artwork is still. Link arrows move only three pixels on hover/focus using a 160ms CSS transition; the existing reduced-motion rule disables transitions. No content is hidden pending animation. The homepage’s existing 800ms entrance remains unchanged, as does the theme control’s existing motion.

## Responsive and accessibility decisions

Station art disappears below 600px so heading, notice and search take priority. Tool titles scale down to 30–38px; the ornamental workspace stamp disappears. Working controls are never duplicated or replaced. The information-page bracket ornament is likewise removed on narrow screens. Tool grids and related entries become one column; wide output/editor scrolling stays owned by those components. No page-level overflow clipping is used.

Measured token contrast: body 16.54:1, light secondary on raised surface 5.53:1, dark secondary 7.09:1, light links 6.14:1, primary action text 15.26:1. Input boundaries measure 3.53:1 light and 4.16:1 dark. These are specific token measurements, not a blanket accessibility certification.

## Preservation and verification

Root layout/provider placement, ToolWorkspace, all processing components, source/session lifecycle, input types/validation, search algorithm and state, registries, route metadata, storage, analytics and package files are unchanged. Only presentation wrappers, CSS and documentation changed, plus the new decorative component and directory completeness tests.

See [site-redesign/VERIFICATION.md](site-redesign/VERIFICATION.md), [comparison gallery](site-redesign/index.html), source hashes and `scripts/verify-site-design.mjs`. No deployment or new station was performed.


## Workbench extension — 2026-10-07

The feature release extends this visual system to Workbench, Settings, Workflows, Batch Images, Feedback and Offline Tools. It adds compact favorite controls, a native search/detection dialog, ruled personal lists and numbered workflow panels. At 320px the header uses two intentional rows; larger mobile screens keep one row. Existing typography, logo, semantic palette and tool previews remain. See [WORKBENCH.md](WORKBENCH.md) for behavior, measurements and verification, and [screenshots](workbench-release/index.html).
