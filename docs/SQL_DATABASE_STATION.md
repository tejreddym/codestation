# SQL & Database Station

Implemented 2026-10-05. Scope: **17 SQL & Database tools** and `/stations/sql-database` only. No SQL execution, database connections, credential testing, SQLite file access or remote query processing. No Web or other subsequent station implementation.

## Audit, discovery and UI

No existing SQL tools, parser, shared SQL editor or database connection service existed. The implementation follows Cron’s central-registry/lazy-workspace architecture and existing tactile tokens, station mark, cards, search and theme toggle. No implemented AdSlot, analytics or Pro/account abstraction was found; none was invented.

- `config/sql-tools.ts` contributes exact `sqlContract` definitions to `config/tools.ts`: IDs, slugs/routes, descriptions, input/output types, keywords, dialect metadata, examples/actions and related tools. No reciprocal-direction metadata is imposed on lossy conversions.
- `config/stations.ts` derives the station ID `sql-database`, exact description, existing icon, tool list/count and related JSON & Data/Text/Cron stations. Existing station routes remain unchanged. Homepage discovery already consumes that registry; sitemap includes the new landing.
- `app/stations/sql-database/page.tsx` / `components/SqlDatabaseCatalog.tsx` provide the requested title/description, local search, all 17 cards, no-results feedback and related station links.
- `components/SqlDatabaseStation.tsx` / `.module.css`: exact labeled controls, stable IDs, error associations, explicit actions, safe monospace text results, Copy where contracted, Clear and CSV-only Download. Validator and connection parser follow their specified no-Copy action sets. No upload, query execution, schema browser or extra connection fields.
- `components/SqlStructuredFields.tsx` / `.module.css`: controlled column, typed row, assignment, condition and ordering editors. Value types are String/Number/Boolean/NULL; IN lists accept multiple typed values and null-test operators show no value control. Adding/removing columns explicitly reconciles aligned row cells; unrelated cells are retained. Empty SELECT columns mean `*`. Builders stack into labeled cards on narrow layouts.
- `components/SqlErDiagram.tsx` / `.module.css`: safe SVG diagram, declared-only arrows, external-reference nodes, zoom/scroll and full textual schema alternative. Visual labels and nodes over 12 columns are abbreviated with an explicit full-structure notice; no data is silently dropped from the textual result.
- Shared route shell adds SQL-only canonical/index metadata and short purpose/usage/limitations/related content. No global CSS or animated-theme-toggle edits.

## Exact public contracts

All routes below are `/tools/<slug>`.

| Slug | Inputs | Outputs | Primary action |
|---|---|---|---|
| sql-formatter | SQL text, SQL dialect | Formatted SQL | Format |
| sql-minifier | SQL text, SQL dialect | Minified SQL | Minify |
| sql-validator | SQL text, SQL dialect | Valid/Invalid status, Syntax error message, Error location | Validate |
| json-to-sql | JSON array of objects, Table name, SQL dialect | SQL INSERT statements | Convert |
| sql-to-json | SQL INSERT statements, SQL dialect | JSON array of objects | Convert |
| csv-to-sql | CSV text, Table name, SQL dialect | SQL INSERT statements | Convert |
| sql-to-csv | SQL INSERT statements, SQL dialect | CSV text | Convert |
| sql-to-markdown | SQL INSERT statements, SQL dialect | Markdown table | Convert |
| sql-insert-generator | Table name, Column names, Row values, SQL dialect | SQL INSERT statement | Generate |
| sql-update-generator | Table name, Column/value assignments, WHERE conditions, SQL dialect | SQL UPDATE statement | Generate |
| sql-delete-generator | Table name, WHERE conditions, SQL dialect | SQL DELETE statement | Generate |
| sql-select-builder | Table name, Selected columns, WHERE conditions, ORDER BY, Limit, SQL dialect | SQL SELECT statement | Generate |
| sql-where-builder | Conditions, Logical operator, SQL dialect | SQL WHERE clause | Generate |
| database-connection-string-builder | Database type, Host, Port, Database name, Username, Password, Parameters | Connection string | Generate |
| database-connection-string-parser | Connection string | Database type, Host, Port, Database name, Username, Masked password, Parameters | Parse |
| er-diagram-generator | CREATE TABLE SQL, SQL dialect | Entity relationship diagram, Parsed tables, Columns, Primary keys, Foreign-key relationships | Generate |
| sql-escape-helper | Value, Value type, SQL dialect | Escaped SQL literal | Escape |

Copy copies the exact visible textual result, including whitespace/newlines. Clear removes fields/results/errors and restores initial option defaults; structured lists become empty. Only SQL Insert to CSV offers Download CSV (`sql-inserts.csv`, UTF-8, local Blob URL revoked afterward). No fake or universal Download controls.

## Libraries and engine boundary

Added exact production dependencies **`node-sql-parser@5.4.0`** and **`sql-formatter@15.9.0`**; updated lockfile and successfully ran `npm ci`. No database driver, ORM, SQL execution library, editor framework or diagram dependency was added.

- `lib/tools/sql/types.ts`: dialect, literal and condition constants/types.
- `literals.ts`: shared runtime dialect validation, identifier quoting and SQL scalar serialization.
- `lexer.ts`: bounded source-preserving tokens, quoted strings/identifiers/comments and sanitized locations.
- `parser.ts`: lazy per-dialect parser adapters (`postgresql`, `mysql`, `sqlite`, `transactsql`), never a global all-dialect import.
- `transforms.ts`: lazy formatter, conservative minifier, parser validation, strict literal INSERT extraction and JSON/CSV/Markdown output.
- `ddl.ts`: exact CREATE TABLE subset and PK/FK extraction; no column-name-based relationships.
- `builders.ts`: typed generators, conditions and strict JSON/CSV conversion. Reuses unchanged JSON & Data parsers for duplicate-key/number-precision and RFC-style CSV handling.
- `connections.ts`: local URI/ADO.NET construction and redacted inspection, with no connection APIs.
- `engine.ts`, `client.ts`, `workers/sql.worker.ts`: bounded dispatch, output checks and cancellable disposable worker.

Parser/formatter/INSERT extraction/DDL tools **always require a local Worker**; no unsafe main-thread or server fallback. Smaller generators/connections run locally; larger workloads are offloaded when aggregate text exceeds 16,384 units or inspected structure exceeds 1,000 nodes. Worker deadline: **15 seconds**, terminating on response/error/timeout/edit/Clear/unmount. No accepted partial result after timeout.

## Dialect and conversion conventions

All dialect controls contain exactly PostgreSQL, MySQL, SQLite and SQL Server. The choice changes parser/formatter language, identifier quoting, string/Boolean encoding and SELECT limit syntax. SQL Server uses bracketed identifiers, `N'…'` strings, Boolean `1`/`0` and `TOP (n)`; PostgreSQL/SQLite use double-quoted identifiers; MySQL uses backticks. Other dialects use TRUE/FALSE and LIMIT. Database session modes and collations are not inspected.

- PostgreSQL string encoding assumes `standard_conforming_strings=on`. MySQL assumes default backslash escapes and ANSI_QUOTES off. SQL Server assumes quoted identifier behavior as disclosed. Manual encoding is informational: **“Escaping values is not a substitute for parameterized queries.”** Prefer parameterized queries/prepared statements in real applications.
- Generated identifiers are raw letter/underscore-start names with letters/marks/numbers/underscore/`$`, always quoted. Unsafe punctuation is rejected. Limits: PostgreSQL 63 UTF-8 bytes, MySQL 64 characters, SQLite/SQL Server 128 UTF-16 units. Qualification is bounded to PostgreSQL three parts, MySQL/SQLite two and SQL Server four. PostgreSQL preserves case-distinct quoted column names; other dialects conservatively reject case-insensitive duplicates.
- Scalar types never accept arbitrary SQL expressions. Apostrophes, MySQL backslashes and SQL Server Unicode prefixes are encoded centrally. NULL remains NULL; nonfinite/malformed numeric tokens, NUL strings and unpaired surrogates fail. Typed decimal tokens preserve their supplied spelling instead of being rounded through JavaScript.
- JSON requires a nonempty array of flat objects with identical key sets; column order comes from the first record and later key order is aligned. Nested values, duplicate keys and unsafe numeric precision are rejected rather than inferred/stringified/rounded.
- CSV uses its first row as unique valid headers; remaining rectangular rows are preserved in order. All CSV values, including `NULL`, numbers, booleans and blanks, are **strings**—no hidden type/null guessing.
- INSERT extraction supports explicit-column literal VALUES, single/multi-row and multiple statements with the same exact table and ordered columns. Expressions, defaults, casts, INSERT SELECT, upserts/conflict clauses, RETURNING, modifiers, missing column lists and heterogeneous statements are rejected. Supported PostgreSQL E/dollar/newline-continuation strings and MySQL escapes are decoded from raw tokens, not a normalized AST. Numeric conversion to JSON rejects representational precision loss. SQL Server 1/0 is numeric data, not an inferred Boolean without schema information.
- SQL→CSV emits NULL as an unquoted empty cell and empty strings as quoted empty cells; many readers discard that distinction. CSV is not a lossless typed inverse of SQL. Markdown escapes backslashes/pipes and represents newlines as `<br>` in inert text; it is not rendered as user HTML.
- UPDATE and DELETE with no conditions remain generatable, but display the exact prominent all-row warning. No WHERE is invented. Multiple conditions in UPDATE/DELETE/SELECT use AND; only the standalone WHERE Builder has the contracted AND/OR choice. IS NULL/IS NOT NULL require no values; IN/NOT IN require a nonempty list; NULL equality is rejected in favor of the null-test operators.
- SELECT’s empty columns mean `*`; ordering and positive limit 1–1,000,000 are optional. No offsets, joins, expression columns or raw WHERE text were invented for these structured tools.

## Parser, formatter and DDL limitations

`node-sql-parser` acceptance is a **subset**, not compatibility certification. Validator uses the selected parser and reports sanitized first errors/line-column when available. **“Syntax validation does not verify tables, columns, permissions, or database state.”** It never checks real schema semantics or executes statements.

Formatter preserves surviving source token spelling, including strings/quoted identifiers; it refuses token-changing transformations. Parser-detected invalid ordinary syntax errors rather than being prettified as success. Known protected comments/nested-comment or PostgreSQL adjacent-newline-string extensions can receive conservative layout output with an explicit non-validation warning. The formatter’s PostgreSQL newline-sensitive string separator is restored from the original source.

Minifier conservatively reduces layout whitespace and removes ordinary comments while retaining token boundaries. Executable MySQL comments/hints and PostgreSQL newline string continuation remain. SQL Server retains newline separators where required. Some output therefore remains multiline; semantic preservation takes precedence over maximum compression.

DDL accepts bounded named CREATE TABLE definitions with declared columns/types, inline/table primary keys and explicit inline/table/composite foreign keys. It rejects unsupported ALTER/table options/constraints instead of discarding them. Locally supplied referenced columns are checked; external references stay explicitly labeled. Similar names such as `user_id` create no relationship.

`node-sql-parser@5.4.0`’s SQL Server REFERENCES grammar is limited. ER parsing uses a strict native FK grammar and validates remaining definitions with the SQL Server parser; Validator may reject otherwise valid SQL Server REFERENCES syntax as outside its parser subset. This workaround is not a full T-SQL parser. Database-specific types, indexes, CHECK/default expressions and constraints remain bounded by the selected parser/DDL subset. No cardinality or relationship is inferred from data/names.

## Connection-string privacy and representations

Builder database types are PostgreSQL, MySQL and SQL Server only. PostgreSQL/MySQL use URI representations with percent-encoded user/password/database/parameters. SQL Server uses quoted ADO.NET `Data Source`, `Initial Catalog`, `User ID`, `Password` entries, correctly handling doubled quotes and embedded semicolons. No named-instance, integrated-auth or unrestricted driver representation is promised.

Host/database/username are required; password may be empty. Blank port uses explicitly disclosed defaults 5432/3306/1433; supplied ports must be 1–65535. Parameters accept newline `key=value` or `?query` syntax; duplicates and core-field overrides are rejected. Local URL parsing never performs DNS/network requests.

Connection parser input is password-masked. Results **always** use `••••••••` for password, never expose its length or raw value, and additionally redact credential-like parameters and nested credential URLs. Only parsed non-password fields are shown; no raw connection-string result, Copy or download is offered by this parser. Malformed format/encoding/ambiguous core aliases produce generic UI errors without raw credentials or parser stacks.

Builder output necessarily contains the encoded password the user asked to generate; its warning states this and Copy is explicit. Inputs/results live only in component/local-worker memory, never requests, analytics, logs, storage, page URLs/search parameters or history. Clear/unmount release references, but JavaScript does not promise secure memory erasure. Browser password managers and explicit OS clipboard retention are outside application guarantees.

## Resource limits

- 200,000 UTF-16 units per input string; 1,000,000 combined input units.
- Preflight: 25,000 inspected structural nodes and depth 16; lexical SQL: 50,000 tokens, nesting 128 and 200 statements.
- Complete output budget: 2,000,000 units, including structured schema payload; overflows error, not truncate.
- Generators: 100 columns/assignments/conditions/order entries, 1,000 data rows and 100 IN values per condition.
- INSERT extraction: 500 columns and 10,000 rows, further bounded by input/output budgets.
- DDL: 50 tables, 500 total columns and 200 declared foreign-key relationships. Diagram scroll/zoom stays inside its panel; full text remains available.
- Connection parameters: 100 entries; host syntax/length and control/Unicode validity checked. Unsupported worker permission/capability or library syntax is an explicit error.

## Actual verification and scope evidence

Baseline: `git status --short` confirmed **no Git repository**. Typecheck, **2,978 tests / 38 files**, and production build passed. The verified active workspace preview was stopped before building; generated `.next` was never rebuilt under an active server.

- `npm ci`: **passed**, reproducing the updated lockfile.
- `npm run typecheck`: **passed**.
- `npm test`: **3,420 tests / 42 files passed**. New SQL suites: **424 tests** (283 engine, six client, 112 component, 23 registry/landing). The unchanged all-tool/category breadcrumb matrix additionally discovers 18 new cases. One Cron catalog test’s expectations were intentionally updated for the added station; Cron implementation is unchanged.
- Engine coverage includes all 17 examples in every applicable dialect, empty/invalid/Unicode/reasonable-large input, unsafe identifiers/numbers/JSON precision, SELECT/INSERT/UPDATE/DELETE/JOIN/subqueries/CTEs/comments/string keywords, conservative minification, invalid locations, actual dialect-specific parser acceptance and limits, literal round-trips, INSERT-only rejection, CSV/Markdown quoting, all WHERE operators/AND/OR/null/IN, all-row warnings, explicit limits and SQL Server TOP. DDL covers single/multiple/composite/inline/external keys, no inferred links, missing local columns and malformed/unsupported statements. Connections cover all three representations, special characters/encoding, IPv6, malformed/ambiguous values, password/parameter masking and rejected overrides.
- UI checks exercise all 17 tools under light/dark DOM attributes, exact fields/options/actions, keyboard submit/Copy/Clear/tab order, empty/error/oversized input, no fetch/XHR/storage/log calls and 17 stable SSR-hydration cases. Additional checks cover structured row-column reconciliation, typed IN and NULL conditions, visible warnings, dialect changes, masked source/results, declared-only SVG/text/zoom, stale-worker cancellation, XSS-safe text and clipboard denial. Download tests inspect the **actual Blob text**, filename, local link and URL revocation. These jsdom checks are not visual or real-browser clipboard/worker proof.
- Client tests verify mandatory parser workers, bounded small local work, preflight limits, 15-second timeout, cancellation, termination and recovery; worker transport in UI tests is synthetic.
- `CI=1 npm run lint < /dev/null`: **exit 1 / blocked**, due to pre-existing missing ESLint configuration and deprecated `next lint`. Build’s “Linting” label does not establish a standalone pass. No unrelated lint migration performed.
- `npm run build`: **passed**; **183 prerendered tool URLs / 192 total generated pages**, including both Cron and SQL landing pages.
- `node scripts/verify-sql.mjs`: **passed** all **17 production pages**, exact emitted controls/defaults/password types, unique metadata/index/canonicals, station search/card markup, homepage/sitemap, **25 navigation links**, **10 page scripts** and **seven completed-station routes** (JSON/Data, Encoding, Security, Regex, Date/Time, Text, Cron).
- Compiled-worker VM/thread checks executed all 17 examples plus every applicable example in all four dialects, generated Unicode/literal→INSERT→JSON round-trips, invalid validation, SQL Server connection masking/redacted parameters and declared-only ER output. **11 worker/library assets** served. This is emitted-code evidence, not live-browser execution, CSP or console proof.
- Scope check: **129 protected pre-existing source hashes unchanged**; the one excluded baseline file is the intentionally updated `config/cron-tools.test.tsx` discovery fixture. **All 166 non-SQL runtime tool entries unchanged**. Existing engines/components/theme/global CSS preserved; shared edits only integrate SQL routing/metadata/station discovery/sitemap. No other requested-excluded station was implemented.
- Source privacy/unsafe-execution scan passed across **15 new UI/processing files**: no content network/log/storage calls, eval/Function or unsafe HTML insertion. No database driver/executor/proxy added.

Temporary local verification snapshot: `/private/var/folders/69/l4j48t2j7pd9npmrwgw19ldc0000gn/T/opencode/sql-scope-08N7En/`. No branch, commit, push or deployment exists.

On resuming, the previous preview had stopped: the first production-script retry returned connection refused. It was restarted and the complete script passed again; no failed check is counted as a pass without that successful rerun.

## Browser acceptance — partial, not complete

Initial browser opening timed out. On resuming, tab `tab_muuz6axj_f` successfully loaded `/stations/sql-database` and `/tools/sql-formatter`. Fresh observations/screenshots confirm the real 17-card landing, title/description/search, SQL editor/dialect controls, metadata/labels and narrow **310×444 light** layout. No website tools were registered.

Load example returned `browser_operation_failed`; a fresh observation followed without automatically repeating the action. No browser processing/result, Copy/Clear/download, live console or all-17-tool visual acceptance is claimed. Screenshots still show the pre-existing shared header clipping/overflow at 310 px; global header/theme design remained outside scope and unchanged.

Remaining checklist, using public fixtures only:

- [ ] All 17 direct routes/refresh/navigation: real processing, supported/unsupported dialect states, exact errors and result labels.
- [ ] Keyboard structured builders, IN/null actions, Copy/Clear, actual CSV download/clipboard permissions and all-row warnings.
- [ ] Connection source/results/errors remain masked/redacted; no credential payloads in requests, storage, URL/history or logs.
- [ ] Actual parser/formatter worker loads, timeout/cancellation/recovery and CSP compatibility.
- [ ] Light/dark/mobile 320/375/768 px/desktop for editors, builders and ER diagram; scroll/zoom/full textual inspection and overflow audit.
- [ ] Actual landing search/no-result feedback and related navigation.
- [ ] Live browser console and hydration errors; browser privacy/network checks and regression workflows across the seven prior stations.

Preview: `http://localhost:3000/stations/sql-database`. Stop the production server before rebuilding `.next`. Existing lint, dependency-audit and broader browser-acceptance gates remain unresolved; automated passes do not certify production/database compatibility.
