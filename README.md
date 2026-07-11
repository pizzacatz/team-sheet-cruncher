# Team Sheet Data Cruncher

A companion webapp to **Team Sheet Builder** (the sibling repo at
`../teamsheetbuilder`). It ingests Team Sheet Builder staff-sheet PDFs in bulk,
extracts the machine-readable, PII-free team data embedded on each, and produces
a spreadsheet and a usage dashboard — all client-side.

## Status

The core app is built:

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
  how to extract it, the data files to bundle, and what to build.
- **[KICKOFF.md](KICKOFF.md)** — the original kickoff prompt for the build.

The embedded data formats are produced by Team Sheet Builder; the wire format is
also documented there in `src/pdf/teamDataCode.ts` and `docs/CODE_INDEX.md`.
