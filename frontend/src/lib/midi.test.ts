import { describe, expect, it } from 'vitest'
import { encodePatternToMidi, decodeMidiPattern } from './midi'
import type { Pad, Pattern, Transport } from '@shared/types'

const pads: Pad[] = [
  {
    id: 'pad-0',
    name: 'Pad 1',
    color: '#ffffff',
    gain: 1,
    attack: 0,
    decay: 0.2,
    startOffset: 0,
    loop: false,
    muted: false,
  },
  {
    id: 'pad-1',
    name: 'Pad 2',
    color: '#000000',
    gain: 1,
    attack: 0,
    decay: 0.2,
    startOffset: 0,
    loop: false,
    muted: false,
  },
]

const transport: Transport = {
  playing: false,
  bpm: 120,
  stepsPerBar: 16,
  bars: 1,
  swing: 0,
}

const pattern: Pattern = {
  steps: {
    0: ['pad-0'],
    4: ['pad-1'],
  },
  length: 16,
}

describe('MIDI utilities', () => {
  it('round-trips a pattern through MIDI encode/decode', () => {
    const bytes = encodePatternToMidi({ pads, pattern, transport })
    const buffer = bytes.slice().buffer
    const decoded = decodeMidiPattern(buffer, pads, transport.stepsPerBar)
    expect(decoded).not.toBeNull()
    expect(decoded?.pattern.steps[0]).toEqual(['pad-0'])
    expect(decoded?.pattern.steps[4]).toEqual(['pad-1'])
    expect(decoded?.pattern.length).toBe(16)
    expect(decoded?.bars).toBe(1)
    expect(decoded?.bpm).toBe(120)
  })

  it('returns a default pattern for MIDI files without notes', () => {
    const emptyPattern: Pattern = { steps: {}, length: 16 }
    const bytes = encodePatternToMidi({ pads, pattern: emptyPattern, transport })
    const buffer = bytes.slice().buffer
    const decoded = decodeMidiPattern(buffer, pads, transport.stepsPerBar)
    expect(decoded).not.toBeNull()
    expect(decoded?.pattern.length).toBe(16)
    expect(decoded?.bars).toBe(1)
  })
})
