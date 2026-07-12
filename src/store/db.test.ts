import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DecodedTeam } from '../decode/types'
import {
  _resetDbForTests, addTeams, deleteTeam, deleteTournament, exportData,
  importData, listTeams, listTournaments, newTournament, saveTournament,
  UNASSIGNED, updateTeam,
} from './db'

function decodedTeam(payload: string, sourceFile = 'a.pdf'): DecodedTeam {
  return {
    sourceFile,
    payload,
    warnings: [],
    mons: [{
      slot: 1, speciesId: 'incineroar', formId: '', abilityId: 'intimidate',
      itemId: 'safety-goggles', moves: ['fake-out', '', '', ''], statAlignmentId: 'Careful',
      stats: { hp: '177', atk: '135', def: '111', spa: '', spd: '120', spe: '80' },
    }],
  }
}

beforeEach(() => {
  // Fresh DB per test.
  indexedDB = new IDBFactory()
  _resetDbForTests()
})

describe('tournaments', () => {
  it('creates, lists, and deletes tournaments with their teams', async () => {
    const t = newTournament('July Regional', '2026-07-12')
    await saveTournament(t)
    await addTeams([decodedTeam('p1')], t.id)
    await addTeams([decodedTeam('p2')], UNASSIGNED)

    expect((await listTournaments()).map((x) => x.name)).toEqual(['July Regional'])
    expect(await listTeams()).toHaveLength(2)

    await deleteTournament(t.id)
    expect(await listTournaments()).toEqual([])
    const remaining = await listTeams()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].tournamentId).toBe(UNASSIGNED)
  })
})

describe('addTeams dedup', () => {
  it('dedupes identical payloads within a batch and against stored teams', async () => {
    const first = await addTeams([decodedTeam('same'), decodedTeam('same'), decodedTeam('other')], UNASSIGNED)
    expect(first.added).toHaveLength(2)
    expect(first.duplicates).toHaveLength(1)

    const second = await addTeams([decodedTeam('same')], UNASSIGNED)
    expect(second.added).toHaveLength(0)
    expect(second.duplicates).toHaveLength(1)
  })

  it('allows the same team in different tournaments (dedup is per-tournament)', async () => {
    const a = newTournament('Event A')
    const b = newTournament('Event B')
    await saveTournament(a)
    await saveTournament(b)
    expect((await addTeams([decodedTeam('same')], a.id)).added).toHaveLength(1)
    expect((await addTeams([decodedTeam('same')], b.id)).added).toHaveLength(1)
  })
})

describe('edit and delete', () => {
  it('updates a team, preserving its payload as the dedup key', async () => {
    const { added } = await addTeams([decodedTeam('orig')], UNASSIGNED)
    const edited = { ...added[0], player: { name: 'Fixed Name' }, editedAt: Date.now() }
    await updateTeam(edited)

    const stored = (await listTeams())[0]
    expect(stored.player?.name).toBe('Fixed Name')
    expect(stored.editedAt).toBeDefined()
    expect(stored.payload).toBe('orig')

    // A re-submission of the original link is still recognized as a duplicate.
    const again = await addTeams([decodedTeam('orig')], UNASSIGNED)
    expect(again.duplicates).toHaveLength(1)
  })

  it('deletes a team', async () => {
    const { added } = await addTeams([decodedTeam('p')], UNASSIGNED)
    await deleteTeam(added[0].id)
    expect(await listTeams()).toEqual([])
  })
})

describe('export / import', () => {
  it('round-trips losslessly, player info included', async () => {
    const t = newTournament('Regional', '2026-07-12')
    await saveTournament(t)
    const team = decodedTeam('p1')
    team.player = { name: 'Ash Ketchum', dateOfBirth: '1996-05-22' }
    await addTeams([team], t.id)

    const file = await exportData()

    indexedDB = new IDBFactory() // simulate a different machine
    _resetDbForTests()
    const result = await importData(JSON.parse(JSON.stringify(file)))
    expect(result).toEqual({ tournaments: 1, teams: 1, skipped: 0 })

    expect((await listTournaments())[0]).toEqual(t)
    const imported = (await listTeams())[0]
    expect(imported.player).toEqual({ name: 'Ash Ketchum', dateOfBirth: '1996-05-22' })
    expect(imported.payload).toBe('p1')
  })

  it('skips records that already exist when re-imported', async () => {
    const t = newTournament('Regional')
    await saveTournament(t)
    await addTeams([decodedTeam('p1')], t.id)
    const file = await exportData()

    const result = await importData(file)
    expect(result.tournaments + result.teams).toBe(0)
    expect(result.skipped).toBe(2)
    expect(await listTeams()).toHaveLength(1)
  })

  it('exports a subset of tournaments', async () => {
    const a = newTournament('A')
    const b = newTournament('B')
    await saveTournament(a)
    await saveTournament(b)
    await addTeams([decodedTeam('pa')], a.id)
    await addTeams([decodedTeam('pb')], b.id)

    const file = await exportData([a.id])
    expect(file.tournaments.map((t) => t.name)).toEqual(['A'])
    expect(file.teams.map((t) => t.payload)).toEqual(['pa'])
  })

  it('rejects a file that is not a cruncher export', async () => {
    await expect(importData({ hello: 'world' })).rejects.toThrow('not a Team Sheet Cruncher export')
  })
})
