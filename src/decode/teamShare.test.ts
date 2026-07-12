import { describe, expect, it } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { decodeTeamShare, extractSharePayloads } from './teamShare'

/** Encode a share payload exactly like the builder's encodeTeamShare. */
function encodeShare(payload: object): string {
  return deflateRawSync(Buffer.from(JSON.stringify(payload), 'utf8')).toString('base64url')
}

const MON =
  'incineroar,,intimidate,safety-goggles,fake-out,knock-off,flare-blitz,parting-shot,Careful,177,135,111,,120,80'
const EMPTY = ','.repeat(14)
const TEAM = [MON, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY].join('|')

const PLAYER = {
  name: 'Ash Ketchum',
  playerId: '1234-5678',
  division: 'Masters',
  dateOfBirth: '1996-05-22',
}

describe('extractSharePayloads', () => {
  it('finds every #t= payload in a pasted email body', () => {
    const body = [
      'Hi TO, my team: https://teamsheet.example.com/#t=AbC-12_x please confirm.',
      'And my sibling: https://teamsheet.example.com/#t=ZzZ999',
    ].join('\n')
    expect(extractSharePayloads(body)).toEqual(['AbC-12_x', 'ZzZ999'])
  })

  it('returns nothing for text without links', () => {
    expect(extractSharePayloads('no links here')).toEqual([])
  })
})

describe('decodeTeamShare', () => {
  it('decodes a team-plus-player link', async () => {
    const team = await decodeTeamShare(encodeShare({ v: 1, team: TEAM, player: PLAYER }), 'link 1')
    expect(team).not.toBeNull()
    expect(team!.mons).toHaveLength(1)
    expect(team!.mons[0].speciesId).toBe('incineroar')
    expect(team!.mons[0].statAlignmentId).toBe('Careful')
    expect(team!.player).toEqual(PLAYER)
    expect(team!.payload).toBe(TEAM)
    expect(team!.warnings).toEqual([])
  })

  it('decodes a team-only link with no player', async () => {
    const team = await decodeTeamShare(encodeShare({ v: 1, team: TEAM }), 'link')
    expect(team!.player).toBeUndefined()
  })

  it('warns on an unknown version but still decodes', async () => {
    const team = await decodeTeamShare(encodeShare({ v: 2, team: TEAM }), 'link')
    expect(team!.mons).toHaveLength(1)
    expect(team!.warnings.some((w) => w.includes('version'))).toBe(true)
  })

  it('drops non-string and empty player fields', async () => {
    const team = await decodeTeamShare(
      encodeShare({ v: 1, team: TEAM, player: { name: 'Ash', playerId: 42, division: '' } }),
      'link',
    )
    expect(team!.player).toEqual({ name: 'Ash' })
  })

  it.each([
    ['not base64url at all', '!!!'],
    ['valid base64url, not DEFLATE', 'AbC-12_x'],
    ['DEFLATE of non-JSON', deflateRawSync(Buffer.from('nope')).toString('base64url')],
    ['JSON without a team string', encodeShare({ v: 1 })],
  ])('returns null on malformed input: %s', async (_label, encoded) => {
    expect(await decodeTeamShare(encoded, 'link')).toBeNull()
  })
})
