import type { ParseOutcome } from '../decode/types'

const LABELS = { ok: 'OK', duplicate: 'Duplicate', skipped: 'Skipped', error: 'Error' } as const

export function FileStatusList({ outcomes }: { outcomes: ParseOutcome[] }) {
  return (
    <ul className="file-list">
      {outcomes.map((o, i) => (
        <li key={i} className={`file-item ${o.status}`}>
          <span className={`badge ${o.status}`}>{LABELS[o.status]}</span>
          <span className="file-name">{o.status === 'ok' ? o.team.sourceFile : o.sourceFile}</span>
          <span className="file-detail">
            {o.status === 'ok'
              ? `${o.team.mons.length} Pokémon${o.team.warnings.length ? ` — ${o.team.warnings.join('; ')}` : ''}`
              : o.reason}
          </span>
        </li>
      ))}
    </ul>
  )
}
