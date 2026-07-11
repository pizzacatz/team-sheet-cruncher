import { useState } from 'react'
import type { UsageEntry } from '../model/aggregate'

/**
 * Horizontal bar ranking for one usage metric. Single measure → single hue
 * (the series-1 token); values sit at the bar tip in text ink, per the
 * dataviz mark specs. A table toggle provides the accessible view.
 */
export function UsageChart({
  title,
  entries,
  topN = 15,
  onSelect,
  selectedId,
}: {
  title: string
  entries: UsageEntry[]
  topN?: number
  onSelect?: (id: string) => void
  selectedId?: string
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [showAll, setShowAll] = useState(false)

  if (entries.length === 0) return null
  const visible = showAll ? entries : entries.slice(0, topN)
  const max = entries[0].count

  return (
    <section className="usage-card">
      <header className="usage-header">
        <h3>{title}</h3>
        <div className="usage-controls">
          {entries.length > topN && (
            <button className="ghost" onClick={() => setShowAll((v) => !v)}>
              {showAll ? `Top ${topN}` : `All ${entries.length}`}
            </button>
          )}
          <button className="ghost" onClick={() => setView(view === 'chart' ? 'table' : 'chart')}>
            {view === 'chart' ? 'Table' : 'Chart'}
          </button>
        </div>
      </header>

      {view === 'chart' ? (
        <ol className="bar-list">
          {visible.map((e) => (
            <li key={e.id}>
              <button
                className={`bar-row${onSelect ? ' selectable' : ''}${selectedId === e.id ? ' selected' : ''}`}
                onClick={onSelect ? () => onSelect(e.id) : undefined}
                disabled={!onSelect}
                title={`${e.name}: ${e.count} Pokémon, on ${e.teams} of the uploaded teams (${pct(e.teamPct)})`}
              >
                <span className="bar-label">{e.name}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${(e.count / max) * 100}%` }} />
                  <span className="bar-value">
                    {e.count} · {pct(e.teamPct)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <table className="data-table usage-table">
          <thead>
            <tr>
              <th>Name</th>
              <th className="num">Count</th>
              <th className="num">Teams</th>
              <th className="num">% of teams</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td className="num">{e.count}</td>
                <td className="num">{e.teams}</td>
                <td className="num">{pct(e.teamPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`
}
