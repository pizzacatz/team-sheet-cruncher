import type { MonRow } from '../model/rows'

export function TeamsTable({ rows }: { rows: MonRow[] }) {
  if (rows.length === 0) return <p className="empty">No decoded Pokémon yet.</p>
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Source file</th>
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
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="file-cell">{r.sourceFile}</td>
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
        </tbody>
      </table>
    </div>
  )
}
