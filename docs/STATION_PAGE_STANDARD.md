# Station Page Standard

Code Station station pages are discovery surfaces over the central tool registry. Each implemented station has one canonical `/stations/<id>` route and keeps its existing category ownership and tool routes.

## Registry and routes

`config/stations.ts` is an explicit allowlist of implemented stations. Membership and counts are derived from real registered tool IDs and deduplicated. A station must not be added merely because a future category appears in metadata; pending stations such as Developer Math remain unrouted until implemented.

`StationLanding({ stationId })` owns the shared server-rendered shell: linked breadcrumbs, station identity, local-processing notice, shared catalog, and related station links. Existing static route modules and the dynamic legacy station route both pass through this component, preserving canonical metadata and existing tool engines/workspaces.

## Discovery components

- `ToolCard({ tool })` renders one canonical link to `/tools/<slug>` from a `ToolDefinition`.
- `ToolCatalog({ name, tools, categoryFilters? })` is the client-side search/filter surface. It always provides a visible Search label, a Clear search button, a non-live result count, and a no-results state. Filtered catalogs also provide Reset filters.
- `lib/tool-search.ts` normalizes whitespace and case, ranks exact/name matches before keyword and description matches, and deduplicates IDs.

Converters are the one filtered catalog: categories and memberships come from `config/conversion-capabilities.ts` through `converterEntries`. This keeps capability discovery separate from tool ownership and never creates duplicate converter identities.

## Accessibility and privacy

Search counts use `aria-live="off"` to avoid announcing every keystroke. Inputs and filter controls have visible labels, are keyboard reachable, and reset without navigation. Catalog processing is client-local; search terms and tool inputs are not persisted, uploaded, or sent to a server.

## Editorial discovery layout — 2026-10-07

StationLanding now uses a split heading and decorative StationGlyph above the existing notice and ToolCatalog. The illustration is removed below 600px so search remains immediate. Catalog entries and related stations use compact ruled rows with fixed square icons. Search state, deduplication, filters, counts and routing remain unchanged. See [SITE_DESIGN.md](SITE_DESIGN.md) for the shared palette and verification.
