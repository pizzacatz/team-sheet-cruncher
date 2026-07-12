import { describe, expect, it } from 'vitest'
import { aggregate } from './aggregate'
import type { DecodedMon, DecodedTeam } from '../decode/types'

function mon(slot: number, species: string, item: string, moves: string[]): DecodedMon {
  return {
    slot,
    speciesId: species,
    formId: '',
    abilityId: 'intimidate',
    itemId: item,
    moves: [...moves, '', '', ''].slice(0, 4),
    statAlignmentId: 'Jolly',
    stats: { hp: '1', atk: '1', def: '1', spa: '1', spd: '1', spe: '1' },
  }
}

function team(sourceFile: string, mons: DecodedMon[]): DecodedTeam {
  return { sourceFile, mons, warnings: [] }
}

describe('aggregate', () => {
  it('counts mons and computes % of teams', () => {
    const agg = aggregate([
      team('a.pdf', [mon(1, 'incineroar', 'safety-goggles', ['fake-out']), mon(2, 'rillaboom', 'assault-vest', ['fake-out'])]),
      team('b.pdf', [mon(1, 'incineroar', 'sitrus-berry', ['knock-off'])]),
    ])
    expect(agg.totalTeams).toBe(2)
    expect(agg.totalMons).toBe(3)

    const incin = agg.species.find((e) => e.id === 'incineroar')!
    expect(incin.count).toBe(2)
    expect(incin.teams).toBe(2)
    expect(incin.teamPct).toBe(1)

    const rilla = agg.species.find((e) => e.id === 'rillaboom')!
    expect(rilla.teamPct).toBe(0.5)

    // fake-out used by two mons but only on one team
    const fakeOut = agg.moves.find((e) => e.id === 'fake-out')!
    expect(fakeOut.count).toBe(2)
    expect(fakeOut.teams).toBe(1)
  })

  it('treats two uploads with the same file name as distinct teams', () => {
    const t = team('dup.pdf', [mon(1, 'incineroar', '', [])])
    const agg = aggregate([t, t])
    expect(agg.species[0].count).toBe(2)
    expect(agg.species[0].teams).toBe(2)
  })

  it('builds per-species drill-downs and ignores empty ids', () => {
    const agg = aggregate([
      team('a.pdf', [mon(1, 'incineroar', 'safety-goggles', ['fake-out', 'knock-off'])]),
    ])
    expect(agg.items.every((e) => e.id !== '')).toBe(true)
    const detail = agg.perSpecies.get('incineroar')!
    expect(detail.moves.map((e) => e.id).sort()).toEqual(['fake-out', 'knock-off'])
    expect(detail.items[0].id).toBe('safety-goggles')
  })
})
