import { useCallback, useEffect, useMemo, useState } from 'react'
import { extractPdfText } from './pdf/extractText'
import { decodePdfPages } from './decode/tsbv1'
import { decodeTeamShare } from './decode/teamShare'
import type { DecodedTeam, ParseOutcome } from './decode/types'
import { toRows } from './model/rows'
import { aggregate } from './model/aggregate'
import { toCsv, toXlsx, downloadBlob } from './export/spreadsheet'
import {
  addTeams, deleteTeam, deleteTournament, exportData, importData,
  listTeams, listTournaments, newTournament, requestPersistence,
  saveTournament, updateTeam, UNASSIGNED,
  type StoredTeam, type Tournament,
} from './store/db'
import { DropZone } from './components/DropZone'
import { PasteBox } from './components/PasteBox'
import { FileStatusList } from './components/FileStatusList'
import { TeamsTable } from './components/TeamsTable'
import { Dashboard } from './components/Dashboard'
import { TournamentManager } from './components/TournamentManager'
import { EditTeamModal } from './components/EditTeamModal'
import { Viewer } from './components/Viewer'

interface Progress {
  done: number
  total: number
}

type Tab = 'teams' | 'dashboard' | 'files' | 'tournaments'

/** `#t=<payload>` in the URL hash opens the read-only viewer (SPEC §9.1). */
function sharePayloadFromHash(hash: string): string | null {
  const m = /^#t=([A-Za-z0-9\-_]+)/.exec(hash)
  return m ? m[1] : null
}

export default function App() {
  const [hashPayload, setHashPayload] = useState(() => sharePayloadFromHash(window.location.hash))
  useEffect(() => {
    const onHashChange = () => setHashPayload(sharePayloadFromHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const exitViewer = useCallback(() => {
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setHashPayload(null)
  }, [])

  if (hashPayload) return <Viewer key={hashPayload} payload={hashPayload} onExit={exitViewer} />
  return <Workbench />
}

function Workbench() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [teams, setTeams] = useState<StoredTeam[]>([])
  const [target, setTarget] = useState<string>(UNASSIGNED)
  /** Selected tournament ids (UNASSIGNED included); null = all. */
  const [filter, setFilter] = useState<Set<string> | null>(null)
  const [outcomes, setOutcomes] = useState<ParseOutcome[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)
  const [tab, setTab] = useState<Tab>('teams')
  const [editing, setEditing] = useState<StoredTeam | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [ts, allTeams] = await Promise.all([listTournaments(), listTeams()])
    setTournaments(ts)
    setTeams(allTeams)
  }, [])

  useEffect(() => {
    requestPersistence()
    refresh()
  }, [refresh])

  /** Store decoded teams under the target tournament; report per-team outcomes. */
  const store = useCallback(
    async (decoded: DecodedTeam[]): Promise<ParseOutcome[]> => {
      if (decoded.length === 0) return []
      const { added } = await addTeams(decoded, target)
      await refresh()
      const addedPayloads = new Set(added.map((a) => a.payload))
      return decoded.map((team) =>
        addedPayloads.has(team.payload)
          ? { status: 'ok', team }
          : {
              status: 'duplicate',
              sourceFile: team.sourceFile,
              reason: 'identical team already stored in this tournament — not added again',
            },
      )
    },
    [target, refresh],
  )

  const processFiles = useCallback(
    async (files: File[]) => {
      const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
      if (pdfs.length === 0) return
      setProgress({ done: 0, total: pdfs.length })

      // Sequential keeps memory bounded on large batches; PDF.js parses off the
      // main thread in its worker, so the UI stays responsive either way.
      for (const file of pdfs) {
        let results: ParseOutcome[]
        try {
          const pages = await extractPdfText(await file.arrayBuffer())
          const decoded = decodePdfPages(pages, file.name)
          results =
            decoded.length > 0
              ? await store(decoded)
              : [{
                  status: 'skipped',
                  sourceFile: file.name,
                  reason: 'no TSBv1 payload — not a Team Sheet Builder staff sheet (or an Open sheet)',
                }]
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          const reason = /password/i.test(message)
            ? `password-protected PDF — skipped (${message})`
            : message
          results = [{ status: 'error', sourceFile: file.name, reason }]
        }
        setOutcomes((prev) => [...prev, ...results])
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p))
      }
      setProgress(null)
    },
    [store],
  )

  const processPayloads = useCallback(
    async (payloads: string[]) => {
      setProgress({ done: 0, total: payloads.length })
      const decoded: DecodedTeam[] = []
      const failed: ParseOutcome[] = []
      for (const [i, payload] of payloads.entries()) {
        const label = `link #t=${payload.slice(0, 8)}…`
        const team = await decodeTeamShare(payload, label)
        if (team) {
          if (team.player?.name) team.sourceFile = `link (${team.player.name})`
          decoded.push(team)
        } else {
          failed.push({
            status: 'skipped',
            sourceFile: label,
            reason: 'malformed team-share link (truncated or not a #t= payload)',
          })
        }
        setProgress({ done: i + 1, total: payloads.length })
      }
      const stored = await store(decoded)
      setOutcomes((prev) => [...prev, ...stored, ...failed])
      setProgress(null)
    },
    [store],
  )

  const createTournament = useCallback(async (name: string) => {
    const t = newTournament(name)
    await saveTournament(t)
    await refresh()
    setTarget(t.id)
  }, [refresh])

  const renameTournament = useCallback(async (t: Tournament, name: string) => {
    await saveTournament({ ...t, name })
    await refresh()
  }, [refresh])

  const removeTournament = useCallback(async (t: Tournament) => {
    const count = teams.filter((x) => x.tournamentId === t.id).length
    const ok = window.confirm(
      `Delete "${t.name}" and its ${count} stored team${count === 1 ? '' : 's'}? This cannot be undone.`,
    )
    if (!ok) return
    await deleteTournament(t.id)
    if (target === t.id) setTarget(UNASSIGNED)
    setFilter((f) => {
      if (!f || !f.has(t.id)) return f
      const next = new Set(f)
      next.delete(t.id)
      return next.size === 0 ? null : next
    })
    await refresh()
  }, [teams, target, refresh])

  const saveEdit = useCallback(async (team: StoredTeam) => {
    await updateTeam(team)
    setEditing(null)
    await refresh()
  }, [refresh])

  const removeTeam = useCallback(async (team: StoredTeam) => {
    const label = team.player?.name ?? team.sourceFile
    if (!window.confirm(`Delete the stored team "${label}"? This cannot be undone.`)) return
    await deleteTeam(team.id)
    await refresh()
  }, [refresh])

  const doExport = useCallback(async (tournamentIds?: string[]) => {
    const file = await exportData(tournamentIds)
    const name = tournamentIds?.length === 1
      ? `${tournaments.find((t) => t.id === tournamentIds[0])?.name ?? 'tournament'}.cruncher.json`
      : 'team-sheet-cruncher-backup.json'
    downloadBlob(JSON.stringify(file, null, 2), name, 'application/json')
  }, [tournaments])

  const doImport = useCallback(async (file: File) => {
    try {
      const result = await importData(JSON.parse(await file.text()))
      setNotice(
        `Imported ${result.tournaments} tournament${result.tournaments === 1 ? '' : 's'} and ` +
        `${result.teams} team${result.teams === 1 ? '' : 's'}` +
        (result.skipped > 0 ? ` (${result.skipped} already present, skipped)` : '') + '.',
      )
      await refresh()
    } catch (err) {
      setNotice(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [refresh])

  const tournamentNames = useMemo(
    () => new Map(tournaments.map((t) => [t.id, t.name])),
    [tournaments],
  )
  const filteredTeams = useMemo(
    () => (filter ? teams.filter((t) => filter.has(t.tournamentId)) : teams),
    [teams, filter],
  )
  const rows = useMemo(
    () => filteredTeams.flatMap((t) => toRows(t, tournamentNames.get(t.tournamentId) ?? '')),
    [filteredTeams, tournamentNames],
  )
  const aggregates = useMemo(() => aggregate(filteredTeams), [filteredTeams])
  const failures = outcomes.filter((o) => o.status !== 'ok').length

  const toggleFilter = (id: string) => {
    setFilter((prev) => {
      const next = new Set(prev ?? [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next.size === 0 ? null : next
    })
  }

  const hasUnassigned = teams.some((t) => t.tournamentId === UNASSIGNED)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Team Sheet Data Cruncher</h1>
        <p className="tagline">
          Drop staff-sheet PDFs or paste #t= team-share links — teams are stored
          in this browser under your tournaments; nothing is uploaded anywhere.
        </p>
      </header>

      <div className="ingest-row">
        <div className="ingest-inputs">
          <DropZone onFiles={processFiles} busy={progress !== null} />
          <PasteBox onPayloads={processPayloads} busy={progress !== null} />
        </div>
        <label className="target-picker">
          File new teams under
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value={UNASSIGNED}>Unassigned</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
      </div>

      {progress && (
        <div className="progress" role="status">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <span>
            Parsing {progress.done} / {progress.total}…
          </span>
        </div>
      )}

      {notice && (
        <p className="notice" role="status">
          {notice} <button className="ghost" onClick={() => setNotice(null)}>Dismiss</button>
        </p>
      )}

      {(tournaments.length > 0 || hasUnassigned) && (
        <div className="filter-row" role="group" aria-label="Tournament filter">
          <button className={`chip${filter === null ? ' active' : ''}`} onClick={() => setFilter(null)}>
            All events
          </button>
          {tournaments.map((t) => (
            <button
              key={t.id}
              className={`chip${filter?.has(t.id) ? ' active' : ''}`}
              onClick={() => toggleFilter(t.id)}
            >
              {t.name}
            </button>
          ))}
          {hasUnassigned && (
            <button
              className={`chip${filter?.has(UNASSIGNED) ? ' active' : ''}`}
              onClick={() => toggleFilter(UNASSIGNED)}
            >
              Unassigned
            </button>
          )}
        </div>
      )}

      <div className="toolbar">
        <nav className="tabs" aria-label="Views">
          <button className={tab === 'teams' ? 'tab active' : 'tab'} onClick={() => setTab('teams')}>
            Teams ({filteredTeams.length})
          </button>
          <button className={tab === 'dashboard' ? 'tab active' : 'tab'} onClick={() => setTab('dashboard')}>
            Dashboard
          </button>
          <button className={tab === 'tournaments' ? 'tab active' : 'tab'} onClick={() => setTab('tournaments')}>
            Tournaments ({tournaments.length})
          </button>
          <button className={tab === 'files' ? 'tab active' : 'tab'} onClick={() => setTab('files')}>
            Session log ({outcomes.length}{failures > 0 ? `, ${failures} not added` : ''})
          </button>
        </nav>
        <div className="exports">
          <button
            disabled={rows.length === 0}
            onClick={() => downloadBlob(toCsv(rows), 'team-sheets.csv', 'text/csv')}
          >
            Download CSV
          </button>
          <button
            disabled={rows.length === 0}
            onClick={() =>
              downloadBlob(toXlsx(rows), 'team-sheets.xlsx',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            }
          >
            Download XLSX
          </button>
        </div>
      </div>

      {tab === 'teams' && (
        <TeamsTable
          teams={filteredTeams}
          tournamentNames={tournamentNames}
          onEdit={setEditing}
          onDelete={removeTeam}
        />
      )}
      {tab === 'dashboard' && (
        <Dashboard aggregates={aggregates} failures={failures} sheets={outcomes.length} />
      )}
      {tab === 'tournaments' && (
        <TournamentManager
          tournaments={tournaments}
          teams={teams}
          onCreate={createTournament}
          onRename={renameTournament}
          onDelete={removeTournament}
          onExport={doExport}
          onImport={doImport}
        />
      )}
      {tab === 'files' && <FileStatusList outcomes={outcomes} />}

      {editing && (
        <EditTeamModal
          team={editing}
          tournaments={tournaments}
          onSave={saveEdit}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}
