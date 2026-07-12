import type { DecodedMon, DecodedTeam } from '../decode/types'
import { resolveName } from '../data/registry'

/** One spreadsheet/table row = one Pokémon, with slug ids expanded to names. */
export interface MonRow {
  /** Identity columns (SPEC §5.1) — blank for PII-free PDF rows and team-only links. */
  playerName: string
  playerId: string
  division: string
  /** Tournament the team is filed under; blank = unassigned (SPEC §9.4). */
  tournament: string
  sourceFile: string
  slot: number
  species: string
  form: string
  ability: string
  item: string
  moves: string[]
  statAlignment: string
  hp: string
  atk: string
  def: string
  spa: string
  spd: string
  spe: string
  /** Raw slug ids kept for aggregation keys and stale-data display. */
  raw: DecodedMon
  /** Slugs not found in the bundled data snapshot (stale data). */
  unknownSlugs: string[]
}

export function toRows(team: DecodedTeam, tournament = ''): MonRow[] {
  return team.mons.map((mon) => {
    const unknownSlugs: string[] = []
    const resolve = (category: Parameters<typeof resolveName>[0], slug: string) => {
      const r = resolveName(category, slug)
      if (r.unknown) unknownSlugs.push(slug)
      return r.name
    }
    return {
      playerName: team.player?.name ?? '',
      playerId: team.player?.playerId ?? '',
      division: team.player?.division ?? '',
      tournament,
      sourceFile: team.sourceFile,
      slot: mon.slot,
      species: resolve('species', mon.speciesId),
      // forms have no dedicated data file; the slug is self-describing
      form: mon.formId,
      ability: resolve('ability', mon.abilityId),
      item: resolve('item', mon.itemId),
      moves: mon.moves.map((m) => resolve('move', m)),
      statAlignment: resolve('statAlignment', mon.statAlignmentId),
      ...mon.stats,
      raw: mon,
      unknownSlugs,
    }
  })
}
