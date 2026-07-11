# Regulation data snapshot

These files are a **snapshot of the Team Sheet Builder regulation data** and
should be copied from the builder repo
(`../teamsheetbuilder/src/data/regulation-mb/*.json`) per SPEC.md §4:

| File | Used for |
| --- | --- |
| `species.json` | slug → displayName |
| `moves.json` | slug → displayName |
| `abilities.json` | slug → displayName |
| `items.json` | slug → displayName |
| `stat-alignments.json` | slug → displayName |
| `code-index.json` | number ↔ slug (QR carrier only — not yet implemented) |

The files currently checked in are **empty placeholders** because the builder
repo was not available when the cruncher was built. Everything still works:
TSBv1 slug ids are self-describing, so the app falls back to prettifying the
slug (`fake-out` → `Fake Out`). Once the real snapshots are copied in, exact
display names are used and unknown slugs get flagged as stale-data warnings.

Each record must have at least `id` (the slug) and `displayName`; extra fields
are ignored. Re-copy these whenever the regulation data is re-exported.
