import type { Pad, Pattern, Transport } from '@shared/types'

const DEFAULT_PPQ = 480
const BASE_NOTE = 60
const DEFAULT_VELOCITY = 100

function encodeVarInt(value: number): number[] {
  const buffer: number[] = []
  let val = value >>> 0
  do {
    let byte = val & 0x7f
    val >>>= 7
    if (buffer.length) {
      byte |= 0x80
    }
    buffer.unshift(byte)
  } while (val > 0)
  if (buffer.length === 0) {
    buffer.push(0)
  }
  return buffer
}

function writeHeaderChunk(): Uint8Array {
  const header = new Uint8Array(14)
  header.set([0x4d, 0x54, 0x68, 0x64]) // 'MThd'
  header.set([0x00, 0x00, 0x00, 0x06], 4)
  header.set([0x00, 0x00], 8) // format 0
  header.set([0x00, 0x01], 10) // one track
  header.set([(DEFAULT_PPQ >> 8) & 0xff, DEFAULT_PPQ & 0xff], 12)
  return header
}

function createTempoEvent(bpm: number): number[] {
  const microsPerQuarter = Math.max(1, Math.round(60_000_000 / Math.max(1, bpm)))
  return [
    ...encodeVarInt(0),
    0xff,
    0x51,
    0x03,
    (microsPerQuarter >> 16) & 0xff,
    (microsPerQuarter >> 8) & 0xff,
    microsPerQuarter & 0xff,
  ]
}

function createTimeSignatureEvent(): number[] {
  // Default to 4/4 with 16th-note resolution
  return [...encodeVarInt(0), 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08]
}

function ticksPerStep(transport: Transport): number {
  return Math.max(1, Math.round((DEFAULT_PPQ * 4) / Math.max(1, transport.stepsPerBar)))
}

export function encodePatternToMidi({
  pads,
  pattern,
  transport,
}: {
  pads: Pad[]
  pattern: Pattern
  transport: Transport
}): Uint8Array {
  const trackEvents: number[] = []
  trackEvents.push(...createTempoEvent(transport.bpm))
  trackEvents.push(...createTimeSignatureEvent())

  const ticksStep = ticksPerStep(transport)
  let lastTick = 0

  const pushEvent = (tick: number, data: number[]) => {
    const delta = Math.max(0, tick - lastTick)
    trackEvents.push(...encodeVarInt(delta), ...data)
    lastTick = tick
  }

  for (let step = 0; step < pattern.length; step += 1) {
    const padIds = pattern.steps[step]
    if (!padIds || padIds.length === 0) continue

    const startTick = step * ticksStep
    const endTick = startTick + ticksStep

    padIds.forEach(padId => {
      const padIndex = pads.findIndex(p => p.id === padId)
      if (padIndex === -1) return
      const noteNumber = BASE_NOTE + padIndex
      pushEvent(startTick, [0x90, noteNumber, DEFAULT_VELOCITY])
      pushEvent(endTick, [0x80, noteNumber, 0])
    })
  }

  const patternTicks = pattern.length * ticksStep
  const remaining = Math.max(0, patternTicks - lastTick)
  trackEvents.push(...encodeVarInt(remaining))
  trackEvents.push(0xff, 0x2f, 0x00) // end of track

  const trackLength = trackEvents.length
  const trackChunk = new Uint8Array(8 + trackLength)
  trackChunk.set([0x4d, 0x54, 0x72, 0x6b]) // 'MTrk'
  trackChunk[4] = (trackLength >>> 24) & 0xff
  trackChunk[5] = (trackLength >>> 16) & 0xff
  trackChunk[6] = (trackLength >>> 8) & 0xff
  trackChunk[7] = trackLength & 0xff
  trackChunk.set(trackEvents, 8)

  const file = new Uint8Array(14 + trackChunk.length)
  file.set(writeHeaderChunk())
  file.set(trackChunk, 14)
  return file
}

export function createMidiBlob(args: {
  pads: Pad[]
  pattern: Pattern
  transport: Transport
}): Blob {
  const bytes = encodePatternToMidi(args)
  const copy = bytes.slice()
  return new Blob([copy.buffer], { type: 'audio/midi' })
}

function readVarInt(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let result = 0
  let index = offset
  while (index < bytes.length) {
    const byte = bytes[index++]
    result = (result << 7) | (byte & 0x7f)
    if ((byte & 0x80) === 0) break
  }
  return { value: result, next: index }
}

export type MidiImportResult = {
  pattern: Pattern
  bars: number
  bpm?: number
}

export function decodeMidiPattern(
  buffer: ArrayBuffer,
  pads: Pad[],
  stepsPerBar: number,
): MidiImportResult | null {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 14) return null

  const headerId = String.fromCharCode(...bytes.subarray(0, 4))
  if (headerId !== 'MThd') return null
  const format = (bytes[8] << 8) | bytes[9]
  const tracks = (bytes[10] << 8) | bytes[11]
  const division = (bytes[12] << 8) | bytes[13]
  if (division <= 0 || tracks === 0) return null

  let offset = 14
  const notes: { note: number; tick: number }[] = []
  let tempoBpm: number | undefined

  for (let trackIndex = 0; trackIndex < tracks && offset < bytes.length; trackIndex += 1) {
    if (offset + 8 > bytes.length) return null
    const chunkId = String.fromCharCode(...bytes.subarray(offset, offset + 4))
    offset += 4
    const length =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]
    offset += 4
    const trackEnd = Math.min(bytes.length, offset + length)
    if (chunkId !== 'MTrk') {
      offset = trackEnd
      continue
    }

    let tick = 0
    let status: number | null = null

    while (offset < trackEnd) {
      const { value: delta, next } = readVarInt(bytes, offset)
      offset = next
      tick += delta
      if (offset >= trackEnd) break

      let eventTypeByte = bytes[offset++]
      if (eventTypeByte === 0xff) {
        if (offset >= trackEnd) break
        const metaType = bytes[offset++]
        const lenInfo = readVarInt(bytes, offset)
        offset = lenInfo.next
        const dataStart = offset
        const dataEnd = offset + lenInfo.value
        const metaData = bytes.subarray(dataStart, dataEnd)
        offset = dataEnd
        if (metaType === 0x51 && metaData.length === 3) {
          const micros = (metaData[0] << 16) | (metaData[1] << 8) | metaData[2]
          if (micros > 0) {
            tempoBpm = Math.round(60_000_000 / micros)
          }
        }
        continue
      }

      if (eventTypeByte === 0xf0 || eventTypeByte === 0xf7) {
        const lenInfo = readVarInt(bytes, offset)
        offset = lenInfo.next + lenInfo.value
        continue
      }

      let statusByte = eventTypeByte
      let param1: number
      if (eventTypeByte < 0x80) {
        if (status === null) {
          throw new Error('Invalid running status in MIDI file')
        }
        statusByte = status
        param1 = eventTypeByte
      } else {
        status = eventTypeByte
        param1 = bytes[offset++]
      }

      let param2: number | undefined
      const eventType = statusByte & 0xf0
      if (eventType !== 0xc0 && eventType !== 0xd0) {
        param2 = bytes[offset++]
      }

      if (eventType === 0x90 && (param2 ?? 0) > 0) {
        notes.push({ note: param1, tick })
      } else if (eventType === 0x90 && (param2 ?? 0) === 0) {
        // treated as note off
      } else if (eventType === 0x80) {
        // note off ignored for step data
      }
    }

    offset = trackEnd
    if (format === 0) break
  }

  if (notes.length === 0) {
    return {
      pattern: { steps: {}, length: stepsPerBar },
      bars: 1,
      bpm: tempoBpm,
    }
  }

  const ticksStep = Math.max(1, Math.round((division * 4) / Math.max(1, stepsPerBar)))
  const steps: Record<number, string[]> = {}
  let maxStep = 0

  notes.forEach(({ note, tick }) => {
    const padIndex = note - BASE_NOTE
    if (padIndex < 0 || padIndex >= pads.length) return
    const padId = pads[padIndex].id
    const stepIndex = Math.max(0, Math.round(tick / ticksStep))
    maxStep = Math.max(maxStep, stepIndex)
    const existing = steps[stepIndex] ?? []
    if (!existing.includes(padId)) {
      steps[stepIndex] = [...existing, padId]
    }
  })

  const usableLength = Math.max(stepsPerBar, maxStep + 1)
  const bars = Math.max(1, Math.ceil(usableLength / stepsPerBar))
  const length = bars * stepsPerBar

  return {
    pattern: { steps, length },
    bars,
    bpm: tempoBpm,
  }
}
