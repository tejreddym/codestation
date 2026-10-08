# Code Station homepage reinvention

Implemented 2026-10-07. This document supersedes older homepage-specific composition guidance; shared tool styling and contracts still follow UI_VISUAL_STANDARD.md and SMART_CONVERTER_STANDARD.md.

## Composition and component plan

The prior left-copy/right-illustration hero and repeated tall cards are replaced with a centered editorial opening, a shallow original assembly, compact quick-access rows, a 1.4:1:1 illustrated showcase, and a ruled station index beside a narrow introduction. A bracket-led processing note and lime wordmark footer close the page. The same six featured registry entries supply quick access; all 15 stations retain registry order, descriptions, routes, unique counts, and availability. Developer Math stays pending and unrouted.

`app/page.tsx` owns presentation and the existing query state. `app/Home.module.css` owns homepage tokens and responsive layouts. `components/HomeGraphics.tsx` contains four deterministic inline SVGs. The shared footer retains every existing link and its original informational sentence; an additional closing line and enlarged existing wordmark appear only beside the homepage. The header component and logo are untouched, with homepage-only surrounding styles. Root providers, keys, metadata, theme prepaint, storage and routes are untouched.

## References reviewed

All three Awwwards pages and their still images were accessible and visually inspected. Their live interactive sites were not reproduced or evaluated.

- [Non-Linear Studio desktop](https://www.awwwards.com/inspiration/thumbnail-submission-66847be266d50304322775): adapted the idea of a sculptural central object giving a restrained typographic page identity. No 3D engine, branded artwork, repeated-text backdrop or full composition was copied.
- [Marga Navarro project grid](https://www.awwwards.com/inspiration/draggable-projects-grid-marga-navarro): adapted layered planar shapes and selective colored surfaces in the image and color previews. No draggable navigation or carousel.
- [Marga Navarro crossword](https://www.awwwards.com/inspiration/interactive-about-me-crossword-marga-navarro): adapted precise grids, small monospace labels and playful graphic punctuation in the assembly table and bracket motif. No crossword, cursor replacement or hidden content.

## Graphics and motion

Station Assembly combines two lime sculptural braces, an ivory data sheet, a lilac image frame, a small table and a lime connector. Consistent outlines, offset faces and one flat shadow create depth without filters, rendering libraries or remote assets. Three smaller previews illustrate JSON formatting, PNG to WebP and color conversion; their links resolve canonical registry tools. These are inert illustrations, not embedded controls or result claims.

The artwork uses a reserved aspect ratio and decorative SVG semantics (`aria-hidden`, `focusable=false`, pointer-events none). The mobile SVG crop gives the core objects more room while simplifying the side rule/caption. CSS settles objects over 650ms with delays through 130ms; the connector finishes at 800ms. No added animation JavaScript, perpetual animation, remote font, runtime dependency, video or image request. Reduced motion removes the entrance and link movement. The existing illustrated theme toggle is preserved, including its existing reduced-motion rules.

## Theme tokens and isolation

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | #F6F5F1 | #151713 |
| Text | #151713 | #F6F5F1 |
| Secondary | #596153 | #B7BCAF |
| Surface | #FFFFFF | #20251D |
| Raised | #EEEEE7 | #292F24 |
| Rules | #D3D6CA | #3B4435 |
| Search boundary | #838B7B | #7D8773 |
| Focus | #476511 | #D9F975 |
| Filled emphasis | #D9F975 / dark text | #D9F975 / dark text |

Lilac #B9ADF2 appears only in decorative vectors. Homepage CSS uses local module selectors and relational scoping for the existing header/footer. No shared semantic error/warning/success/info token or user-generated color is recolored. The existing Arial/Helvetica/system monospace stacks remain.

## Responsive and search decisions

At wide widths, quick access has two columns and the directory has two columns beside its intro. At 800px the data showcase spans both columns, and the station intro moves above the list. At 600px all showcases and station entries stack in DOM order. The header retains its existing Menu/Close control and destinations. No interactive component is duplicated and no page-level clipping is added.

The original input deliberately still omits `type` (browser default `text`), with the same ID, label, autocomplete, value and change handler. Search continues to use `searchTools(tools, query)` and original query state. Results are normal links reached with Tab/Enter; no command shortcut or arrow-key selection existed in the baseline, and none was invented. The decorative stage collapses during nonblank searches to place inline results immediately after the stable input. Original no-result Clear behavior is retained.

## Verification

See [the verification record](homepage-redesign/VERIFICATION.md), the before/after screenshots in that directory, and repeatable `scripts/verify-homepage.mjs`. This is local implementation only; no deployment or rewards claim.

## Site-wide follow-up — 2026-10-07

The user subsequently requested the same identity across all other pages. [SITE_DESIGN.md](SITE_DESIGN.md) now governs the shared shell and tokens. The footer closing sentence and a smaller wordmark are visible site-wide; the homepage retains its larger lime treatment. Header logic, homepage search, artwork and composition remain unchanged. This supersedes the earlier homepage-only styling boundary; it does not authorize tool-engine or new-station work.
