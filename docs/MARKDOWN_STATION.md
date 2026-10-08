# Markdown Station

18 local Markdown workflows at `/stations/markdown`, registered through `config/markdown-tools.ts` and lazy-loaded by `ToolWorkspace`.

Markdown↔HTML directional routes use the shared capability registry and memory-only source session. Output selection is route-backed; HTML/Markdown source is never placed in history or storage and sanitized output remains inert.

The engine is a bounded native parser. It supports headings, paragraphs, emphasis, links/images, lists, blockquotes, fenced code, task markers and simple pipe tables. Preview and Markdown-to-HTML return sanitized HTML source as inert text; the app never injects returned markup as application HTML. Scripts, styles, event handlers, unsafe URL schemes, embeds and external resources are blocked or removed. HTML-to-Markdown ignores unsafe/script/style content and performs common safe tag conversion. No link/image is fetched.

TOC slugs are stable and duplicate-safe; heading warnings are guidance, not validity claims. Frontmatter recognizes only leading YAML fenced by `---`; malformed YAML errors. Code fences grow beyond the longest backtick run. CSV/table/list/task generators preserve order and escape pipes where applicable. Statistics and extractors are local and bounded. Inputs and results are component memory only; no analytics, storage, uploads or logs.

## Verification

Automated Markdown gate: typecheck passed; engine and registry tests passed **31 tests / 2 files**. Full-suite verification follows the final three-station build. Live browser could not be resumed because the prior tab closed and opening a new localhost tab timed out; Markdown station controls, processing, copy/clear, themes, mobile, console and preview are **NOT VERIFIED**. Native tests do not replace browser sanitization/CSP evidence.

Final repository verification passed `npm test` (**5,205 tests / 72 files**), `npm run typecheck`, and `npm run build`. A production HTTP smoke check returned200 for `/stations/markdown` and representative Markdown/tool routes. The browser tab could not be reopened, so this is not live browser proof.
