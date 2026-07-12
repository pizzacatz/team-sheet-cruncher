# Team Sheet Data Cruncher

A companion webapp to **Team Sheet Builder** (the sibling repo at
`../teamsheetbuilder`). It ingests teams in bulk — as team-sheet **PDFs** or as
**`#t=` team-share links** pasted from Email-to-TO messages — expands them to
readable names, and produces a spreadsheet and a usage dashboard, all client-side.

- PDFs carry a PII-free team payload embedded on the staff page.
- `#t=` links carry the team **plus the player's info** (for TO attribution).

Not built yet. This repo currently holds the design docs:

- **[SPEC.md](SPEC.md)** — the authoritative spec: what's embedded in the PDFs,
  the team-share link format, how to extract both, the data files to bundle, and
  what to build. Start here.
- **[KICKOFF.md](KICKOFF.md)** — a paste-ready prompt to begin the build in a new
  session.

The formats are produced by Team Sheet Builder and documented there in
`src/pdf/teamDataCode.ts`, `src/domain/teamShare.ts`, and `docs/CODE_INDEX.md`.
