/** One decoded Pokémon slot from a staff sheet payload (raw slug ids, not names). */
export interface DecodedMon {
  /** 1-based slot on the team sheet. */
  slot: number
  speciesId: string
  formId: string
  abilityId: string
  itemId: string
  /** Always length 4; empty string = empty move slot. */
  moves: string[]
  statAlignmentId: string
  /** Final displayed stat values, kept as strings (may be empty). */
  stats: {
    hp: string
    atk: string
    def: string
    spa: string
    spd: string
    spe: string
  }
}

/** One decoded team (one staff sheet). Empty slots are omitted. */
export interface DecodedTeam {
  sourceFile: string
  mons: DecodedMon[]
  /** Non-fatal oddities found while decoding (unexpected slot/field counts…). */
  warnings: string[]
}

export type ParseOutcome =
  | { status: 'ok'; team: DecodedTeam }
  | { status: 'skipped'; sourceFile: string; reason: string }
  | { status: 'error'; sourceFile: string; reason: string }
