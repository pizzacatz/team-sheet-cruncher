import { useState } from 'react'
import type { Aggregates } from '../model/aggregate'
import { resolveName } from '../data/registry'
import { UsageChart } from './UsageChart'

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value.toLocaleString()}</span>
    </div>
  )
}

export function Dashboard({
  aggregates,
  sheets,
  failures,
}: {
  aggregates: Aggregates
  sheets: number
  failures: number
}) {
  const [speciesId, setSpeciesId] = useState<string | null>(null)
  const detail = speciesId ? aggregates.perSpecies.get(speciesId) : undefined

  if (aggregates.totalTeams === 0) {
    return <p className="empty">No teams decoded yet — upload some staff-sheet PDFs.</p>
  }

  return (
    <div className="dashboard">
      <div className="stat-row">
        <StatTile label="Sheets processed" value={sheets} />
        <StatTile label="Teams decoded" value={aggregates.totalTeams} />
        <StatTile label="Pokémon" value={aggregates.totalMons} />
        <StatTile label="Unique species" value={aggregates.species.length} />
        <StatTile label="Skipped / failed" value={failures} />
      </div>

      <div className="usage-grid">
        <UsageChart
          title="Species usage"
          entries={aggregates.species}
          onSelect={(id) => setSpeciesId(id === speciesId ? null : id)}
          selectedId={speciesId ?? undefined}
        />
        {detail && speciesId && (
          <section className="usage-card drilldown">
            <header className="usage-header">
              <h3>{resolveName('species', speciesId).name} — drill-down</h3>
              <button className="ghost" onClick={() => setSpeciesId(null)}>
                Close
              </button>
            </header>
            <div className="drilldown-cols">
              <UsageChart title="Moves on this species" entries={detail.moves} topN={8} />
              <UsageChart title="Items on this species" entries={detail.items} topN={8} />
            </div>
          </section>
        )}
        <UsageChart title="Item usage" entries={aggregates.items} />
        <UsageChart title="Ability usage" entries={aggregates.abilities} />
        <UsageChart title="Move usage" entries={aggregates.moves} />
        <UsageChart title="Stat alignment usage" entries={aggregates.statAlignments} />
      </div>
      <p className="hint">Click a species bar to see its moves and items.</p>
    </div>
  )
}
