import type { DecodedTeam } from '../decode/types'
import { resolveName, type Category } from '../data/registry'

/** One row of a usage ranking: how many Pokémon use X, on what % of teams. */
export interface UsageEntry {
  id: string
  name: string
  /** Number of Pokémon using it across all teams. */
  count: number
  /** Number of teams with at least one user. */
  teams: number
  /** teams / total teams, 0..1. */
  teamPct: number
}

export interface SpeciesDetail {
  moves: UsageEntry[]
  items: UsageEntry[]
}

export interface Aggregates {
  totalTeams: number
  totalMons: number
  species: UsageEntry[]
  items: UsageEntry[]
  abilities: UsageEntry[]
  moves: UsageEntry[]
  statAlignments: UsageEntry[]
  /** speciesId → its own move/item usage (drill-down, SPEC §5.2). */
  perSpecies: Map<string, SpeciesDetail>
}

interface Tally {
  count: number
  teams: Set<string>
}

function tally(map: Map<string, Tally>, id: string, teamKey: string) {
  if (id === '') return
  let t = map.get(id)
  if (!t) map.set(id, (t = { count: 0, teams: new Set() }))
  t.count++
  t.teams.add(teamKey)
}

function toRanking(map: Map<string, Tally>, category: Category, totalTeams: number): UsageEntry[] {
  return [...map.entries()]
    .map(([id, t]) => ({
      id,
      name: resolveName(category, id).name,
      count: t.count,
      teams: t.teams.size,
      teamPct: totalTeams === 0 ? 0 : t.teams.size / totalTeams,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export function aggregate(teams: DecodedTeam[]): Aggregates {
  const species = new Map<string, Tally>()
  const items = new Map<string, Tally>()
  const abilities = new Map<string, Tally>()
  const moves = new Map<string, Tally>()
  const statAlignments = new Map<string, Tally>()
  const perSpeciesRaw = new Map<string, { moves: Map<string, Tally>; items: Map<string, Tally> }>()

  let totalMons = 0
  teams.forEach((team, i) => {
    // Index-based key so two uploads of the same file name still count as
    // distinct teams for the "% of teams" denominators.
    const teamKey = `${i}:${team.sourceFile}`
    for (const mon of team.mons) {
      totalMons++
      tally(species, mon.speciesId, teamKey)
      tally(items, mon.itemId, teamKey)
      tally(abilities, mon.abilityId, teamKey)
      tally(statAlignments, mon.statAlignmentId, teamKey)
      for (const move of mon.moves) tally(moves, move, teamKey)

      if (mon.speciesId !== '') {
        let detail = perSpeciesRaw.get(mon.speciesId)
        if (!detail) perSpeciesRaw.set(mon.speciesId, (detail = { moves: new Map(), items: new Map() }))
        tally(detail.items, mon.itemId, teamKey)
        for (const move of mon.moves) tally(detail.moves, move, teamKey)
      }
    }
  })

  const totalTeams = teams.length
  const perSpecies = new Map<string, SpeciesDetail>()
  for (const [id, detail] of perSpeciesRaw) {
    perSpecies.set(id, {
      moves: toRanking(detail.moves, 'move', totalTeams),
      items: toRanking(detail.items, 'item', totalTeams),
    })
  }

  return {
    totalTeams,
    totalMons,
    species: toRanking(species, 'species', totalTeams),
    items: toRanking(items, 'item', totalTeams),
    abilities: toRanking(abilities, 'ability', totalTeams),
    moves: toRanking(moves, 'move', totalTeams),
    statAlignments: toRanking(statAlignments, 'statAlignment', totalTeams),
    perSpecies,
  }
}
