import { describe, expect, it } from 'vitest'
import { encodePatternToMidi, decodeMidiPattern } from './midi'
import type { Pad, Pattern, Transport } from '@shared/types'

const createTestPad = (id: string, name: string, color: string): Pad => ({
  id,
  name,
  color,
  gain: 1,
  attack: 0,
  decay: 0.2,
  startOffset: 0,
  trimStart: 0,
  trimEnd: null,
  loop: false,
  muted: false,
  reverbPreset: 'off',
  reverbMix: 0,
  noiseGate: {
    enabled: false,
    threshold: -60,
    attack: 10,
    release: 200,
  },
  eq: {
    '31': 0,
    '62': 0,
    '125': 0,
    '250': 0,
    '500': 0,
    '1k': 0,
    '2k': 0,
    '4k': 0,
    '8k': 0,
    '16k': 0,
  },
})

const pads: Pad[] = [
  createTestPad('pad-0', 'Pad 1', '#ffffff'),
  createTestPad('pad-1', 'Pad 2', '#000000'),
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
