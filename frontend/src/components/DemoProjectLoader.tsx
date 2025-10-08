import { useEffect } from 'react'
import { useStore } from '../store'
import { hasBuffer, setBuffer } from '../audio/BufferStore'
import { ensureDemoBuffers } from '../lib/demoSamples'

export function DemoProjectLoader() {
  const pads = useStore(s => s.pads)
  const setPad = useStore(s => s.setPad)

  useEffect(() => {
    const buffers = ensureDemoBuffers()

    for (const pad of pads) {
      const sample = pad.sample
      const buffer = buffers[pad.id]
      if (!sample || !buffer || hasBuffer(pad.id)) continue
      setBuffer(pad.id, buffer)
      setPad(pad.id, {
        sample: {
          ...sample,
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
        },
        trimEnd: pad.trimEnd ?? buffer.duration,
      })
    }
  }, [pads, setPad])

  return null
}
