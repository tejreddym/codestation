# Security & Crypto Station

Updated 2026-10-03. Scope: the 22 specified public Security tools only. Public discovery retains the existing **Security** category. No global redesign, other-station engine changes, dependency additions, analytics, uploads or input history.

## Contract audit and corrections

All tools now bypass the legacy generic workbench through `components/SecurityStation.tsx`. The metadata contributor `config/security-tools.ts` feeds the existing central `config/tools.ts`; it is not an independent discovery registry. Each entry supplies exact fields, defaults, outputs, related links, unique descriptions and short factual purpose/usage content. There are no Download controls. Generator inputs are not supplemented with generic source text.

| Public route (`/tools/…`) | Exact inputs → outputs | Corrected behavior |
|---|---|---|
| uuid-generator | UUID version → UUID | Only v4/v7; lowercase canonical; CSPRNG random components and RFC 9562 version/variant bits. v7 carries 48-bit device milliseconds. |
| uuid-parser | UUID → version, variant, normalized UUID, validity | Paired canonical braces, canonical URN and compact forms; clear malformed/reserved-version errors, explicit Nil/Max special values; no generation. |
| password-generator | Length, four include toggles → password | 4–256; only enabled classes; secure mandatory class choices, remaining choices and Fisher–Yates shuffle; no custom alphabet/meter/exclusion settings. |
| sha-256-generator | Text → SHA-256 hash | Native UTF-8 Web Crypto; lowercase hex; empty text valid. Old `sha-256` redirects permanently. |
| sha-384-generator | Text → SHA-384 hash | Native UTF-8 Web Crypto; lowercase hex; no algorithm selector. |
| sha-512-generator | Text → SHA-512 hash | Native UTF-8 Web Crypto; lowercase hex. Old `sha-512` redirects permanently. |
| sha-1-generator | Text → SHA-1 hash | Native UTF-8 Web Crypto; lowercase hex; explicit legacy/security limitation. |
| md5-generator | Text → MD5 hash | Lazy local compatibility implementation; lowercase hex; explicit legacy limitation. |
| hmac-generator | Message, secret key, algorithm → HMAC | Only HMAC-SHA-256/384/512; UTF-8 key and message; empty message allowed, empty key explicitly rejected; native nonextractable imported key/sign. |
| crc32-generator | Text → checksum | IEEE CRC32 of UTF-8 bytes; exactly eight uppercase hexadecimal characters; not a cryptographic hash. |
| checksum-generator | Text, algorithm → checksum | Exactly MD5/SHA-1/SHA-256/SHA-384/SHA-512/CRC32; correct casing and dynamic algorithm notices; no substitution. |
| hash-compare | Hash A, Hash B → match status | Trim surrounding whitespace only; case-sensitive; exactly Match/Does not match; empty values error; no hashing/algorithm inference. |
| file-hash-generator | One file, algorithm → name, size, algorithm, hash | Only SHA-1/256/384/512; hash raw bytes, lowercase hex; local worker, bounded allocation and released file selection. |
| entropy-calculator | Text/password → length, charset size, estimated bits | Category-model length × log2(size), not empirical Shannon frequency; code-point length and explicit estimate limitations. |
| password-strength-checker | Password → score, label, feedback | Local length/diversity, repeated runs/blocks, sequences and small common-pattern checks; five required labels; no personal-information fields. |
| ulid-generator | None → ULID | No unnecessary input; uppercase 26-character Crockford representation; 48-bit timestamp and 80 CSPRNG bits. |
| nanoid-generator | Length → NanoID | 4–256, default 21, standard 64-character URL-safe set and CSPRNG. |
| random-number-generator | Minimum, maximum, count → numbers | Inclusive signed safe-integer range, including full negative-to-positive range; count 1–1,000; BigInt rejection sampling; no decimal mode. |
| random-string-generator | Length, character set → string | 1–256; exactly five specified alphabets; secure rejection sampling. Old `random-string` redirects permanently. |
| secure-token-generator | Byte length, encoding → token | 8–256 random bytes; lowercase Hex or unpadded Base64URL; encoded length is not mistaken for byte count. |
| hex-random-generator | Byte length → random hex | 1–256 bytes; exactly twice as many lowercase hex characters. |
| secret-key-generator | Key size → random key, selected size | Only 128/192/256 bits; generic lowercase-hex random material, not an algorithm-specific or derived key. |

## Shared implementation

- `lib/tools/security/generators.ts`: `crypto.getRandomValues()`, unbiased integer/alphabet rejection sampling, secure shuffle, UUID/ULID layout, explicit validation and local estimates. No Math.random fallback.
- `lib/tools/security/hashes.ts`: `crypto.subtle.digest/importKey/sign`, fatal unpaired UTF-16 validation before UTF-8 encoding, local CRC32, byte-for-byte file hashing. MD5's small local module loads only on demand. No new dependencies.
- `lib/tools/security/{types,index,client}.ts` and `workers/security.worker.ts`: typed dispatch and disposable local worker. Every file uses a worker when available; text above 16,384 UTF-16 units is offloaded. Small native operations run locally without a worker.
- `SecurityStation.tsx` and `.module.css`: tool-scoped deterministic IDs, visible labels, associated validation, keyboard actions, exact-value per-output Copy, complete Clear, stale-result/abort guards, responsive theme-token panels. Hashes remain unwrapped, untruncated monospace text in keyboard-focusable scrolling areas. Existing theme toggle and global tokens are untouched.
- `ToolWorkspace.tsx`, `app/tools/[slug]/page.tsx`, `next.config.ts`: scoped lazy boundary, Security-only canonical/index/purpose/usage/related content, and three permanent aliases. Existing route behavior for other stations is preserved.

## Privacy and security policies

Processing is in browser/page/worker memory, never an API call. No password, key, filename, input, digest or generated value enters application logs, analytics, URL parameters, localStorage or sessionStorage. No ad, analytics or Pro/account abstraction existed to reuse; no provider or replacement abstraction was invented. Clipboard writes occur only on explicit Copy. The user's OS/browser clipboard and extensions are outside this page's retention controls.

File selection is released from DOM/component state as processing begins. The request-local reference exists only for processing; completion/error/clear/navigation releases references and workers terminate. Owned file/hash/HMAC buffers are zeroed where practical. This is not a guarantee of secure memory erasure: JavaScript strings, browser internals, native crypto buffers, browser password managers and OS memory are not under complete app control. Secret inputs disable autocomplete/spellcheck but users should avoid entering live credentials on untrusted devices.

SHA and HMAC preserve spaces, line endings, BOM and Unicode composition. Invalid lone surrogates fail instead of silently becoming replacement bytes. HMAC keys are literal UTF-8, not decoded hexadecimal. SHA-1/MD5 are compatibility-only; CRC32 detects accidental errors, not authenticity; fast hashes are not password-storage algorithms. No verification or production-safety guarantee is implied.

## Explicit limits and estimation semantics

- File limit: **64 MiB / 67,108,864 bytes**, checked before reading. Web Crypto requires a whole-buffer digest, not streaming; workers keep this work off the main thread but peak memory exceeds file size. Worker timeout: 30 seconds. Clear/navigation terminate workers. Native small main-thread crypto cannot be interrupted; its late results are discarded.
- Text limit: **1,000,000 UTF-16 code units per value**. Without workers, text over 16,384 units or files over 8 MiB fail rather than performing large synchronous work. Browser crypto needs a supported secure context (HTTPS or localhost).
- Random-number endpoints: ±9,007,199,254,740,991. BigInt arithmetic supports the entire interval without floating-point range bias. Repeated numbers are allowed. Equal bounds still require a CSPRNG-capable environment.
- Password/random-string symbols: the 32 printable ASCII punctuation characters, no space. Mandatory-class password generation guarantees inclusion; it does not claim uniformity over every possible class-constrained string.
- Entropy counts Unicode code points, not grapheme clusters. Present ASCII classes contribute 26 lowercase, 26 uppercase, 10 digits, 32 punctuation, 1 space; each distinct other observed code point adds one. This conservative Unicode model is not a full script alphabet or a measured security value. Empty text yields zero length/size/bits. Displayed bits round to two decimals.
- Strength scores are bounded 0–100: 0–19 Very Weak, 20–39 Weak, 40–59 Fair, 60–79 Strong, 80–100 Very Strong. A small embedded pattern list is not a complete password/breach corpus. Penalties cover repeats and sequential patterns; estimates cannot guarantee resistance to guessing.
- UUID parser validates representation/version/variant, not provenance or uniqueness. Legacy NCS/Microsoft bit patterns are labeled as legacy rather than assigned an RFC version. Nil/Max are explicit special values; reserved RFC versions/future variants are rejected.
- UUID v7/ULID use the device clock, with random same-millisecond components. No monotonic ordering guarantee within a millisecond or across clock rollback. They reveal a timestamp and are identifiers, not secret tokens.

## Executed verification

Baseline before changes: typecheck, 1,335 tests and production build passed; `git status` confirmed no Git repository. The prior production process was stopped before building.

After implementation:

- `npm run typecheck`: passed.
- `npm test`: **1,568 tests / 24 files passed**; 233 new Security tests in four files. All 22 tools have execution, missing/invalid-state, keyboard, Copy/Clear, dark/light DOM-theme and deterministic hydration coverage. Numeric/category boundaries, repeated secure generation, UUID v4/v7, ULID timestamps, NanoID lengths, inclusive large ranges/counts, token/key byte lengths and heuristic patterns are covered.
- Hash/HMAC tests use independent Node crypto reference vectors for empty, ASCII, Unicode and large text; all supported file algorithms cover empty, text, binary and 4 MiB files. Tests check oversized-file rejection before reads, buffer cleanup, stale results, clipboard denial and local-worker cancellation/timeouts. Runtime UI tests spy on fetch, XHR, storage writes and console logging; source review found no prohibited production sinks or Math.random use in the new Security path.
- `CI=1 npm run lint < /dev/null`: **blocked (exit 1)**. Deprecated `next lint` prompts for absent ESLint configuration. No pass claimed; no unrelated lint migration attempted.
- `npm run build`: passed, **160 prerendered tool URLs / 167 total generated pages**.
- `node scripts/verify-security.mjs`: passed all **22 Security pages**, exact SSR fields/defaults/options, metadata, **25 navigation links**, **9 page scripts**, **3 permanent redirects**, and **5 other-station routes**.
- The same script executed all **22 emitted-worker examples**, four binary-file SHA vectors, MD5 vector and UUID v7 in an isolated VM runtime; all **4 worker/engine assets** served successfully. This verifies bundler output, not browser worker/CSP behavior.
- **69 protected pre-existing source files** matched baseline SHA-256 hashes. All **138 non-Security runtime registry entries** matched the saved baseline. Global CSS/theme and other station engines/components/tests were not changed. Legacy Security helpers remain for old consumers; public Security routes bypass them.

Scope snapshot (local, not a deliverable): `/private/var/folders/69/l4j48t2j7pd9npmrwgw19ldc0000gn/T/opencode/security-scope-5JMalF/baseline.json` and adjacent original `tools.ts`.

## Browser acceptance — pending, not passed

Built-in browser navigation to the Security preview and a fresh observation timed out. No real-browser visual, clipboard-permission, worker/CSP, live-console or history assertion is claimed. jsdom theme attributes and CSS-rule checks are not screenshots/layout evidence.

When browser access is available, repeat for **each of the 22 routes** above using public fixtures only:

- [ ] Direct load and refresh: matching URL, title, breadcrumb, exact fields, no generated SSR secret, no hydration/console errors.
- [ ] Keyboard: visible focus, all fields, submit, each Copy, Clear, output scrolling; associated readable validation and no traps.
- [ ] Light/dark: animated toggle unchanged; input, result, selection, notice and error contrast readable.
- [ ] Mobile (320/375/768 px) and desktop: stacked controls, touch targets, no page-level overflow; long hashes/tokens accessible by internal scroll.
- [ ] Normal, empty, invalid and boundary input workflows; edit invalidates results; Clear resets all fields/options and output.
- [ ] Clipboard exactness and denied-permission fallback; no fake Download controls.
- [ ] Real file/text workers: successful algorithms, large practical fixture, Clear/navigation while busy, no retained file selection and no stale result.
- [ ] Public alias redirects, related links, Back/Forward and refresh; no secrets in URL/history state, requests, logs, storage or telemetry.

Preview: `http://localhost:3000/tools/uuid-generator`. Stop its production server before rebuilding `.next`. Existing dependency-audit findings and lint configuration are separate maintenance work.
