import type { DecodedMon, PlayerInfo } from '../decode/types'
import { resolveName } from '../data/registry'

/**
 * Read-only rendering of a decoded team (SPEC §9.1): player block when
 * present, then the six Pokémon. No editing controls of any kind.
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

export function PlayerBlock({ player }: { player: PlayerInfo }) {
  const rows = PLAYER_FIELDS.filter(([key]) => player[key])
  if (rows.length === 0) return null
  return (
    <dl className="player-block">
      {rows.map(([key, label]) => (
        <div key={key} className="player-field">
          <dt>{label}</dt>
          <dd>{player[key]}</dd>
        </div>
      ))}
    </dl>
  )
}

function MonCard({ mon }: { mon: DecodedMon }) {
  const species = resolveName('species', mon.speciesId)
  const stats: [string, string][] = [
    ['HP', mon.stats.hp], ['Atk', mon.stats.atk], ['Def', mon.stats.def],
    ['SpA', mon.stats.spa], ['SpD', mon.stats.spd], ['Spe', mon.stats.spe],
  ]
  return (
    <article className="mon-card">
      <header>
        <h3>{species.name || '—'}</h3>
        {mon.formId && <span className="mon-form">{mon.formId}</span>}
      </header>
      <dl className="mon-fields">
        <div><dt>Item</dt><dd>{resolveName('item', mon.itemId).name || '—'}</dd></div>
        <div><dt>Ability</dt><dd>{resolveName('ability', mon.abilityId).name || '—'}</dd></div>
        <div><dt>Alignment</dt><dd>{resolveName('statAlignment', mon.statAlignmentId).name || '—'}</dd></div>
      </dl>
      <ul className="mon-moves">
        {mon.moves.filter(Boolean).map((m) => (
          <li key={m}>{resolveName('move', m).name}</li>
        ))}
      </ul>
      <div className="mon-stats">
        {stats.map(([label, value]) => (
          <span key={label}>
            <em>{label}</em> {value || '—'}
          </span>
        ))}
      </div>
    </article>
  )
}

export function TeamSheetView({ mons, player }: { mons: DecodedMon[]; player?: PlayerInfo }) {
  return (
    <div className="team-sheet-view">
      {player && <PlayerBlock player={player} />}
      <div className="mon-grid">
        {mons.map((mon) => (
          <MonCard key={mon.slot} mon={mon} />
        ))}
      </div>
    </div>
  )
}
