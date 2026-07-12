import { useRef, useState } from 'react'
import { UNASSIGNED, type StoredTeam, type Tournament } from '../store/db'

/**
 * Tournament CRUD + backup (SPEC §9.2/§9.3). Deleting a tournament deletes
 * its teams too; export/import moves everything (PII included) as a JSON
 * file the TO safeguards.
 */
export function TournamentManager({
  tournaments,
  teams,
  onCreate,
  onRename,
  onDelete,
  onExport,
  onImport,
}: {
  tournaments: Tournament[]
  teams: StoredTeam[]
  onCreate: (name: string) => void
  onRename: (t: Tournament, name: string) => void
  onDelete: (t: Tournament) => void
  onExport: (tournamentIds?: string[]) => void
  onImport: (file: File) => void
}) {
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const countFor = (id: string) => teams.filter((t) => t.tournamentId === id).length
  const unassigned = countFor(UNASSIGNED)

  const create = () => {
    const name = newName.trim()
    if (!name) return
    onCreate(name)
    setNewName('')
  }

  return (
    <div className="tournament-manager">
      <div className="tournament-create">
        <input
          placeholder="New tournament name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <button onClick={create} disabled={!newName.trim()}>Create tournament</button>
      </div>

      <ul className="tournament-list">
        {tournaments.map((t) => (
          <li key={t.id} className="tournament-item">
            {renaming?.id === t.id ? (
              <>
                <input
                  autoFocus
                  value={renaming.name}
                  onChange={(e) => setRenaming({ id: t.id, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && renaming.name.trim()) {
                      onRename(t, renaming.name.trim())
                      setRenaming(null)
                    }
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                />
                <button
                  disabled={!renaming.name.trim()}
                  onClick={() => {
                    onRename(t, renaming.name.trim())
                    setRenaming(null)
                  }}
                >
                  Save
                </button>
                <button className="ghost" onClick={() => setRenaming(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span className="tournament-name">{t.name}</span>
                <span className="tournament-count">{countFor(t.id)} teams</span>
                <button className="ghost" onClick={() => setRenaming({ id: t.id, name: t.name })}>Rename</button>
                <button className="ghost" onClick={() => onExport([t.id])}>Export</button>
                <button className="ghost danger" onClick={() => onDelete(t)}>Delete</button>
              </>
            )}
          </li>
        ))}
        <li className="tournament-item unassigned">
          <span className="tournament-name">Unassigned</span>
          <span className="tournament-count">{unassigned} teams</span>
        </li>
      </ul>

      <div className="backup-row">
        <button onClick={() => onExport()}>Export everything</button>
        <button className="ghost" onClick={() => importRef.current?.click()}>Import backup…</button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImport(file)
            e.target.value = ''
          }}
        />
      </div>
      <p className="hint">
        Data lives only in this browser — clearing site data deletes it. Export
        regularly; export files contain player info, so treat them like the
        emails they came from.
      </p>
    </div>
  )
}
