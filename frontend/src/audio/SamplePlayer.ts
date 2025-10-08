import { engine } from './Engine'

export type PlaybackOpts = {
  gain: number
  attack: number
  decay: number
  startOffset: number
  endOffset?: number
  loop: boolean
}

export async function decodeArrayBuffer(ab:ArrayBuffer) {
  return await engine.ctx.decodeAudioData(ab.slice(0))
}

export function playBuffer(
  buffer: AudioBuffer,
  when: number,
  opts: PlaybackOpts
) {
  const src = engine.ctx.createBufferSource()
  src.buffer = buffer
  const rawStart = Math.max(opts.startOffset, 0)
  const clampedStart = Math.min(rawStart, buffer.duration)
  const requestedEnd = opts.endOffset ?? buffer.duration
  const clampedEnd = Math.max(
    Math.min(requestedEnd, buffer.duration),
    clampedStart + 0.01
  )

  src.loop = !!opts.loop
  if (src.loop) {
    src.loopStart = clampedStart
    src.loopEnd = clampedEnd
  } else {
    src.loopStart = 0
    src.loopEnd = buffer.duration
  }

  const amp = engine.ctx.createGain()
  amp.gain.setValueAtTime(0, when)
  amp.gain.linearRampToValueAtTime(opts.gain, when + opts.attack)
  amp.gain.linearRampToValueAtTime(0.0001, when + opts.attack + opts.decay)

  src.connect(amp).connect(engine.master)
  src.start(when, clampedStart)

  const naturalStop = when + opts.attack + opts.decay + 0.05
  const trimmedStop = when + Math.max(clampedEnd - clampedStart, 0.01)
  const stopAt = opts.loop ? naturalStop : Math.min(naturalStop, trimmedStop)
  src.stop(stopAt)
}
