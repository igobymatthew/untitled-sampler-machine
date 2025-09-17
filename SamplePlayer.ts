import { engine } from './Engine'

export type PlaybackOpts = {
  gain: number
  attack: number
  decay: number
  startOffset: number
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
  src.loop = !!opts.loop
  src.loopStart = 0
  src.loopEnd = buffer.duration

  const amp = engine.ctx.createGain()
  amp.gain.setValueAtTime(0, when)
  amp.gain.linearRampToValueAtTime(opts.gain, when + opts.attack)
  amp.gain.linearRampToValueAtTime(0.0001, when + opts.attack + opts.decay)

  src.connect(amp).connect(engine.master)
  const offset = Math.min(Math.max(opts.startOffset, 0), buffer.duration - 0.001)
  src.start(when, offset)
  src.stop(when + opts.attack + opts.decay + 0.05)
}
