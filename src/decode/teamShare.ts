import { decodePayload } from './tsbv1'
import type { DecodedTeam, PlayerInfo } from './types'

/**
 * Decoder for `#t=` team-share links (SPEC.md §2.3), ported from the builder's
 * src/domain/teamShare.ts: base64url → raw-DEFLATE inflate → JSON
 * `{ v, team, player? }`. `team` is the same `<mon>|<mon>|…` slug payload as
 * the TSBv1 carrier (no `TSBv1~i~n~` wrapper), so decodePayload is reused.
 *
 * PII note: `player` is player info by design (TO attribution) — on-device
 * only, never uploaded.
 */

const SHARE_VERSION = 1

/** Matches `#t=<payload>` anywhere in pasted text (links or whole email bodies). */
const SHARE_LINK_RE = /#t=([A-Za-z0-9\-_]+)/g

/** Extract every `#t=` payload from pasted text, in order of appearance. */
export function extractSharePayloads(text: string): string[] {
  return [...text.matchAll(SHARE_LINK_RE)].map((m) => m[1])
}

function fromBase64Url(value: string): Uint8Array {
  const padded =
    value.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// Push bytes through the decompression stream. On invalid input the stream
// errors on BOTH ends; the read error propagates to the caller, while the
// write-side rejection is explicitly observed so it never becomes an
// unhandled rejection.
async function inflateRaw(bytes: Uint8Array): Promise<string> {
  const transform = new DecompressionStream('deflate-raw')
  const writer = transform.writable.getWriter()
  writer
    .write(bytes as BufferSource)
    .then(() => writer.close())
    .catch(() => {})
  return new TextDecoder().decode(await new Response(transform.readable).arrayBuffer())
}

function sanitizePlayer(raw: unknown): PlayerInfo | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const src = raw as Record<string, unknown>
  const player: PlayerInfo = {}
  const keys: (keyof PlayerInfo)[] = [
    'name', 'playerId', 'division', 'teamName', 'trainerName',
    'switchProfileName', 'supportId', 'dateOfBirth', 'eventName', 'date',
  ]
  for (const key of keys) {
    const value = src[key]
    if (typeof value === 'string' && value !== '') player[key] = value
  }
  return Object.keys(player).length > 0 ? player : undefined
}

/**
 * Decode one `#t=` payload into a team. Returns null on any malformed input
 * (bad base64url, inflate failure, non-JSON, missing team string) — the
 * caller reports it as a skipped link, per SPEC §7.
 */
export async function decodeTeamShare(
  encoded: string,
  sourceLabel: string,
): Promise<DecodedTeam | null> {
  let parsed: { v?: unknown; team?: unknown; player?: unknown }
  try {
    parsed = JSON.parse(await inflateRaw(fromBase64Url(encoded)))
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || typeof parsed.team !== 'string') {
    return null
  }

  const warnings: string[] = []
  if (parsed.v !== SHARE_VERSION) {
    warnings.push(
      `unknown share-link version ${JSON.stringify(parsed.v)} (expected ${SHARE_VERSION}); decoded best-effort`,
    )
  }

  const team = decodePayload(parsed.team, sourceLabel, warnings)
  team.player = sanitizePlayer(parsed.player)
  return team
}
