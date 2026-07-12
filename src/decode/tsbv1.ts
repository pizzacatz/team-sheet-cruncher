import type { DecodedMon, DecodedTeam } from './types'

/**
 * Decoder for the TSBv1 transparent-text carrier embedded on Team Sheet
 * Builder staff sheets (see SPEC.md §2.1).
 *
 * Wire format: N physical lines of `TSBv1~<segmentIndex>~<segmentCount>~<chunk>`.
 * Reassembled payload: `<mon>|<mon>|...` (six positional slots), each mon being
 * 15 comma-separated fields.
 *
 * PII guardrail: these functions only ever look at text matching the TSBv1
 * sentinel. Callers must not persist or display the rest of the page text.
 */

// Chunk = run of non-whitespace, non-`~` chars, stopping before a following
// sentinel in case the extractor concatenated lines without whitespace.
const SEGMENT_RE = /TSBv1~(\d+)~(\d+)~((?:(?!TSBv1~)[^\s~])+)/g

const FIELD_COUNT = 15
const TEAM_SLOTS = 6

export interface Tsbv1Segment {
  index: number
  count: number
  chunk: string
}

/** Find every TSBv1 segment in extracted page text, in document order. */
export function findSegments(text: string): Tsbv1Segment[] {
  const segments: Tsbv1Segment[] = []
  for (const m of text.matchAll(SEGMENT_RE)) {
    segments.push({ index: Number(m[1]), count: Number(m[2]), chunk: m[3] })
  }
  return segments
}

/**
 * Reassemble segments into the logical payload. Tolerates reordered or
 * interleaved extractor output (sorts on index, dedupes exact repeats such as
 * the same page being extracted twice).
 */
export function reassemble(segments: Tsbv1Segment[]): { payload: string; warnings: string[] } {
  const warnings: string[] = []
  if (segments.length === 0) throw new Error('no TSBv1 segments')

  const count = segments[0].count
  if (segments.some((s) => s.count !== count)) {
    warnings.push('TSBv1 segments disagree on segment count; using first')
  }

  const byIndex = new Map<number, string>()
  for (const s of segments) {
    const existing = byIndex.get(s.index)
    if (existing === undefined) {
      byIndex.set(s.index, s.chunk)
    } else if (existing !== s.chunk) {
      warnings.push(`conflicting TSBv1 segment ${s.index}; keeping first occurrence`)
    }
  }

  if (byIndex.size !== count) {
    warnings.push(`expected ${count} TSBv1 segments, found ${byIndex.size}`)
  }

  const payload = [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, chunk]) => chunk)
    .join('')
  return { payload, warnings }
}

function parseMon(raw: string, slot: number, warnings: string[]): DecodedMon | null {
  const fields = raw.split(',')
  if (fields.length !== FIELD_COUNT) {
    warnings.push(`slot ${slot}: expected ${FIELD_COUNT} fields, got ${fields.length}`)
    while (fields.length < FIELD_COUNT) fields.push('')
  }
  if (fields.every((f) => f === '')) return null // empty slot — skip (SPEC §7)

  const [speciesId, formId, abilityId, itemId, m1, m2, m3, m4, statAlignmentId, hp, atk, def, spa, spd, spe] = fields
  return {
    slot,
    speciesId,
    formId,
    abilityId,
    itemId,
    moves: [m1, m2, m3, m4],
    statAlignmentId,
    stats: { hp, atk, def, spa, spd, spe },
  }
}

/**
 * Decode a reassembled payload into a team. The payload is always six
 * positional `|`-separated slots; empty slots are skipped.
 */
export function decodePayload(payload: string, sourceFile: string, priorWarnings: string[] = []): DecodedTeam {
  const warnings = [...priorWarnings]
  const slots = payload.split('|')
  if (slots.length !== TEAM_SLOTS) {
    warnings.push(`expected ${TEAM_SLOTS} team slots, got ${slots.length}`)
  }

  const mons: DecodedMon[] = []
  slots.slice(0, TEAM_SLOTS).forEach((raw, i) => {
    const mon = parseMon(raw, i + 1, warnings)
    if (mon) mons.push(mon)
  })
  return { sourceFile, mons, payload, warnings }
}

/**
 * Full text → team pipeline. Returns null when no TSBv1 payload is present
 * (not a Team Sheet Builder staff sheet — report as skipped, per SPEC §7).
 */
export function decodeText(text: string, sourceFile: string): DecodedTeam | null {
  const segments = findSegments(text)
  if (segments.length === 0) return null
  const { payload, warnings } = reassemble(segments)
  return decodePayload(payload, sourceFile, warnings)
}

/**
 * Decode every page of a PDF independently — a TO may merge several team
 * sheets into one file, and each staff page yields its own team (SPEC §2.1/§7).
 * When more than one page carries a payload, sources are labelled `file#pN`.
 */
export function decodePdfPages(pages: string[], fileName: string): DecodedTeam[] {
  const found: { team: DecodedTeam; page: number }[] = []
  pages.forEach((text, i) => {
    const team = decodeText(text, fileName)
    if (team) found.push({ team, page: i + 1 })
  })
  if (found.length > 1) {
    for (const f of found) f.team.sourceFile = `${fileName}#p${f.page}`
  }
  return found.map((f) => f.team)
}
