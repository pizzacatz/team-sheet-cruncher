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

/**
 * Player info carried by a `#t=` team-share link (SPEC §2.3). PII by design —
 * on-device only, never uploaded. All fields are optional free text.
 */
export interface PlayerInfo {
  name?: string
  playerId?: string
  division?: string
  teamName?: string
  trainerName?: string
  switchProfileName?: string
  supportId?: string
  dateOfBirth?: string
  eventName?: string
  date?: string
}

/** One decoded team (one staff sheet or one `#t=` link). Empty slots are omitted. */
export interface DecodedTeam {
  /** Origin label: PDF file name (`file.pdf` / `file.pdf#p2`) or a link label. */
  sourceFile: string
  mons: DecodedMon[]
  /**
   * The original `<mon>|<mon>|…` slug payload this team was decoded from —
   * the dedup key (SPEC §7/§9.2): identical payload = identical team.
   */
  payload: string
  /** Present only on `#t=` link-sourced teams (never on PDFs). */
  player?: PlayerInfo
  /** Non-fatal oddities found while decoding (unexpected slot/field counts…). */
  warnings: string[]
}

export type ParseOutcome =
  | { status: 'ok'; team: DecodedTeam }
  /** Identical payload already stored in the target tournament (SPEC §9.2). */
  | { status: 'duplicate'; sourceFile: string; reason: string }
  | { status: 'skipped'; sourceFile: string; reason: string }
  | { status: 'error'; sourceFile: string; reason: string }
