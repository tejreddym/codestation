# UI Visual Standard

Code Station's visual layer is presentation-only. It may improve hierarchy,
spacing, color, typography, borders, shadows, responsive placement, and
decorative artwork without changing tool contracts or state behavior.

## Palette and semantic tokens

The shared tokens live in `app/globals.css` and switch with the existing
`data-theme` attribute:

| Role | Light | Dark |
| --- | --- | --- |
| Page canvas | `#F6F5F1` | `#151713` |
| Main surface | `#FFFFFF` | `#20251D` |
| Raised/subtle surface | `#EEEEE7` | `#292F24` |
| Divider | `#D3D6CA` | `#3B4435` |
| Main text | `#151713` | `#F6F5F1` |
| Secondary text | `#596153` | `#B7BCAF` |
| Link / focus | `#476511` | `#D9F975` |
| Filled action / text | `#D9F975` / `#151713` | `#D9F975` / `#151713` |
| Amber state/highlight | `#B45309` | `#FBBF24` |

Use `--accent` for links, selected states and focus; it is olive on light surfaces to maintain contrast. Use `--action-bg`, `--action-hover` and `--action-ink` for filled primary buttons. Keep `--button-primary-text` paired with `--accent` for existing calendar selection states. Keep `--yellow`, `--green`, `--red`, and
`--info` semantically distinct. User-generated swatches, images, charts,
gradients, and generated output must not inherit global brand coloring.

## Typography and geometry

- Use the existing local system stack; do not add remote font requests.
- Homepage headings retain their 36–80px scale. Station/directory titles cap at 64px; tool titles cap at 48px, with 30–38px mobile titles. Information headings cap at 68px.
- Body copy stays near 15–17px with readable line height. Code and generated
  output use the existing monospace stacks.
- The spacing scale is 4, 8, 12, 16, 24, 32, 48, and 64px.
- Containers use the shared `.shell`; long-form pages use narrower prose
  columns and tool workspaces may use two balanced columns.
- Discovery uses compact ruled rows with always-visible descriptions. Workspace panels use neutral header strips and modest corners; no hover lift on working controls. Do not use rainbow borders or fake metrics.

## Shared layouts

- `SiteHeader` and `SiteFooter` provide global navigation and preserve the
  existing theme control and mobile-menu behavior.
- `StationLanding` provides the canonical station breadcrumb, identity,
  local-processing notice, catalog, and related stations.
- `ToolCatalog` provides the existing local search, category filters, counts,
  clear/reset actions, and empty state. Visual wrappers must not change its
  matching or navigation behavior.
- `ToolCard` and station cards retain link semantics and use visible title,
  description/count, category, and focus states.
- Tool workspaces retain specialized layouts for editors, images, files,
  tables, generators, and inspectors. Editable input and readonly output use
  distinct surface treatments.

## Controls and accessibility

Presentation changes must preserve native control types and attributes. Do not
replace inputs, selects, checkboxes, radios, ranges, file inputs, textareas,
or editors with new widgets. Keep existing labels, error associations,
button types, keyboard behavior, resize behavior, and scrolling behavior.

Ordinary single-line controls target a 44–48px touch height and 16px text on
mobile. Native arrows, steppers, color controls, file affordances, and range
tracks remain usable. Focus is visible with `--focus`; state is never conveyed
by color alone. Motion is limited to short transitions and respects
`prefers-reduced-motion`.

## Responsive rules

Use content-driven grids and `min-width: 0`. The target widths are 320, 375/390,
768, 1024, and 1440px. The page must not overflow horizontally. Legitimate
scrolling belongs inside editors, long outputs, and wide tables. Do not use
page-level overflow clipping to conceal layout defects, and do not render
duplicate desktop/mobile inputs.

## Presentation-only boundary

UI enhancements must preserve control types, validation, event behavior,
routes, and tool/session state. Use the shared visual tokens and components.
Functional changes require a separate task. This includes conversion engines,
parsers, defaults, processing, uploads, clipboard/download behavior, history,
network/storage boundaries, metadata, sitemap XML, and robots behavior.

## Page inventory

The current application includes the homepage, `/tools` directory, and these
15 implemented station landings: `/stations/json-data`,
`/stations/encoding`, `/stations/security`, `/stations/regex`,
`/stations/date-time`, `/stations/text`, `/stations/cron`,
`/stations/sql-database`, `/stations/web`, `/stations/api`, `/stations/image`,
`/stations/spreadsheet`, `/stations/markdown`, `/stations/color-css`, and
`/stations/converters`. It also includes registry-driven `/tools/[slug]`
pages and the specialized lazy workspace families (JSON & Data, Encoding,
Security, Regex, Text, Date & Time, Cron, SQL & Database, Web, API, Image,
Spreadsheet, Markdown, Color & CSS, and numeric Converters), About, provisional
Privacy and Terms, Licenses, Site Directory, robots, and XML sitemap metadata
routes.

No Contact, Accessibility, `not-found`, `error`, or `loading` route was found
in the inspected project. Developer Math remains pending and is intentionally
not included in this inventory's implemented station count.

## Site-wide identity — 2026-10-07

The latest user request extends the homepage identity across all existing pages. See [SITE_DESIGN.md](SITE_DESIGN.md) for distinct station, grouped directory, workspace and information layouts. Homepage composition remains in [HOMEPAGE_DESIGN.md](HOMEPAGE_DESIGN.md). Shared tokens now use the same ivory/charcoal/lime foundation; lilac stays inside decorative illustrations. Status colors, code colors, generated image/color values and ER diagram colors are retained. The smaller shared footer signature complements the homepage’s larger lime footer.
