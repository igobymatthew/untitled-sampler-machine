import React from 'react'
import { UploadCloud } from 'lucide-react'
import { useStore } from '../store'
import { engine } from '../audio/Engine'
import { decodeArrayBuffer, playBuffer } from '../audio/SamplePlayer'
import { getBuffer, setBuffer } from '../audio/BufferStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function PadGrid() {
  const pads = useStore(s => s.pads)
  const setPad = useStore(s => s.setPad)
  const selected = useStore(s => s.selectedPadId)
  const setSelected = useStore(s => s.setSelectedPad)

  const onTrigger = async (id: string) => {
    await engine.resume()
    const p = pads.find(p => p.id === id)!
    const buf = getBuffer(id)
    if (!buf) return
    playBuffer(buf, engine.ctx.currentTime, {
      gain: p.gain,
      attack: p.attack,
      decay: p.decay,
      startOffset: p.startOffset,
      loop: p.loop,
    })
  }

  const onLoad = async (id: string, file: File) => {
    const ab = await file.arrayBuffer()
    const buffer = await decodeArrayBuffer(ab)
    setBuffer(id, buffer)
    setPad(id, {
      sample: {
        id,
        name: file.name,
        duration: buffer.duration,
        sampleRate: buffer.sampleRate,
        url: URL.createObjectURL(file),
      },
    })
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {pads.map(p => {
        const isSel = selected === p.id
        return (
          <Card
            key={p.id}
            className={`cursor-pointer bg-glass-black backdrop-blur-sm border-2 transition-all ${
              isSel ? 'border-brand-primary shadow-neon-glow' : 'border-gray-700'
            } hover:border-brand-primary hover:shadow-neon-glow`}
            onClick={() => setSelected(p.id)}
            onDoubleClick={() => onTrigger(p.id)}
          >
            <CardHeader>
              <CardTitle className="text-center text-white">{p.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-xs text-gray-400 truncate">
                {p.sample ? p.sample.name : 'Drop/Load'}
              </div>
              <div className="mt-2">
                <label className="cursor-pointer">
                  <UploadCloud className="mx-auto text-brand-secondary" />
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) onLoad(p.id, f)
                    }}
                  />
                </label>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
