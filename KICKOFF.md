# Data Cruncher — Kickoff Prompt

Paste the block below to start the build. Run it from this repo, with the Team
Sheet Builder repo available as a sibling at `../teamsheetbuilder` (so the
referenced artifacts can be copied across).

---

```
Build a new static webapp — the "Team Sheet Data Cruncher" — a companion to
Team Sheet Builder. Goal: a tournament organizer uploads many staff-sheet PDFs
at once; the app extracts the machine-readable, PII-free team data embedded on
each sheet, aggregates it, and produces (1) a downloadable spreadsheet and
(2) a dashboard of usage statistics.

Authoritative contract: read `SPEC.md` in this repo FIRST — it defines exactly
what is embedded in the PDFs and what to build. Then copy these reference
artifacts from the Team Sheet Builder repo (sibling at ../teamsheetbuilder):
  - ../teamsheetbuilder/docs/CODE_INDEX.md           (QR number registry contract, if you do QR)
  - ../teamsheetbuilder/scripts/decode_team_data.mjs (working Node decoder for both carriers — port it)
  - ../teamsheetbuilder/src/pdf/teamDataCode.ts       (exact wire format: sentinels, field order, widths)
  - ../teamsheetbuilder/src/data/regulation-mb/*.json (species/moves/abilities/items/stat-alignments,
                                                       plus code-index.json for the QR)

Key facts:
  - Only the STAFF sheet carries data. Each sheet embeds a PII-free payload of
    6 Pokémon: species, form, ability, item, 4 moves, Stat Alignment, and 6
    final stats. No player name/ID/DOB is ever in the payload.
  - Primary extraction path = the transparent-text carrier `TSBv1` (self-
    describing slug ids). Extract page text with PDF.js `getTextContent`, match
    the `TSBv1~i~n~chunk` lines, reassemble, split, and expand slug ids to names
    via the bundled data JSON. The QR carrier `TSBI1` (compact index numbers) is
    a stretch goal for scanned sheets.
  - PII guardrail: parse ONLY the TSBv1/TSBI1 payload; never dump all page text
    (the visible sheet shows player PII, the payload does not).

Requirements:
  - Bulk upload (drag-and-drop / multi-select many PDFs) with parse progress.
  - Client-side only — no backend, no upload endpoint, GitHub Pages-hostable.
    The PDFs contain visible PII, so files must never leave the browser.
  - Spreadsheet export: CSV and XLSX (one row per Pokémon; optionally a per-team
    sheet). Columns per the spec.
  - Dashboard: species usage first (count + % of teams), then item/ability/move/
    stat-alignment usage rankings, plus totals and a parse-failure count.
  - Gracefully skip PDFs with no payload (wrong file / Open sheet).

Recommended stack (mirror Team Sheet Builder): Vite + React + TypeScript, pdfjs-
dist, SheetJS (xlsx), a charting lib (e.g. Recharts). Add jsqr + canvas only if
you implement the QR fallback.

Deliver the smallest end-to-end path first: upload PDFs -> extract TSBv1 ->
table of decoded teams -> CSV export. Then add XLSX and the dashboard.
```
