# Team Sheet Data Cruncher

A companion webapp to **Team Sheet Builder** (the sibling repo at
`../teamsheetbuilder`). It ingests teams in bulk — as team-sheet **PDFs** or as
**`#t=` team-share links** pasted from Email-to-TO messages — expands them to
readable names, and produces a spreadsheet and a usage dashboard, all client-side.

- PDFs carry a PII-free team payload embedded on the staff page.
- `#t=` links carry the team **plus the player's info** (for TO attribution).

## Status

Phase 1 and Phase 2 are built:

- **Bulk upload** (drag-and-drop / multi-select) with parse progress; every page
  of every PDF is scanned, so combined "Both" PDFs work.
- **TSBv1 extraction** (the transparent-text digital carrier) via PDF.js —
  reassembly is tolerant of reordered/interleaved extractor output, and only
  sentinel-matched payload text is ever read (the visible sheet's player PII is
  never touched).
- **Teams table**, **CSV + XLSX export** (one row per Pokémon, plus a per-team
  sheet in the XLSX), and a **dashboard** with species/item/ability/move/
  stat-alignment usage rankings, per-species move & item drill-down, and totals.
- PDFs with no payload (Open sheets, foreign files) are reported as skipped
  without aborting the batch.

- **`#t=` team-share-link ingestion** — paste links or whole email bodies;
  player info (name/ID/division/DOB) flows into the table and exports.
- **Read-only viewer route** — opening `<cruncher-url>/#t=<payload>` renders the
  shared team non-editably, with add-to-tournament and copy-link actions.
- **Tournaments** — create/rename/delete events; every ingestion path files
  teams under a tournament (or Unassigned); teams persist in IndexedDB across
  sessions, with JSON export/import for backup and machine moves.
- **Dedup & corrections** — identical teams dedupe per tournament (surfaced in
  the session log); stored teams can be hand-edited (marked `edited`, original
  payload preserved so re-submissions still dedupe) or deleted.
- **Cross-event dashboard** — filter chips select any subset of tournaments;
  aggregations, drill-downs, and CSV/XLSX exports follow the filter.
- **Merged PDFs** — every page is scanned and each staff page yields its own
  team (`file.pdf#pN`).

Not yet implemented: the **QR carrier (`TSBI1`)** fallback for scanned sheets —
a stretch goal per the spec.

**Data snapshot:** `src/data/regulation-mb/` currently holds empty placeholders;
copy the real JSON snapshots from the builder repo (see the README in that
directory). Until then the app falls back to prettifying the self-describing
slug ids (`fake-out` → `Fake Out`), so it is fully usable without them.

## Development

```
npm install
npm run dev        # local dev server
npm test           # unit + PDF-pipeline integration tests
npm run build      # type-check + production build (static, GitHub Pages-ready)
npm run make-fixtures  # regenerate the synthetic test PDFs
```

Everything runs in the browser — no backend, no upload endpoint. Uploaded PDFs
never leave the device.

## Design docs

- **[SPEC.md](SPEC.md)** — the authoritative spec: what's embedded in the PDFs,
  the team-share link format, how to extract both, the data files to bundle, and
  what to build. Start here.
- **[KICKOFF.md](KICKOFF.md)** — the original kickoff prompt for the build.

The formats are produced by Team Sheet Builder and documented there in
`src/pdf/teamDataCode.ts`, `src/domain/teamShare.ts`, and `docs/CODE_INDEX.md`.
