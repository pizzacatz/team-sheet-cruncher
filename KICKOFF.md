# Data Cruncher — Kickoff Prompt

Paste the block below to start the build. Run it from this repo, with the Team
Sheet Builder repo available as a sibling at `../teamsheetbuilder` (so the
referenced artifacts can be copied across).

---

```
Build a new static webapp — the "Team Sheet Data Cruncher" — a companion to
Team Sheet Builder. Goal: a tournament organizer ingests many teams at once —
either as team-sheet PDFs or as `#t=` team-share links pasted from Email-to-TO
messages — and the app extracts the team data, aggregates it, and produces
(1) a downloadable spreadsheet and (2) a dashboard of usage statistics.

Authoritative contract: read `SPEC.md` in this repo FIRST — it defines exactly
what is embedded in the PDFs, the team-share link format, and what to build.
Then copy these reference artifacts from the Team Sheet Builder repo (sibling at
../teamsheetbuilder):
  - ../teamsheetbuilder/docs/CODE_INDEX.md           (QR number registry contract, if you do QR)
  - ../teamsheetbuilder/scripts/decode_team_data.mjs (working Node decoder for both PDF carriers — port it)
  - ../teamsheetbuilder/src/pdf/teamDataCode.ts       (exact PDF wire format: sentinels, field order, widths)
  - ../teamsheetbuilder/src/domain/teamShare.ts       (the `#t=` link format: base64url + deflate-raw + JSON)
  - ../teamsheetbuilder/src/data/regulation-mb/*.json (species/moves/abilities/items/stat-alignments,
                                                       plus code-index.json for the QR)

Key facts:
  - Two ingestion paths. (a) PDF: only the STAFF page carries data — a PII-free
    payload of 6 Pokémon (species, form, ability, item, 4 moves, Stat Alignment,
    6 final stats); no player name/ID/DOB in the payload. The team-sheet PDF is a
    single combined download; the standalone Staff download was removed, but the
    staff page still lives inside the combined PDF. (b) `#t=` link: decodes to the
    same 6-Pokémon team PLUS the player's info (name/ID/DOB/division/...).
  - PDF extraction path = the transparent-text carrier `TSBv1` (self-describing
    slug ids). Extract page text with PDF.js `getTextContent`, match the
    `TSBv1~i~n~chunk` lines, reassemble, split, and expand slug ids to names via
    the bundled data JSON. The QR carrier `TSBI1` is a stretch goal for scans.
  - Link decode = base64url-decode -> DecompressionStream("deflate-raw") ->
    JSON.parse -> { v, team, player? }; `team` is the SAME mon|mon slug payload
    as TSBv1 (no wrapper). Browser-native, no library.
  - PII: for PDFs, parse ONLY the TSBv1/TSBI1 payload, never dump page text. For
    links, the `player` object is PII by design (TO attribution) — show/export it
    only on-device. Either way nothing is uploaded.

Requirements:
  - Bulk ingest (drag-and-drop / multi-select many PDFs, and a paste box for
    `#t=` links or whole email bodies) with parse progress.
  - Client-side only — no backend, no upload endpoint, GitHub Pages-hostable.
    PDFs show visible PII and links contain PII, so nothing must leave the browser.
  - Spreadsheet export: CSV and XLSX (one row per Pokémon; optionally a per-team
    sheet; identity columns for link-sourced teams). Columns per the spec.
  - Dashboard: species usage first (count + % of teams), then item/ability/move/
    stat-alignment usage rankings, plus totals and a parse-failure count.
  - Gracefully skip PDFs with no payload (wrong file / Open sheet) and malformed
    links.

Recommended stack (mirror Team Sheet Builder): Vite + React + TypeScript, pdfjs-
dist, SheetJS (xlsx), a charting lib (e.g. Recharts). Add jsqr + canvas only if
you implement the QR fallback.

Deliver the smallest end-to-end path first: upload PDFs -> extract TSBv1 ->
table of decoded teams -> CSV export. Then add XLSX and the dashboard.
```
