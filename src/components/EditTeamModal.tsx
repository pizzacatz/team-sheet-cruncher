import { useState } from 'react'
import type { DecodedMon, PlayerInfo } from '../decode/types'
import { resolveName, type Category } from '../data/registry'
import { UNASSIGNED, type StoredTeam, type Tournament } from '../store/db'

/**
 * Hand-correction of a *stored* team (SPEC §9.2): the TO can fix any field —
 * player info and team data alike. The original payload is preserved (dedup
 * still recognizes a re-submitted link) and the record is stamped editedAt.
 */

const PLAYER_FIELDS: [keyof PlayerInfo, string][] = [
  ['name', 'Name'],
  ['playerId', 'Player ID'],
  ['division', 'Division'],
  ['dateOfBirth', 'Date of birth'],
  ['teamName', 'Team name'],
  ['trainerName', 'Trainer name'],
  ['switchProfileName', 'Switch profile'],
  ['supportId', 'Support ID'],
  ['eventName', 'Event'],
  ['date', 'Date'],
]

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const

function SlugInput({
  category,
  value,
  onChange,
  label,
}: {
  category: Category
  value: string
  onChange: (v: string) => void
  label: string
}) {
  const resolved = value ? resolveName(category, value) : null
  return (
    <label className="edit-field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value.trim())} />
      <small className={resolved?.unknown ? 'stale' : ''}>
        {resolved ? (resolved.unknown ? `⚠ unknown id` : resolved.name) : '—'}
      </small>
    </label>
  )
}

export function EditTeamModal({
  team,
  tournaments,
  onSave,
  onCancel,
}: {
  team: StoredTeam
  tournaments: Tournament[]
  onSave: (team: StoredTeam) => void
  onCancel: () => void
}) {
  const [player, setPlayer] = useState<PlayerInfo>({ ...team.player })
  const [mons, setMons] = useState<DecodedMon[]>(team.mons.map((m) => ({
    ...m,
    moves: [...m.moves],
    stats: { ...m.stats },
  })))
  const [tournamentId, setTournamentId] = useState(team.tournamentId)
  const [sourceFile, setSourceFile] = useState(team.sourceFile)

  const setMon = (i: number, patch: Partial<DecodedMon>) =>
    setMons((prev) => prev.map((m, j) => (j === i ? { ...m, ...patch } : m)))

  const save = () => {
    const cleaned: PlayerInfo = {}
    for (const [key] of PLAYER_FIELDS) {
      const value = player[key]?.trim()
      if (value) cleaned[key] = value
    }
    onSave({
      ...team,
      sourceFile: sourceFile.trim() || team.sourceFile,
      tournamentId,
      player: Object.keys(cleaned).length > 0 ? cleaned : undefined,
      mons,
      editedAt: Date.now(),
    })
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" role="dialog" aria-label="Edit team" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Edit team</h2>
          <p className="hint">
            Corrections apply to your stored copy only — the original submission stays
            recognizable, so a re-pasted link is still flagged as a duplicate.
          </p>
        </header>

        <div className="modal-body">
          <section>
            <h3>Filing</h3>
            <div className="edit-grid">
              <label className="edit-field">
                <span>Tournament</span>
                <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)}>
                  <option value={UNASSIGNED}>Unassigned</option>
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label className="edit-field">
                <span>Source label</span>
                <input value={sourceFile} onChange={(e) => setSourceFile(e.target.value)} />
              </label>
            </div>
          </section>

          <section>
            <h3>Player info</h3>
            <div className="edit-grid">
              {PLAYER_FIELDS.map(([key, label]) => (
                <label key={key} className="edit-field">
                  <span>{label}</span>
                  <input
                    value={player[key] ?? ''}
                    onChange={(e) => setPlayer((p) => ({ ...p, [key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          </section>

          {mons.map((mon, i) => (
            <section key={mon.slot}>
              <h3>
                Slot {mon.slot} — {resolveName('species', mon.speciesId).name || 'empty'}
              </h3>
              <div className="edit-grid">
                <SlugInput category="species" label="Species id" value={mon.speciesId}
                  onChange={(v) => setMon(i, { speciesId: v })} />
                <label className="edit-field">
                  <span>Form id</span>
                  <input value={mon.formId} onChange={(e) => setMon(i, { formId: e.target.value.trim() })} />
                </label>
                <SlugInput category="ability" label="Ability id" value={mon.abilityId}
                  onChange={(v) => setMon(i, { abilityId: v })} />
                <SlugInput category="item" label="Item id" value={mon.itemId}
                  onChange={(v) => setMon(i, { itemId: v })} />
                {mon.moves.map((move, mi) => (
                  <SlugInput key={mi} category="move" label={`Move ${mi + 1} id`} value={move}
                    onChange={(v) => setMon(i, { moves: mon.moves.map((x, xi) => (xi === mi ? v : x)) })} />
                ))}
                <SlugInput category="statAlignment" label="Stat alignment id" value={mon.statAlignmentId}
                  onChange={(v) => setMon(i, { statAlignmentId: v })} />
                {STAT_KEYS.map((key) => (
                  <label key={key} className="edit-field stat">
                    <span>{key.toUpperCase()}</span>
                    <input
                      value={mon.stats[key]}
                      onChange={(e) => setMon(i, { stats: { ...mon.stats, [key]: e.target.value.trim() } })}
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="modal-footer">
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button onClick={save}>Save corrections</button>
        </footer>
      </div>
    </div>
  )
}
