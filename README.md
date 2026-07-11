# Team Sheet Data Cruncher

A companion webapp to **Team Sheet Builder** (the sibling repo at
`../teamsheetbuilder`). It ingests Team Sheet Builder staff-sheet PDFs in bulk,
extracts the machine-readable, PII-free team data embedded on each, and produces
a spreadsheet and a usage dashboard — all client-side.

Not built yet. This repo currently holds the design docs:

- **[SPEC.md](SPEC.md)** — the authoritative spec: what's embedded in the PDFs,
  how to extract it, the data files to bundle, and what to build. Start here.
- **[KICKOFF.md](KICKOFF.md)** — a paste-ready prompt to begin the build in a new
  session.

The embedded data formats are produced by Team Sheet Builder; the wire format is
also documented there in `src/pdf/teamDataCode.ts` and `docs/CODE_INDEX.md`.
