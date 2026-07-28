# Technical Vocabulary — this project, three ways

The same story told three times: (1) in full industry jargon, (2) in plain
language with the matching technical term after each phrase, (3) as a
glossary table anchoring every term to the moment it appeared in this
project. Read 1 to test yourself, 2 to decode it, 3 to make it stick.

---

## 1. The jargon-dense version

### What it is

Team Sheet Data Cruncher is a **static single-page application** (React 18 +
**TypeScript**, built by **Vite**, no backend, no accounts, no telemetry) that
lets a Pokémon VGC tournament organizer (TO) **bulk-ingest** team-sheet PDFs
and share links from a sibling app ("Team Sheet Builder"), decode a
**steganographic**, **PII-free** payload hidden inside them, and turn it into
a **spreadsheet export** and **usage-aggregation dashboard**. A second
ingestion path decodes **share links** carrying player PII, which get
persisted to a per-tournament **client-side database** (**IndexedDB**). The
whole thing ships via a **GitHub Actions** workflow that builds and deploys
to **GitHub Pages**.

### Decoding: two carriers, one wire format

The primary carrier, **`TSBv1`**, is a **transparent-text steganographic
payload**: the Builder draws fully-invisible (zero-opacity) text onto a PDF
"staff page," which **PDF.js**'s `getTextContent()` **text extraction**
faithfully returns even though nothing is visible on screen. The payload is
**chunked** across N lines matching `TSBv1~<index>~<count>~<chunk>`, found via
a **regular expression** with a **negative lookahead**
(`(?:(?!TSBv1~)[^\s~])+`) that stops a chunk from swallowing the next
**sentinel** if an extractor **concatenates** lines without whitespace.
**Reassembly** is **order-tolerant** (sorts on segment index) and
**idempotent against duplication** (dedupes identical repeated segments),
degrading to non-fatal **warnings** rather than throwing on a segment-count
mismatch or a **conflicting segment**. The reassembled string is a
**fixed-schema, pipe-delimited positional payload**: six team slots, each a
15-field **comma-separated record** (species/form/ability/item/4 moves/stat
alignment/6 stats), with empty-field slots treated as "no Pokémon here."
Because a TO may **merge** several sheets into one PDF, each **page** is
decoded **independently** rather than as one document, so chunks from
different teams never **interleave**; multi-payload files get their pages
**relabeled** with a `#pN` suffix.

The second carrier is a **URL fragment (hash) encoding scheme**, `#t=`: a
**base64url**-encoded, **raw-DEFLATE-compressed** (`DecompressionStream`,
a **browser-native streams API**, no external compression library) JSON
**envelope** `{ v, team, player? }`. The `team` field reuses the identical
positional payload from the PDF carrier; `player`, present only in share
links (never in the PII-free PDF path), is run through an explicit
**allowlist sanitizer** before being trusted. Version mismatches degrade to a
**best-effort decode** with a warning rather than a hard failure — the same
**fail-soft, never-throw** philosophy as the PDF decoder, so a single bad
link or page can't abort a batch. Decoding is exposed both as the
programmatic **ingestion path** (paste an email, **regex**-extract every
`#t=` link in it) and as a **client-side routing** mechanism: `App.tsx`
inspects `window.location.hash` on load and on the native `hashchange`
event, and if it matches `#t=…` renders a read-only **Viewer** instead of the
normal editable app — a **hash-based router** implemented by hand, with no
routing library.

### Data model and persistence

Decoded slugs (e.g. `landorus-therian`, but stat alignments are
capitalized — `Adamant` — a deliberately-preserved wire-format quirk) are
resolved to display names via a **lookup registry** built from a bundled
**data snapshot** (JSON dumps of the regulation's species/move/ability/item/
stat-alignment tables), with a **graceful-degradation fallback**
(`prettifySlug`) when a slug is missing from the snapshot. Stored records
live in two **IndexedDB object stores** (`tournaments`, `teams`, the latter
with a **secondary index** on `tournamentId`), opened via a
**promise-wrapped IDB transaction** helper. **Deduplication** is keyed on the
original decoded payload string, scoped per tournament, so an edited record
can still be recognized if the same link is resubmitted (the `payload` field
is **immutable by convention** even though the record's other fields are
user-editable) — an **at-most-once ingestion** guarantee per team, per
event. `navigator.storage.persist()` is called to reduce **eviction** risk.
**Export/import** round-trips the whole store as a versioned JSON file,
**merging** on primary key and on the same dedup key to avoid re-importing
duplicates.

### Aggregation and export

`aggregate()` builds **usage-ranking tables** (count and **team-adoption
percentage**, i.e. what fraction of teams run item X) per category, plus a
**drill-down** map of per-species move/item usage, from in-memory decoded
teams — filtered live by an active **tournament filter** (a `Set` of
selected ids, collapsing back to "no filter" when emptied). Export renders
two **tabular projections** of the same underlying rows: a flat **CSV** (with
**RFC-4180-style field quoting/escaping**) and a two-sheet **XLSX
workbook** (via SheetJS) — one row per Pokémon, one row per team.

### The build and test process

**Unit tests** are **colocated** with source; an **integration test**
exercises the real PDF.js **legacy/no-worker build** against synthetic PDFs
that a **fixture-generation script** draws with `pdf-lib` to mimic the actual
transparent-text carrier, so the parsing pipeline is tested end-to-end
without a real Builder-produced file on disk. `fake-indexeddb` **polyfills**
IndexedDB for the storage-layer tests under Node. **CI** runs `npm ci`,
the test suite, and the Vite build on every push to `main`, then deploys the
`dist` **build artifact** to GitHub Pages via the `upload-pages-artifact` /
`deploy-pages` actions — an **OIDC**-based deploy needing no stored secrets.
Vite's `base: './'` makes the build **relocatable**, since GitHub Pages
serves the app from a repo subpath.

---

## 2. The plain-language version

This app is a webpage (**single-page application**) that a Pokémon
tournament organizer opens to process the "team sheets" players submit —
official documents listing their six Pokémon. It's built with a popular
web-app toolkit (**React**) in a version of JavaScript that catches typos
before you run the code (**TypeScript**), packaged by a fast build tool
(**Vite**). Nothing is sent to a server — it only runs in the browser, with
no login and no tracking.

Team sheets can arrive as PDF files or as web links. Either way, the visible
part of the sheet (the part a human reads) is not what the program reads.
Instead, when someone builds a team sheet in the sibling app, it secretly
writes the team's data as text colored completely invisible (**transparent
text**) on a hidden page of the PDF — a way of hiding data in plain sight
(**steganography**). A PDF-reading library (**PDF.js**) can still pull out
that invisible text even though a human looking at the page sees nothing.
Because that hidden text has to be split into pieces to survive being
squeezed through the PDF format, it's broken into labeled chunks like
"piece 1 of 3, piece 2 of 3…" A carefully-built search pattern (**regular
expression**) finds every chunk, and the program that stitches them back
together tolerates the chunks arriving out of order or being copied twice,
only complaining (not crashing) if a piece is missing or two copies of a
piece disagree. Once stitched together, the hidden text is a strict,
predictable format: six Pokémon slots separated by `|`, each one a
comma-separated list of exactly 15 values (species, ability, item, moves,
etc.). Because a tournament organizer might staple several team sheets into
one big PDF file, the program checks each page of the PDF separately for
hidden text, rather than treating the whole file as one team — otherwise
pieces from different players' teams could get mixed together.

The other way a team arrives is as a link that ends in `#t=` followed by a
long string of letters and numbers — this comes from an "email this to the
tournament organizer" feature in the sibling app. That string is the team
data, but scrambled and squeezed down in a specific, standard way (**web-safe
Base64 encoding**, then a lossless compression trick called **raw DEFLATE**
that browsers can do natively). The program reverses those steps to get back
readable data — a small text bundle containing the same 6-Pokémon format
plus, this time, the player's name and ID (since this format is meant to
identify who sent it, unlike the anonymous PDF). If the reversed data is
garbled or doesn't fit the expected shape, the program just quietly says
"couldn't read this one" instead of crashing the whole batch — a
"fail gently, keep going" design used throughout the app. This same `#t=`
link doubles as an address inside the app itself: if you open the app's URL
with a `#t=…` tag on the end, the program notices and shows a stripped-down,
un-editable "read-only" preview of that one team, instead of the normal
edit-everything view — a hand-rolled version of what a full-blown page
"router" library would normally do.

Once decoded, cryptic internal codes like `landorus-therian` get turned into
proper display names using a big built-in reference table (a copy of the
sibling app's Pokémon/move/item database); if a code isn't found in that
table, the program just capitalizes the words as a best guess rather than
showing an error.

Saved teams live in the browser's own built-in mini-database
(**IndexedDB**) — organized into "tournaments" and the teams filed under
them — so they survive closing the tab, with no server involved. The
program is careful never to store the exact same team twice within one
tournament: it recognizes a team by its original decoded data, so even after
a tournament organizer manually corrects a typo in a stored record, re-adding
the same original file or link is still recognized as "already have this
one." There's also a full backup/restore feature: export everything to one
downloadable file, and import it back in later (skipping anything already
present).

The dashboard counts how often each Pokémon, item, ability, and move show up
across all stored teams, and what percentage of teams use each one — filtered
live to whichever tournaments are checked. Two spreadsheet formats can be
downloaded: a plain comma-separated file (**CSV**) and a proper Excel file
with two tabs, one row per Pokémon and one row per full team.

For testing, the project builds its own fake PDF files that mimic the real
hidden-text format (instead of needing a real one from the sibling app), and
also fakes the browser's mini-database in a plain Node.js test environment so
the storage logic can be checked without opening a real browser. A GitHub
robot (**CI/CD pipeline**) automatically runs the tests and builds the app
every time code is pushed to the main branch, then publishes the result to a
free GitHub-hosted web address (**GitHub Pages**) — no manual deploy step,
no server to maintain.

---

## 3. Glossary — term → meaning → where it happened here

### App shape & build

| Term | Plain meaning | In this project |
|---|---|---|
| **single-page application (SPA)** | one HTML page whose JS swaps out views instead of navigating to new pages | the whole app; entry `src/main.tsx` mounting `App.tsx` |
| **TypeScript** | JavaScript with a type-checker layered on top | whole `src/` tree; `tsc -b` runs before every build (`package.json:8`) |
| **Vite** | a fast dev server / bundler | `vite.config.ts`; `npm run dev` / `npm run build` |
| **relocatable build** | a build that works from any URL subpath, not just the domain root | `vite.config.ts` sets `base: './'` for GitHub Pages project subpaths |
| **client-side only / no backend** | all logic and storage run in the browser, nothing server-side | no API calls anywhere in `src/`; README/SPEC.md call this out explicitly |
| **CI/CD pipeline** | automated build/test/deploy on every push | `.github/workflows/deploy.yml` |
| **OIDC deploy** | proving identity to a cloud service without a stored secret | `id-token: write` permission, `actions/deploy-pages@v4` (`deploy.yml:11,41`) |
| **build artifact** | the compiled output handed between CI steps | `dist/`, uploaded by `actions/upload-pages-artifact@v3` (`deploy.yml:29-31`) |

### Steganographic decoding (the `TSBv1` PDF carrier)

| Term | Plain meaning | In this project |
|---|---|---|
| **steganography** | hiding data inside something that looks unrelated | invisible (zero-opacity) text on a PDF page carrying team data |
| **PII-free payload** | data deliberately stripped of anything identifying a person | the staff-page carrier — only species/moves/etc, no name (`tsbv1.ts:11-13`) |
| **text extraction** | pulling machine-readable text out of a rendered document | `extractPdfText()` via PDF.js `getTextContent()` (`src/pdf/extractText.ts:20`) |
| **sentinel** | a fixed marker string that flags "real data starts here" | the literal `TSBv1~` prefix (`tsbv1.ts:17`) |
| **regular expression / negative lookahead** | a search pattern; a lookahead that excludes a following pattern without consuming it | `SEGMENT_RE`'s `(?:(?!TSBv1~)[^\s~])+` stops a chunk swallowing the next sentinel (`tsbv1.ts:17`) |
| **chunking / reassembly** | splitting data into labeled pieces, then stitching them back in order | `findSegments` + `reassemble()` (`tsbv1.ts:29-70`) |
| **order-tolerant / idempotent parsing** | correct even if inputs arrive out of order or duplicated | `reassemble` sorts by index and dedupes identical repeats (`tsbv1.ts:51-59`) |
| **fail-soft / non-fatal warning** | report a problem but keep going instead of throwing | segment-count mismatch and conflicting-segment cases push warnings, not errors (`tsbv1.ts:47-48,57`) |
| **fixed-schema positional payload** | a format where meaning comes from position, not labels | `<mon>|<mon>|...` (6 slots) each 15 comma-separated fields (`tsbv1.ts:19-20,72-91`) |
| **per-page independent decode** | treating each page of a multi-page file as its own unit of data | `decodePdfPages` decodes every page separately so merged sheets don't interleave (`tsbv1.ts:124-138`) |
| **fixture / synthetic test data** | fake data built to mimic the real thing for testing | `scripts/make-fixtures.mjs` draws transparent `TSBv1` text with `pdf-lib` |

### The `#t=` share-link carrier & client-side routing

| Term | Plain meaning | In this project |
|---|---|---|
| **URL fragment / hash** | the part of a URL after `#`, never sent to a server | `#t=<payload>` links from the Builder's "email to TO" feature |
| **base64url encoding** | base64 with URL-safe characters (`-`/`_` instead of `+`/`/`) | `fromBase64Url()` (`teamShare.ts:24-32`) |
| **raw DEFLATE / streams API** | a headerless compression format; a native browser API for byte-stream transforms | `DecompressionStream('deflate-raw')`, no external zlib library (`teamShare.ts:39`) |
| **envelope / schema version** | a wrapper object carrying a format version for forward compatibility | `{ v, team, player? }`; `SHARE_VERSION = 1`, mismatch just warns (`teamShare.ts:14,83-87`) |
| **allowlist sanitization** | only ever accepting a fixed set of known-safe fields | `sanitizePlayer()`'s explicit 10-key list (`teamShare.ts:48-61`) |
| **fail-soft decode** | return "couldn't parse" instead of throwing, so one bad item doesn't kill a batch | `decodeTeamShare` returns `null` on any malformed input (`teamShare.ts:63-92`) |
| **client-side hash router** | using the URL hash (not a routing library) to switch views in-browser | `sharePayloadFromHash()` + `hashchange` listener in `App.tsx:32-51` |
| **read-only view** | a display mode with no edit controls | `Viewer.tsx`, rendered instead of the editable Workbench when `#t=` is present |

### Data model & persistence

| Term | Plain meaning | In this project |
|---|---|---|
| **slug** | a short machine-readable identifier, e.g. `landorus-therian` | speciesId/moveId/etc. fields inside a decoded mon (`decode/types.ts`) |
| **lookup registry** | a set of id→name maps built once from bundled data | `src/data/registry.ts`, built from `src/data/regulation-mb/*.json` |
| **data snapshot** | a point-in-time copy of an external dataset, bundled instead of fetched live | `species.json`/`moves.json`/etc., copied from the sibling Builder repo |
| **graceful-degradation fallback** | a reduced-but-working behavior when the ideal path isn't available | `prettifySlug()` when a slug is missing from a bundled snapshot (`registry.ts:39-44,53-58`) |
| **IndexedDB** | the browser's built-in transactional object database | `src/store/db.ts`, `DB_NAME = 'team-sheet-cruncher'` (`db.ts:39-40`) |
| **object store / secondary index** | an IndexedDB "table" / a lookup index on a non-key field | `tournaments`, `teams` stores; `teams.createIndex('tournamentId', ...)` (`db.ts:49-51`) |
| **promise-wrapped transaction** | turning IndexedDB's callback API into `async`/`await`-friendly code | `requestOf()` / `withStores()` helpers (`db.ts:65-85`) |
| **deduplication key** | a value used to detect "this is already stored" | the original `payload` string, scoped per tournament (`db.ts:129-140`) |
| **at-most-once ingestion** | a guarantee that re-submitting the same input never double-stores it | `addTeams`'s per-tournament payload dedup (`db.ts:125-156`) |
| **storage persistence request** | asking the browser not to evict this site's data under disk pressure | `navigator.storage.persist()` in `requestPersistence()` (`db.ts:88-90`) |
| **export/import round-trip** | serializing all data out, then merging it back in elsewhere | `exportData()` / `importData()`, versioned `ExportFile` shape (`db.ts:172-241`) |
| **polyfill** | a stand-in implementation of a browser API for a non-browser environment | `fake-indexeddb`, used so `db.test.ts` can run under Node/Vitest |

### Aggregation & export

| Term | Plain meaning | In this project |
|---|---|---|
| **usage ranking** | counting how often each value appears, sorted by frequency | `toRanking()` builds sorted `UsageEntry[]` per category (`aggregate.ts:46-56`) |
| **team-adoption percentage** | fraction of teams containing at least one user of a value | `UsageEntry.teamPct` (`aggregate.ts:5-14,53`) |
| **drill-down** | a secondary breakdown scoped to one selected item | `perSpecies` map: each species' own move/item usage (`aggregate.ts:29,89-95`) |
| **tournament filter** | narrowing displayed data to a chosen subset of events | `filter: Set<string> | null` in `App.tsx:59,228-231,239-246` |
| **tabular projection** | reshaping the same underlying data into a table for a specific purpose | `toRows()`/`toCsv()`/`toXlsx()` producing per-mon and per-team sheets |
| **RFC-4180-style escaping** | the standard rule for quoting CSV fields containing commas/quotes/newlines | `csvEscape()` in `src/export/spreadsheet.ts` |
| **workbook / worksheet** | a spreadsheet file / one tab within it | `xlsx` (SheetJS) output with `Pokemon` and `Teams` sheets |

### Process & testing practice

| Term | Plain meaning | In this project |
|---|---|---|
| **colocated tests** | test files living next to the source they test | `src/decode/tsbv1.test.ts`, `src/store/db.test.ts`, etc. |
| **integration test** | a test exercising the real pipeline end-to-end, not a mocked piece | `test/extract.integration.test.ts` — real PDF.js against a synthetic fixture PDF |
| **legacy / no-worker build** | a library variant that runs without a background worker thread | PDF.js's legacy build, used so the integration test runs in plain Node |
| **spec-driven build** | implementing strictly from a written design contract | `SPEC.md`, referenced by section number throughout the source comments |
