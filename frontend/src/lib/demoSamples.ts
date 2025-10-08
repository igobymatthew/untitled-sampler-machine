import type { PadId } from '@shared/types'
import { engine } from '../audio/Engine'

type DemoBufferMap = Record<PadId, AudioBuffer>

let cached: { sampleRate: number; buffers: DemoBufferMap } | null = null

function createBuffer(duration: number): AudioBuffer {
  const ctx = engine.ctx as Partial<AudioContext>
  const sampleRate = ctx.sampleRate ?? 44100
  const length = Math.max(1, Math.floor(sampleRate * duration))
  if (typeof ctx.createBuffer === 'function') {
    return ctx.createBuffer(1, length, sampleRate)
  }

  const channelData = new Float32Array(length)
  const fallback: AudioBuffer = {
    length,
    duration: length / sampleRate,
    numberOfChannels: 1,
    sampleRate,
    getChannelData(channel: number) {
      if (channel !== 0) throw new Error('Fallback buffer is mono-only')
      return channelData
    },
    copyFromChannel(destination: Float32Array, channel: number, startInChannel = 0) {
      if (channel !== 0) throw new Error('Fallback buffer is mono-only')
      destination.set(channelData.subarray(startInChannel, startInChannel + destination.length))
    },
    copyToChannel(source: Float32Array, channel: number, startInChannel = 0) {
      if (channel !== 0) throw new Error('Fallback buffer is mono-only')
      channelData.set(source, startInChannel)
    },
  } as unknown as AudioBuffer

  return fallback
}

function applyFade(buffer: AudioBuffer, tail = 0.005) {
  const data = buffer.getChannelData(0)
  const fadeSamples = Math.min(data.length, Math.floor(buffer.sampleRate * tail))
  for (let i = 0; i < fadeSamples; i++) {
    const factor = i / fadeSamples
    data[data.length - 1 - i] *= factor
  }
}

function createKick(): AudioBuffer {
  const buffer = createBuffer(0.9)
  const data = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  const startFreq = 160
  const endFreq = 45
  let phase = 0

  for (let i = 0; i < data.length; i++) {
    const progress = i / data.length
    const freq = endFreq + (startFreq - endFreq) * Math.pow(1 - progress, 2)
    const angular = (2 * Math.PI * freq) / sampleRate
    phase += angular
    const amp = Math.pow(1 - progress, 3.2)
    data[i] = Math.sin(phase) * amp
  }

  applyFade(buffer)
  return buffer
}

function createSnare(): AudioBuffer {
  const buffer = createBuffer(0.6)
  const data = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  const toneFreq = 185
  let phase = 0

  for (let i = 0; i < data.length; i++) {
    const progress = i / data.length
    const noise = (Math.random() * 2 - 1) * Math.pow(1 - progress, 4.5)
    phase += (2 * Math.PI * toneFreq) / sampleRate
    const tone = Math.sin(phase) * Math.pow(1 - progress, 2.2)
    data[i] = (noise * 0.75 + tone * 0.35) * 0.9
  }

  applyFade(buffer)
  return buffer
}

function createClap(): AudioBuffer {
  const buffer = createBuffer(0.5)
  const data = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  const bursts = [0, 0.018, 0.032, 0.045]

  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate
    let value = 0
    for (const burst of bursts) {
      const dt = t - burst
      if (dt < 0) continue
      const envelope = Math.exp(-dt * 45)
      value += (Math.random() * 2 - 1) * envelope
    }
    data[i] = value * 0.3
  }

  applyFade(buffer)
  return buffer
}

function createHiHat(): AudioBuffer {
  const buffer = createBuffer(0.35)
  const data = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  let band = 0
  const filterCoeff = 0.5

  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    band = filterCoeff * band + (1 - filterCoeff) * white
    const progress = i / data.length
    const envelope = Math.pow(1 - progress, 1.8)
    data[i] = (white - band) * envelope * 0.6
  }

  applyFade(buffer)
  return buffer
}

function buildBuffers(): DemoBufferMap {
  return {
    'pad-kick': createKick(),
    'pad-snare': createSnare(),
    'pad-clap': createClap(),
    'pad-hihat': createHiHat(),
  }
}

export function ensureDemoBuffers(): DemoBufferMap {
  const ctx = engine.ctx
  if (cached && cached.sampleRate === ctx.sampleRate) {
    return cached.buffers
  }

  const buffers = buildBuffers()
  cached = { sampleRate: ctx.sampleRate, buffers }
  return buffers
}
