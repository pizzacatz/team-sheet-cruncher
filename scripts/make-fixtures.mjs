// Generates synthetic test PDFs that mimic Team Sheet Builder output closely
// enough to exercise the extraction pipeline end to end:
//   test/fixtures/staff-sheet.pdf — visible dummy sheet + transparent TSBv1 lines
//   test/fixtures/open-sheet.pdf  — visible text only, no payload
// Run via `npm run make-fixtures`. The fixtures are checked in so tests don't
// need this script at CI time; re-run it if the wire format in SPEC.md changes.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures')
mkdirSync(outDir, { recursive: true })

const MONS = [
  'incineroar,,intimidate,safety-goggles,fake-out,knock-off,flare-blitz,parting-shot,Jolly,177,135,110,63,110,92',
  'rillaboom,,grassy-surge,assault-vest,fake-out,grassy-glide,wood-hammer,u-turn,Adamant,182,187,111,72,90,106',
  'flutter-mane,,protosynthesis,booster-energy,moonblast,shadow-ball,icy-wind,protect,Timid,131,58,75,187,155,205',
  'urshifu,rapid-strike,unseen-fist,focus-sash,surging-strikes,close-combat,aqua-jet,detect,Jolly,175,182,120,63,80,163',
  'amoonguss,,regenerator,sitrus-berry,spore,pollen-puff,rage-powder,protect,Calm,220,63,90,105,145,31',
  ','.repeat(14), // one empty slot to exercise slot skipping
]
const PAYLOAD = MONS.join('|')

// Split into three segments like the builder does to fit the page width.
const SEG_COUNT = 3
const segLen = Math.ceil(PAYLOAD.length / SEG_COUNT)
const segments = Array.from({ length: SEG_COUNT }, (_, i) =>
  `TSBv1~${i}~${SEG_COUNT}~${PAYLOAD.slice(i * segLen, (i + 1) * segLen)}`,
)

async function makePdf({ withPayload, title }) {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)

  page.drawText(title, { x: 50, y: 740, size: 18, font })
  page.drawText('Player Info: (visible dummy content, not part of the payload)', {
    x: 50, y: 710, size: 11, font,
  })

  if (withPayload) {
    segments.forEach((line, i) => {
      // Fully transparent text, exactly like the digital carrier (SPEC §2.1).
      page.drawText(line, {
        x: 36,
        y: 60 - i * 14,
        size: 6,
        font,
        color: rgb(0, 0, 0),
        opacity: 0,
      })
    })
  }
  return doc.save()
}

writeFileSync(join(outDir, 'staff-sheet.pdf'), await makePdf({ withPayload: true, title: 'Staff Team Sheet' }))
writeFileSync(join(outDir, 'open-sheet.pdf'), await makePdf({ withPayload: false, title: 'Open Team Sheet' }))
console.log(`wrote fixtures to ${outDir}`)
