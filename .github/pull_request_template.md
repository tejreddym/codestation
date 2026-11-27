## Summary

<!-- Briefly describe what this PR adds or fixes, and link any related issue (e.g. Closes #123). -->

## Type of Change

- [ ] Bug fix (non-breaking change addressing an issue)
- [ ] New browser tool / station addition
- [ ] Enhancement / refactoring
- [ ] Documentation / repository maintenance

## Architectural & Privacy Checklist

- [ ] Processing runs 100% client-side in the browser (zero uploads, analytics payloads, `eval`, or remote proxies)
- [ ] Tool slugs strictly match (`id === slug` in lowercase kebab-case, route `/tools/[slug]`, WebMCP `codestation_[snake_case_slug]`, `data-webmcp-slug`) *(if adding/updating a tool)*
- [ ] Registries, station counts, `components/DocsRepo.tsx`, `public/llms.txt`, and `lib/webmcp/dispatcher.ts` are updated *(if adding/updating a tool)*
- [ ] Warm Tactile Technical tokens in `app/styles/tokens.css` / `app/globals.css` are preserved
- [ ] `PROJECT_STATUS.md`, `HANDOFF.md`, and `TODO.md` updated if project state changed

## Local Verification

Please verify the following commands locally (Node `>=22.13.0 <23`):

- [ ] `npm run typecheck` passed cleanly
- [ ] `npm run audit:ui` passed with `0` errors
- [ ] `npm test` passed all relevant and contract test suites
- [ ] `npm run build` passed (with any active dev/preview server stopped)
- [ ] `npm run lint` checked (no new errors/warnings introduced)
