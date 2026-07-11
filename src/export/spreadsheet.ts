import * as XLSX from 'xlsx'
import type { MonRow } from '../model/rows'

/**
 * Spreadsheet export per SPEC.md §5.1: one row per Pokémon plus a source
 * column, and (XLSX only) a second sheet with one row per team.
 */

export const MON_HEADERS = [
  'source_file', 'slot', 'species', 'form', 'ability', 'item',
  'move1', 'move2', 'move3', 'move4', 'stat_alignment',
  'hp', 'atk', 'def', 'spa', 'spd', 'spe',
] as const

function monCells(row: MonRow): (string | number)[] {
  return [
    row.sourceFile, row.slot, row.species, row.form, row.ability, row.item,
    row.moves[0], row.moves[1], row.moves[2], row.moves[3], row.statAlignment,
    row.hp, row.atk, row.def, row.spa, row.spd, row.spe,
  ]
}

function teamSheetRows(rows: MonRow[]): (string | number)[][] {
  const byFile = new Map<string, MonRow[]>()
  for (const row of rows) {
    const list = byFile.get(row.sourceFile) ?? []
    list.push(row)
    byFile.set(row.sourceFile, list)
  }
  const out: (string | number)[][] = [
    ['source_file', 'species1', 'species2', 'species3', 'species4', 'species5', 'species6'],
  ]
  for (const [file, team] of byFile) {
    const bySlot = Array.from({ length: 6 }, (_, i) => team.find((r) => r.slot === i + 1)?.species ?? '')
    out.push([file, ...bySlot])
  }
  return out
}

function csvEscape(cell: string | number): string {
  const s = String(cell)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: MonRow[]): string {
  const lines = [MON_HEADERS.join(',')]
  for (const row of rows) lines.push(monCells(row).map(csvEscape).join(','))
  return lines.join('\r\n') + '\r\n'
}

export function toXlsx(rows: MonRow[]): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const monsSheet = XLSX.utils.aoa_to_sheet([[...MON_HEADERS], ...rows.map(monCells)])
  XLSX.utils.book_append_sheet(wb, monsSheet, 'Pokemon')
  const teamsSheet = XLSX.utils.aoa_to_sheet(teamSheetRows(rows))
  XLSX.utils.book_append_sheet(wb, teamsSheet, 'Teams')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}

export function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
