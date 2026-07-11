import { describe, expect, it } from 'vitest'
import { decodeWheel, effectiveWeights, encodeWheel, pickWinner, type Entry } from './wheel'

const e = (label: string, percent?: number): Entry => ({ id: label, label, percent })

describe('effectiveWeights', () => {
  it('splits evenly without overrides', () => {
    expect(effectiveWeights([e('a'), e('b'), e('c'), e('d')])).toEqual([25, 25, 25, 25])
  })

  it('distributes the remainder among free entries', () => {
    expect(effectiveWeights([e('a', 50), e('b'), e('c')])).toEqual([50, 25, 25])
  })

  it('normalizes proportionally when overrides exceed 100', () => {
    const w = effectiveWeights([e('a', 100), e('b', 100)])
    expect(w).toEqual([50, 50])
    expect(w.reduce((s, x) => s + x, 0)).toBeCloseTo(100)
  })

  it('falls back to even split when everything is zero', () => {
    expect(effectiveWeights([e('a', 0), e('b', 0)])).toEqual([50, 50])
  })
})

describe('encode/decode', () => {
  it('round-trips labels and percents', () => {
    const entries = [e('Pizza Ää 🎡', 12.5), e('Pasta')]
    const decoded = decodeWheel(encodeWheel(entries))
    expect(decoded?.map((x) => [x.label, x.percent])).toEqual([
      ['Pizza Ää 🎡', 12.5],
      ['Pasta', undefined],
    ])
  })

  it('round-trips custom colors', () => {
    const entries: Entry[] = [{ id: 'x', label: 'A', color: '#ff0000' }]
    expect(decodeWheel(encodeWheel(entries))?.[0].color).toBe('#ff0000')
  })

  it('rejects invalid colors', () => {
    expect(decodeWheel(btoa(JSON.stringify([{ l: 'a', c: 'red' }])))).toBeNull()
    expect(decodeWheel(btoa(JSON.stringify([{ l: 'a', c: '#12345g' }])))).toBeNull()
  })

  it('rejects garbage and invalid shapes', () => {
    expect(decodeWheel('not base64!!')).toBeNull()
    expect(decodeWheel(btoa('{"x":1}'))).toBeNull()
    expect(decodeWheel(btoa('[]'))).toBeNull()
    expect(decodeWheel(btoa(JSON.stringify([{ l: 'a', p: 200 }])))).toBeNull()
    expect(decodeWheel(btoa(JSON.stringify([{ l: 42 }])))).toBeNull()
    expect(decodeWheel(btoa(JSON.stringify(Array.from({ length: 25 }, () => ({ l: 'x' })))))).toBeNull()
  })
})

describe('pickWinner', () => {
  it('never picks zero-weight entries', () => {
    for (let i = 0; i < 200; i++) {
      expect(pickWinner([0, 100, 0])).toBe(1)
    }
  })
})
