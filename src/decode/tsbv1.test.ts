import { describe, expect, it } from 'vitest'
import { decodePayload, decodeText, findSegments, reassemble } from './tsbv1'

const MON =
  'incineroar,,intimidate,safety-goggles,fake-out,knock-off,flare-blitz,parting-shot,Jolly,177,135,110,63,110,92'
const EMPTY_SLOT = ','.repeat(14)

function payloadOf(...slots: string[]): string {
  return slots.join('|')
}

describe('findSegments', () => {
  it('matches TSBv1 lines and ignores everything else', () => {
    const text = `Player Name\nJane Doe\nTSBv1~0~2~abc\nvisible text\nTSBv1~1~2~def`
    expect(findSegments(text)).toEqual([
      { index: 0, count: 2, chunk: 'abc' },
      { index: 1, count: 2, chunk: 'def' },
    ])
  })

  it('does not let a chunk swallow a following sentinel on the same line', () => {
    const text = 'TSBv1~0~2~abcTSBv1~1~2~def'
    expect(findSegments(text)).toEqual([
      { index: 0, count: 2, chunk: 'abc' },
      { index: 1, count: 2, chunk: 'def' },
    ])
  })
})

describe('reassemble', () => {
  it('sorts reordered segments and dedupes repeats', () => {
    const { payload, warnings } = reassemble([
      { index: 1, count: 3, chunk: 'B' },
      { index: 0, count: 3, chunk: 'A' },
      { index: 2, count: 3, chunk: 'C' },
      { index: 1, count: 3, chunk: 'B' },
    ])
    expect(payload).toBe('ABC')
    expect(warnings).toEqual([])
  })

  it('warns on missing segments but still assembles', () => {
    const { payload, warnings } = reassemble([
      { index: 0, count: 3, chunk: 'A' },
      { index: 2, count: 3, chunk: 'C' },
    ])
    expect(payload).toBe('AC')
    expect(warnings).toHaveLength(1)
  })
})

describe('decodePayload', () => {
  it('decodes a full mon into named fields', () => {
    const team = decodePayload(payloadOf(MON, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT), 'a.pdf')
    expect(team.warnings).toEqual([])
    expect(team.mons).toHaveLength(1)
    const mon = team.mons[0]
    expect(mon).toMatchObject({
      slot: 1,
      speciesId: 'incineroar',
      formId: '',
      abilityId: 'intimidate',
      itemId: 'safety-goggles',
      moves: ['fake-out', 'knock-off', 'flare-blitz', 'parting-shot'],
      statAlignmentId: 'Jolly',
      stats: { hp: '177', atk: '135', def: '110', spa: '63', spd: '110', spe: '92' },
    })
  })

  it('skips empty slots but keeps slot numbers positional', () => {
    const team = decodePayload(payloadOf(EMPTY_SLOT, MON, EMPTY_SLOT, MON, EMPTY_SLOT, EMPTY_SLOT), 'a.pdf')
    expect(team.mons.map((m) => m.slot)).toEqual([2, 4])
  })

  it('warns on unexpected slot count', () => {
    const team = decodePayload(payloadOf(MON, MON), 'a.pdf')
    expect(team.mons).toHaveLength(2)
    expect(team.warnings.some((w) => w.includes('team slots'))).toBe(true)
  })
})

describe('decodeText', () => {
  it('returns null when no payload is present (Open sheet / foreign PDF)', () => {
    expect(decodeText('Open Team Sheet\nsome visible text', 'open.pdf')).toBeNull()
  })

  it('reassembles a payload split across interleaved lines', () => {
    const payload = payloadOf(MON, MON, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT)
    const a = payload.slice(0, 40)
    const b = payload.slice(40, 90)
    const c = payload.slice(90)
    const text = `header\nTSBv1~2~3~${c}\nnoise\nTSBv1~0~3~${a}\nTSBv1~1~3~${b}\n`
    const team = decodeText(text, 'x.pdf')
    expect(team).not.toBeNull()
    expect(team!.mons).toHaveLength(2)
    expect(team!.mons[0].speciesId).toBe('incineroar')
    expect(team!.warnings).toEqual([])
  })
})
