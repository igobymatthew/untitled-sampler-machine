import React, { useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { useStore } from '../store'
import { engine } from '../audio/Engine'
import { decodeArrayBuffer, playBuffer } from '../audio/SamplePlayer'
import { getBuffer, setBuffer } from '../audio/BufferStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Pad } from '@shared/types'
import { PadVisual } from './PadVisual'

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
      endOffset: p.trimEnd ?? undefined,
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
      trimStart: 0,
      trimEnd: buffer.duration,
      startOffset: 0,
    })
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {pads.map(pad => (
        <PadTile
          key={pad.id}
          pad={pad}
          isSelected={selected === pad.id}
          onSelect={setSelected}
          onTrigger={onTrigger}
          onLoad={onLoad}
        />
      ))}
    </div>
  )
}

type PadTileProps = {
  pad: Pad
  isSelected: boolean
  onSelect: (id: string) => void
  onTrigger: (id: string) => Promise<void>
  onLoad: (id: string, file: File) => Promise<void>
}

function PadTile({ pad, isSelected, onSelect, onTrigger, onLoad }: PadTileProps) {
  const [triggerSignal, setTriggerSignal] = useState(0)

  const handleTrigger = async () => {
    await onTrigger(pad.id)
    setTriggerSignal(signal => signal + 1)
  }

  return (
    <Card
      className={`relative overflow-hidden cursor-pointer bg-glass-black backdrop-blur-sm border-2 transition-all ${
        isSelected ? 'border-brand-primary shadow-neon-glow' : 'border-gray-700'
      } hover:border-brand-primary hover:shadow-neon-glow`}
      onClick={() => onSelect(pad.id)}
      onDoubleClick={handleTrigger}
    >
      <PadVisual
        color={pad.color}
        gain={pad.gain}
        decay={pad.decay}
        isSelected={isSelected}
        triggerSignal={triggerSignal}
        sampleDuration={pad.sample?.duration ?? undefined}
      />
      <CardHeader className="relative z-10">
        <CardTitle className="text-center text-white drop-shadow">{pad.name}</CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 text-center">
        <div className="text-xs text-gray-200/80 truncate uppercase tracking-wide">
          {pad.sample ? pad.sample.name : 'Drop/Load'}
        </div>
        <div className="mt-3">
          <label className="cursor-pointer inline-flex items-center justify-center rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-brand-secondary shadow-inner shadow-brand-secondary/20 transition hover:bg-black/60">
            <UploadCloud className="mr-2 h-4 w-4" />
            Load Sample
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={async e => {
                const input = e.target as HTMLInputElement
                const f = input.files?.[0]
                if (f) {
                  await onLoad(pad.id, f)
                  input.value = ''
                }
              }}
            />
          </label>
        </div>
      </CardContent>
    </Card>
  )
}
