import { useEffect, useState } from 'react'
import { decodeTeamShare } from '../decode/teamShare'
import type { DecodedTeam } from '../decode/types'
import {
  addTeams, listTournaments, newTournament, saveTournament,
  UNASSIGNED, type Tournament,
} from '../store/db'
import { TeamSheetView } from './TeamSheetView'

/**
 * Read-only viewer route (SPEC §9.1): `<cruncher-url>/#t=<payload>` renders
 * the shared team non-editably. Actions: add to a tournament, copy the link.
 * The link payload is the player's canonical submission — it is never altered
 * here; corrections happen on the *stored* copy in the workbench (§9.2).
 */

const NEW_TOURNAMENT = '::new::'

type State =
  | { phase: 'decoding' }
  | { phase: 'invalid' }
  | { phase: 'ready'; team: DecodedTeam }

export function Viewer({ payload, onExit }: { payload: string; onExit: () => void }) {
  const [state, setState] = useState<State>({ phase: 'decoding' })
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [target, setTarget] = useState<string>(UNASSIGNED)
  const [newName, setNewName] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setState({ phase: 'decoding' })
    setResult(null)
    const label = `link #t=${payload.slice(0, 8)}…`
    decodeTeamShare(payload, label).then((team) => {
      if (cancelled) return
      setState(team ? { phase: 'ready', team } : { phase: 'invalid' })
    })
    listTournaments().then((ts) => {
      if (!cancelled) setTournaments(ts)
    })
    return () => {
      cancelled = true
    }
  }, [payload])

  const addToTournament = async () => {
    if (state.phase !== 'ready') return
    let tournamentId = target
    let tournamentName = tournaments.find((t) => t.id === target)?.name ?? 'Unassigned'
    if (target === NEW_TOURNAMENT) {
      const name = newName.trim()
      if (!name) return
      const t = newTournament(name)
      await saveTournament(t)
      tournamentId = t.id
      tournamentName = t.name
      setTournaments(await listTournaments())
      setTarget(t.id)
      setNewName('')
    }
    const team = state.team
    const source = team.player?.name ? `link (${team.player.name})` : team.sourceFile
    const { added, duplicates } = await addTeams([{ ...team, sourceFile: source }], tournamentId)
    setResult(
      added.length > 0
        ? `Added to ${tournamentName}.`
        : duplicates.length > 0
          ? `Already in ${tournamentName} — not added again.`
          : 'Nothing to add.',
    )
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — the address bar still has the link */
    }
  }

  return (
    <div className="app viewer">
      <header className="app-header">
        <h1>Team Sheet</h1>
        <p className="tagline">
          Read-only view of a shared team — rendered on your device, nothing is uploaded.
        </p>
      </header>

      {state.phase === 'decoding' && <p className="empty">Decoding…</p>}

      {state.phase === 'invalid' && (
        <div className="viewer-error">
          <p>
            This link&apos;s team data couldn&apos;t be read. It may be truncated (email clients
            sometimes cut long links) or not a team-share link at all.
          </p>
          <button onClick={onExit}>Open the Data Cruncher</button>
        </div>
      )}

      {state.phase === 'ready' && (
        <>
          <TeamSheetView mons={state.team.mons} player={state.team.player} />

          {state.team.warnings.length > 0 && (
            <p className="warnings">⚠ {state.team.warnings.join('; ')}</p>
          )}

          <div className="viewer-actions">
            <label>
              Add to
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value={UNASSIGNED}>Unassigned</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                <option value={NEW_TOURNAMENT}>New tournament…</option>
              </select>
            </label>
            {target === NEW_TOURNAMENT && (
              <input
                placeholder="Tournament name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            )}
            <button onClick={addToTournament} disabled={target === NEW_TOURNAMENT && !newName.trim()}>
              Add team
            </button>
            <button className="ghost" onClick={copyLink}>{copied ? 'Copied!' : 'Copy link'}</button>
            <button className="ghost" onClick={onExit}>Open the Data Cruncher</button>
          </div>
          {result && <p className="viewer-result" role="status">{result}</p>}
        </>
      )}
    </div>
  )
}
