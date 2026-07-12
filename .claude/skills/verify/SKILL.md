---
name: verify
description: Build, launch, and drive the Team Sheet Data Cruncher end-to-end in headless Chrome to verify changes at the real UI surface.
---

# Verifying the Team Sheet Data Cruncher

## Build & serve

```bash
npm run build                      # tsc -b && vite build → dist/
npx vite preview --port 4173 &     # serves dist at http://localhost:4173/
```

## Drive (headless Chrome)

No Playwright in the project deps. Install `playwright-core` (no browser
download) in a scratch dir and point it at system Chrome:

```js
import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true })
```

Each `launch()` gets a fresh profile, so IndexedDB starts empty — reruns are
deterministic. Auto-accept `window.confirm` dialogs: `page.on('dialog', d => d.accept())`.

## Fixtures

- PDFs: `test/fixtures/staff-sheet.pdf` / `open-sheet.pdf` (regen with
  `npm run make-fixtures`). For merged multi-team PDFs, copy the pattern in
  `scripts/make-fixtures.mjs` (transparent `TSBv1~i~n~chunk` text, opacity 0).
- `#t=` links: `deflateRawSync(JSON.stringify({v:1, team, player?})).toString('base64url')`
  where `team` is the `<mon>|<mon>|…` 15-field payload (see SPEC §2.1/§2.3).
- Fixture teams use some non-Regulation-M-B slugs, so the ⚠ stale-data marker
  appears on them — that is correct behavior, not a bug.

## Flows worth driving

viewer render (`/#t=<payload>`, must have no editable controls) → add to
tournament (incl. duplicate re-add) → PDF drop (`.dropzone input[type=file]`,
`setInputFiles`) → link paste (`.paste-box textarea`) → edit modal (badge
renders CSS-uppercased: assert `EDITED`, not `edited`) → filter chips →
CSV/backup downloads (`page.waitForEvent('download')`) → reload for
persistence.

A known-good driver script pattern lives in the session that built Phase 2;
key selectors: `.target-picker select`, `.viewer-actions select` (option
`::new::` creates a tournament inline), tab buttons by role/name.
