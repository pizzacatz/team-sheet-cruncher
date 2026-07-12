import type { DecodedMon, DecodedTeam, PlayerInfo } from '../decode/types'

/**
 * On-device persistence per SPEC.md §9.3: tournaments and their teams live in
 * IndexedDB, nothing ever leaves the browser except files the TO explicitly
 * exports. No backend, no accounts, no telemetry.
 */

export interface Tournament {
  id: string
  name: string
  /** Free-text date, e.g. "2026-07-12". */
  date: string
  notes: string
  createdAt: number
}

/** The unassigned bucket — teams not yet filed under a tournament. */
export const UNASSIGNED = ''

export interface StoredTeam {
  id: string
  /** Tournament id, or UNASSIGNED (''). */
  tournamentId: string
  sourceFile: string
  mons: DecodedMon[]
  player?: PlayerInfo
  /**
   * The original decoded payload — the per-tournament dedup key (§9.2/§9.3).
   * Never changed by hand-edits, so a re-submitted link is still recognized.
   */
  payload: string
  warnings: string[]
  addedAt: number
  /** Set when the TO hand-corrects the record (§9.2). */
  editedAt?: number
}

const DB_NAME = 'team-sheet-cruncher'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore('tournaments', { keyPath: 'id' })
      const teams = db.createObjectStore('teams', { keyPath: 'id' })
      teams.createIndex('tournamentId', 'tournamentId')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

/** Test hook: close and forget the cached connection. */
export function _resetDbForTests() {
  dbPromise?.then((db) => db.close()).catch(() => {})
  dbPromise = null
}

function requestOf<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStores<T>(
  mode: IDBTransactionMode,
  run: (tournaments: IDBObjectStore, teams: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDb()
  const tx = db.transaction(['tournaments', 'teams'], mode)
  const result = await run(tx.objectStore('tournaments'), tx.objectStore('teams'))
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  return result
}

/** Ask the browser not to evict our data under storage pressure (§9.3). */
export function requestPersistence(): void {
  navigator.storage?.persist?.().catch(() => {})
}

export async function listTournaments(): Promise<Tournament[]> {
  const all = await withStores('readonly', (tournaments) => requestOf(tournaments.getAll()))
  return (all as Tournament[]).sort((a, b) => a.createdAt - b.createdAt)
}

export async function saveTournament(t: Tournament): Promise<void> {
  await withStores('readwrite', (tournaments) => requestOf(tournaments.put(t)))
}

export function newTournament(name: string, date = '', notes = ''): Tournament {
  return { id: crypto.randomUUID(), name, date, notes, createdAt: Date.now() }
}

/** Delete a tournament AND every team filed under it (caller confirms first). */
export async function deleteTournament(id: string): Promise<void> {
  await withStores('readwrite', async (tournaments, teams) => {
    tournaments.delete(id)
    const keys = await requestOf(teams.index('tournamentId').getAllKeys(id))
    for (const key of keys) teams.delete(key)
  })
}

export async function listTeams(): Promise<StoredTeam[]> {
  const all = await withStores('readonly', (_t, teams) => requestOf(teams.getAll()))
  return (all as StoredTeam[]).sort((a, b) => a.addedAt - b.addedAt)
}

export interface AddResult {
  added: StoredTeam[]
  /** Teams dropped because an identical payload already exists in the tournament (§9.2). */
  duplicates: DecodedTeam[]
}

/**
 * Store decoded teams under a tournament, deduping on the original payload —
 * within the batch and against what is already stored in that tournament.
 */
export async function addTeams(decoded: DecodedTeam[], tournamentId: string): Promise<AddResult> {
  return withStores('readwrite', async (_t, teams) => {
    const existing = (await requestOf(teams.index('tournamentId').getAll(tournamentId))) as StoredTeam[]
    const seen = new Set(existing.map((t) => t.payload))
    const added: StoredTeam[] = []
    const duplicates: DecodedTeam[] = []
    for (const team of decoded) {
      if (seen.has(team.payload)) {
        duplicates.push(team)
        continue
      }
      seen.add(team.payload)
      const stored: StoredTeam = {
        id: crypto.randomUUID(),
        tournamentId,
        sourceFile: team.sourceFile,
        mons: team.mons,
        player: team.player,
        payload: team.payload,
        warnings: team.warnings,
        addedAt: Date.now(),
      }
      teams.put(stored)
      added.push(stored)
    }
    return { added, duplicates }
  })
}

/** Overwrite a stored team (hand-corrections set editedAt; payload is preserved). */
export async function updateTeam(team: StoredTeam): Promise<void> {
  await withStores('readwrite', (_t, teams) => requestOf(teams.put(team)))
}

export async function deleteTeam(id: string): Promise<void> {
  await withStores('readwrite', (_t, teams) => requestOf(teams.delete(id)))
}

// ---------------------------------------------------------------------------
// Export / import (§9.3): a JSON file per tournament (or the whole DB) for
// backup and moving between machines. The file contains PII — it is the TO's
// to safeguard, same as the emails they received.

export interface ExportFile {
  format: 'team-sheet-cruncher'
  version: 1
  exportedAt: string
  tournaments: Tournament[]
  teams: StoredTeam[]
}

export async function exportData(tournamentIds?: string[]): Promise<ExportFile> {
  const [tournaments, teams] = await Promise.all([listTournaments(), listTeams()])
  const wanted = tournamentIds && new Set(tournamentIds)
  return {
    format: 'team-sheet-cruncher',
    version: 1,
    exportedAt: new Date().toISOString(),
    tournaments: wanted ? tournaments.filter((t) => wanted.has(t.id)) : tournaments,
    teams: wanted ? teams.filter((t) => wanted.has(t.tournamentId)) : teams,
  }
}

export interface ImportResult {
  tournaments: number
  teams: number
  /** Records skipped because they already exist (same id, or duplicate payload). */
  skipped: number
}

/** Merge an export file into the DB. Existing ids win; payload dedup applies. */
export async function importData(raw: unknown): Promise<ImportResult> {
  const file = raw as Partial<ExportFile>
  if (
    typeof file !== 'object' || file === null ||
    file.format !== 'team-sheet-cruncher' || file.version !== 1 ||
    !Array.isArray(file.tournaments) || !Array.isArray(file.teams)
  ) {
    throw new Error('not a Team Sheet Cruncher export file')
  }
  return withStores('readwrite', async (tournaments, teams) => {
    let importedTournaments = 0
    let importedTeams = 0
    let skipped = 0

    const existingTournamentIds = new Set(
      (await requestOf(tournaments.getAllKeys())) as string[],
    )
    for (const t of file.tournaments!) {
      if (existingTournamentIds.has(t.id)) {
        skipped++
      } else {
        tournaments.put(t)
        importedTournaments++
      }
    }

    const existingTeams = (await requestOf(teams.getAll())) as StoredTeam[]
    const existingIds = new Set(existingTeams.map((t) => t.id))
    const existingPayloads = new Set(existingTeams.map((t) => `${t.tournamentId}\n${t.payload}`))
    for (const team of file.teams!) {
      const payloadKey = `${team.tournamentId}\n${team.payload}`
      if (existingIds.has(team.id) || existingPayloads.has(payloadKey)) {
        skipped++
        continue
      }
      existingPayloads.add(payloadKey)
      teams.put(team)
      importedTeams++
    }
    return { tournaments: importedTournaments, teams: importedTeams, skipped }
  })
}
