import { Fragment } from 'react'
import { toRows } from '../model/rows'
import type { StoredTeam } from '../store/db'

/**
 * One header row per stored team (identity, tournament, source, actions),
 * then one row per Pokémon. Edit/delete act on the whole team (SPEC §9.2).
 */
export function TeamsTable({
  teams,
  tournamentNames,
  onEdit,
  onDelete,
}: {
  teams: StoredTeam[]
  tournamentNames: Map<string, string>
  onEdit: (team: StoredTeam) => void
  onDelete: (team: StoredTeam) => void
}) {
  if (teams.length === 0) {
    return <p className="empty">No stored teams match the current filter.</p>
  }
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Slot</th>
            <th>Species</th>
            <th>Form</th>
            <th>Ability</th>
            <th>Item</th>
            <th>Moves</th>
            <th>Stat alignment</th>
            <th>HP</th>
            <th>Atk</th>
            <th>Def</th>
            <th>SpA</th>
            <th>SpD</th>
            <th>Spe</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => {
            const tournament = tournamentNames.get(team.tournamentId) ?? ''
            const rows = toRows(team, tournament)
            return (
              <Fragment key={team.id}>
                <tr className="team-row">
                  <td colSpan={10}>
                    <span className="team-title">
                      {team.player?.name ?? team.sourceFile}
                      {team.player?.name && <span className="team-source"> — {team.sourceFile}</span>}
                    </span>
                    {team.player?.division && <span className="team-meta">{team.player.division}</span>}
                    <span className="team-meta">{tournament || 'Unassigned'}</span>
                    {team.editedAt && (
                      <span className="badge edited" title="Hand-corrected by the TO">edited</span>
                    )}
                    {team.warnings.length > 0 && (
                      <span className="stale" title={team.warnings.join('; ')}> ⚠</span>
                    )}
                  </td>
                  <td colSpan={3} className="team-actions">
                    <button className="ghost" onClick={() => onEdit(team)}>Edit</button>
                    <button className="ghost danger" onClick={() => onDelete(team)}>Delete</button>
                  </td>
                </tr>
                {rows.map((r) => (
                  <tr key={`${team.id}-${r.slot}`}>
                    <td className="num">{r.slot}</td>
                    <td>
                      {r.species}
                      {r.unknownSlugs.length > 0 && (
                        <span
                          className="stale"
                          title={`Not in bundled data (stale snapshot?): ${r.unknownSlugs.join(', ')}`}
                        >
                          {' '}⚠
                        </span>
                      )}
                    </td>
                    <td>{r.form}</td>
                    <td>{r.ability}</td>
                    <td>{r.item}</td>
                    <td>{r.moves.filter(Boolean).join(', ')}</td>
                    <td>{r.statAlignment}</td>
                    <td className="num">{r.hp}</td>
                    <td className="num">{r.atk}</td>
                    <td className="num">{r.def}</td>
                    <td className="num">{r.spa}</td>
                    <td className="num">{r.spd}</td>
                    <td className="num">{r.spe}</td>
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
