# UI System

Code Station renders all 380 tools in 30 stations from one theme. This document covers that theme: tokens, shared primitives, layout models, the canvas contract, and the audit that enforces them. Read it before you change any tool UI.

`docs/UI_VISUAL_STANDARD.md` covers the visual direction (palette roles, typography scale, editorial layouts). This file covers how that direction is implemented and enforced.

## 1. Layer map

The cascade has five layers, from lowest to highest:

| Order | File | Owns |
| --- | --- | --- |
| 1 | `app/styles/tokens.css` | Every design token, plus the `[data-theme="dark"]` overrides. This is the only token file. |
| 2 | `app/styles/controls.css` | The element-level baseline for text inputs, `select`, `textarea`, color, checkbox, radio and range. |
| 3 | `app/globals.css` | Page chrome: shell, header and nav, theme switch, hero, cards, station, directory, workspace, footer. It also holds a small set of shared helpers (see §8). |
| 4 | `components/ui/ui.module.css` | Every shared primitive: panels, buttons, controls, outputs, callouts, tabs, tables, drop zone, canvas. |
| 5 | `components/*.module.css` | Station **layout only** (see §5). |

`app/layout.tsx` imports `globals.css`, which imports `tokens.css` and then `controls.css`.

## 2. Tokens

Components consume tokens with `var(--token)`. They never declare parallel palettes, and they never put `:root` or `[data-theme]` blocks outside `app/styles/`. A future palette change happens in `tokens.css` only.

| Family | Tokens |
| --- | --- |
| Surfaces | `--canvas`, `--surface`, `--surface-alt`, `--elevated` |
| Text | `--ink`, `--secondary`, `--muted` |
| Lines | `--line`, `--line-strong` (there is no `--border`; use `--line`) |
| Accent | `--accent`, `--accent-hover`, `--accent-soft`, `--focus` |
| Filled action | `--action-bg`, `--action-hover`, `--action-border`, `--action-border-hover`, `--action-ink`, `--button-primary-text` |
| Status | `--red`, `--yellow`, `--green`, `--info` |
| Code | `--code`, `--code-ink` |
| Type | `--font-sans`, `--font-mono`, `--text-xs` 12 · `--text-sm` 13 · `--text-md` 15 · `--text-lg` 17 · `--text-xl` 22 · `--text-2xl` 32, `--leading-tight`, `--leading-normal` |
| Spacing | `--space-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 · `-7` 32 · `-8` 40 · `-9` 48, `--space-page`, `--gutter` |
| Control geometry | `--control-h-sm` 36, `--control-h-md` 44, `--control-h-lg` 48, `--control-h-input` 46, `--radius-control` 9 |
| Radii | `--radius-xs` 4 · `-sm` 6 · `-md` 10 · `-lg` 14 · `--radius-pill` |
| Elevation | `--shadow-sm`, `--shadow`, `--shadow-md`, `--shadow-tactile` |
| Z-index | `--z-sticky`, `--z-overlay`, `--z-dialog`, `--z-toast` |
| Motion | `--duration-fast`, `--duration-base`, `--ease` |

**Theme switching.** `components/ThemeToggle.tsx` stores the user's choice under the localStorage key `code-station-theme`. With no stored choice, it follows `prefers-color-scheme`. It writes the result to `document.documentElement.dataset.theme`, and only the `[data-theme="dark"]` block in `tokens.css` changes values.

User content keeps its own colors and never inherits brand coloring. That includes color swatches, images, charts, gradients and generated previews.

## 3. Primitives (`components/ui/`)

Primitives render the same native tags and attributes as before, with no extra focusable wrappers. Import each one per file. Pass explicit `id`s; primitives never call `useId`.

| Primitive | Contract |
| --- | --- |
| `ToolLayout` | `kind="form" \| "file" \| "data" \| "canvas"` renders `<div data-kind>`. `form` is a two-column grid that collapses to one column below 900px. The other kinds stack. It never renders a heading or description, because the page `h1` is the only title. |
| `Panel`, `PanelHeader`, `PanelBody` | A `<section>` with a header strip (`surface-alt`, 14×17px padding, bottom rule), a heading at `level` 2/3/4, and header `actions`. `padded` adds a 17px grid body. |
| `Field`, `Hint` | A sibling `<label htmlFor>` with its control. The hint gets `id="{id}-hint"`. The error gets `id="{id}-error" role="alert"`. Labels never wrap the control. |
| `TextInput`, `Textarea`, `CodeArea`, `Select` | Shared `.control` geometry: 46px inputs, 9px radius, `--elevated` background, `--line-strong` border. `CodeArea` is the dark monospace editor. `Textarea` is the light multiline field. |
| `Checkbox`, `CheckboxGroup`, `RadioGroup`, `RangeInput`, `ColorInput` | Native inputs inside `fieldset`/`legend` with the shared check grid. |
| `Button`, `ButtonLink`, `IconButton` | `variant`: `secondary` (default), `primary` (filled lime `--action-*`), `ghost`, `danger`. `size`: `md` (44px) or `sm` (36px). `Button` defaults to `type="button"`. `IconButton` requires `label`, which becomes the `aria-label`. |
| `OutputPanel`, `OutputText` | Text output is always `<pre tabIndex={0} aria-label="{label} value">`. Copy and Download sit **in the panel header only**. Both are disabled while the output is empty. |
| `DataTable` | A semantic `<table>` with a `<caption>`, column headers and an empty state, inside a horizontal-scroll container. |
| `DropZone` | Drag styling around a real `<input type="file">`, which keeps its accessible name, `accept` and `multiple`. |
| `Tabs` | ARIA `tablist`/`tab`/`tabpanel`. Panels stay mounted, so switching tabs never resets state. |
| `Callout` | `kind` is `error`, `warning`, `info`, `success` or `neutral`. `error` renders `role="alert"`; every other kind renders `role="status"`. |
| `StatusLine` | `role="status" aria-live="polite" aria-atomic="true"`. Use it for copy, download and progress messages. |
| `PrivacyNote`, `EmptyState` | Inert text. Neither contains anything focusable. |
| `CanvasStage`, `CanvasToolbar`, `PreviewFrame` | See §7. |
| `cx` | Joins class names and drops falsy values. |

## 4. Layout model

Each class of tool uses one structure.

| Kind | Structure |
| --- | --- |
| **Form** | Options come first. Input and Output panels sit side by side at ≥900px and stack below that. Primary and reset actions go under the input. |
| **File** | A full-width drop zone, then an options row, then the result panel. The file name and size go in the panel header. Download appears only in the result header. |
| **Data** | A toolbar above a table or preview inside an `overflow: auto` container. Copy and download go in the panel header. |
| **Canvas** | The toolbar sits above a full-width stage. The inspector sits beside the stage at ≥1024px and stacks at ≤900px. Export goes in the toolbar. |

**Grid children rule.** Only panels and other layout columns go inside `ToolLayout kind="form"`. Put page-level notes before or after the grid, outside it. That covers `PrivacyNote`, the page-level `StatusLine`, and alerts. If a full-width note becomes grid child 1, it pushes the panels into the wrong columns. This happened in `CryptoPkiStation` and was fixed in W5.

Mobile behavior, at ≤720px:
- One column with 16px page padding.
- Inputs use a 16px font, which prevents iOS zoom.
- The page never scrolls horizontally. Tables, SVG and code may scroll inside their own container.

## 5. Station CSS is layout-only

A station module may define these:
- Grid and flex structure: `grid-template-columns`, `gap`, `order`, `align-*`.
- Spacing between primitives.
- Container sizing: `max-height`, `overflow: auto`, `minmax(0, 1fr)`.
- Responsive breakpoints.
- Tool-specific content geometry: swatch sizes, preview boxes, canvas display scaling.

A station module must **not** define any of these:
- Its own button, panel, input, select or output colors.
- Its own borders, radii or heights for those controls.
- Its own focus ring.

Use the primitive instead. If a primitive cannot express a need, report it. Do not redefine the primitive locally, and do not edit `ui.module.css` unless you have found a real bug.

Class names that match `/(button|btn|panel)/i` and also exist in another CSS file are flagged as duplicates. If a station needs a local hook, give it a distinct name, for example `.miniAction`, `.keyCopyBtn`, `.pickerButton` or `.runGeneration`.

Some stations have safeguard tests that assert specific CSS text. Keep those strings when you edit the station:

| Test | Requires in the station module |
| --- | --- |
| `config/cron-tools.test.tsx` | `var(--surface)`, `var(--ink)`, `var(--focus)`, `:focus-visible`, `44px`, `@media`, `minmax(0, 1fr)`, `overflow: auto`, `monospace` |
| `config/date-time-contract.test.tsx` | `var(--surface)`, `:focus-visible`, `44px`, `@media`, `minmax(0,` |
| `config/regex-tools.test.tsx` | `@media`, `minmax(0,1fr)`, `min-height: 44px`, `max-height: 320px`, `var(--space-6)` |
| `tests/e2e-homepage-perf.test.ts` | `tokens.compat.css` does not exist; Home CSS has no `--home-*` tokens; `globals.css` keeps the system font stacks |

## 6. Copy and download

- **Copy:** use `useCopy(messages?)` from `components/ui/useCopy.ts`.
  - It returns `{ copy, message, setMessage }`.
  - `copy(value)` writes via `navigator.clipboard?.writeText` and resolves `true` or `false`.
  - The default messages are "Copied to clipboard" and "Copy failed — select and copy manually".
  - Render `message` in a `StatusLine`.
  - Do not call `navigator.clipboard` directly from stations.
- **Download:** use `downloadBlob(content, filename, type = "text/plain;charset=utf-8")` or `useDownload()` from `components/ui/useDownload.ts`.
  - It creates an object URL, clicks a temporary anchor, then revokes the URL.
  - Everything stays local. There is no network and no persistence.

## 7. Canvas contract

1. **Backing-store dimensions do not change.** Pointer math and `toDataURL` depend on them, for example `AudioStation` at 700×120 and `PdfStation` at 600×220.
2. **Display scaling.** Canvases use `max-width: 100%; height: auto`. When a canvas is displayed smaller than its backing store, drawing handlers must scale pointer coordinates by `canvas.width / rect.width` and `canvas.height / rect.height`.
3. **SVG stages** keep their `viewBox`, their existing zoom state and their serializer. The stage adds the shared frame, not new geometry.
4. **HTML previews** go through `PreviewFrame`, which keeps the caller's exact `iframe` attributes (`title`, `sandbox`, `src`/`srcDoc`). It adds no scripts.
5. **Frame:** `CanvasStage` takes `kind` (`bitmap`, `svg` or `html`), `label`, and optionally `ratio`, `minHeight`, `background` (`grid` by default, or `plain` or `checker`), `toolbar` and `footer`. The caller owns the geometry.
6. **Toolbar order** is always: zoom out, percentage, zoom in, Reset, then the tool's own actions such as export. Zoom runs from 50% to 200% in 10% steps, and Reset returns to 100%. Buttons that did not exist before are never invented; existing handlers are passed in.

## 8. Remaining shared globals in `app/globals.css`

**Removed in W6. Do not reintroduce these:** `.button`, `.button.primary`, `.panel`, `.panel-head`, `.output`, `.tool-layout`, and every compound selector built on them. Use `Button`, `Panel`, `OutputText` and `ToolLayout` instead.

These globals still have consumers and stay until those consumers migrate:

| Global | Current consumers |
| --- | --- |
| `.actions` | `ToolLauncher`, `WorkbenchSettings`, `OfflineSettings` |
| `.privacy`, `.error`, `.muted` | `TextStation`, `RegexStation`, `RangeGenerator`, `ExtendedStation`, `ToolHelp`, page sections |
| `.option-grid`, `.check-grid` | `TextStation`, `RegexStation`, `RangeGenerator` |
| `.generator-layout`, `.generator-options` | `RangeGenerator` |
| `.workbench-panel`, `.setting-row`, `.field-label` | Feature pages: `/settings`, `/feedback`, `/offline`, and `ToolHelp` |
| Bare `textarea` element rule | The dark code-area baseline for any `textarea` that has no primitive class. Primitive classes override it. |

## 9. Audit: `npm run audit:ui`

`scripts/audit-ui.mjs` has no dependencies. It scans every CSS file under `app/` and `components/`.

**Errors (the audit fails):**
1. A `var(--x)` reference where `--x` is not defined in `app/styles/tokens.css` and not declared locally.
2. A `:root` or `[data-theme]` custom-property block outside `app/styles/`.

**Warnings (advisory; `--strict` turns them into errors):**
- Raw hex colors outside the allowlist. The allowlist is `tokens.css`, `globals.css`, `Home.module.css` and `SqlErDiagram.module.css`.
- Media-query breakpoints other than 1200 / 1024 / 900 / 720 / 560.
- Class names matching `button`, `btn` or `panel` that are duplicated across CSS files.

**Rules:**
- A UI change must keep the audit at 0 errors.
- It must not add allowlist entries.
- It should not add warnings.

After W6 the audit reports 0 errors and 24 advisory warnings. All of them are pre-existing raw-hex or breakpoint warnings; there are no duplicate warnings.

## 10. Frozen and out-of-scope files

Freeze these until their earlier acceptance is redone: `components/GitStation.tsx`, `components/GitStation.module.css`, `components/CommandPalette*`, and `lib/command-palette/*`.

UI work never changes any of these:
- `lib/tools/*` processing logic
- workers
- WebMCP (`lib/webmcp/*`)
- API routes
- the registries (`config/*-tools.ts`, `config/tools.ts`, `config/stations.ts`)

## 11. Checklist for a new or changed tool UI

1. Pick the `ToolLayout` kind and compose it from `Panel`, `Field`, the controls and `OutputPanel`. Keep `PrivacyNote` and the page `StatusLine` outside the form grid.
2. Do not add a station-level `h1` or `h2` title or description. The route page renders the `h1`.
3. Use `useCopy` and `downloadBlob`. Put copy and download in the output panel header.
4. Keep the station CSS layout-only, and keep any safeguard strings listed in §5.
5. Keep contracts intact:
   - `name` and `id`
   - label association
   - DOM order and tab order
   - `role` and `aria-describedby`
   - the `<pre aria-label="{label} value">` output
   - the `data-webmcp-tool`, `data-webmcp-category` and `data-webmcp-slug` attributes
6. Run the gates:
   - `npx tsc --noEmit`
   - `npm run audit:ui`
   - `npm run lint` (existing warnings only)
   - `npm test`
7. Check in a real browser at 1440px and 390px, in light and dark themes. Confirm:
   - the page never scrolls horizontally
   - there are no console errors
   - `ui` buttons are 44px (36px for `sm`)
   - the focus ring is a 2px `--focus` outline
   - no legacy class nodes appear (`.panel`, `.button`, `.panel-head`, `.output`, `.tool-layout`)

### Known exceptions

A few dense controls are intentionally compact and fall below 36–44px:
- DevMath `.miniAction`
- the Policy generator format tabs and inline actions
- the WorkflowBuilder preset chips and step icon buttons

They are recorded here so they are not mistaken for regressions. Raising them to 44px is a separate design decision.
