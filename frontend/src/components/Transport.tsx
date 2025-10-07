import React, { useEffect, useRef, useCallback } from 'react'
import { Play, SquareStop, Minus, Plus, Upload, Download } from 'lucide-react'
import { useStore } from '../store'
import { Scheduler } from '../audio/Scheduler'
import { engine } from '../audio/Engine'
import { playBuffer } from '../audio/SamplePlayer'
import { getBuffer } from '../audio/BufferStore'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createMidiBlob, decodeMidiPattern } from '@/lib/midi'
import type { Transport as TransportState } from '@shared/types'

const sched = new Scheduler((when, stepInBar, absoluteStep) => {
  useStore.setState({ currentStep: stepInBar })
  const { pattern, pads } = useStore.getState()
  const ids = pattern.steps[absoluteStep] || []
  ids.forEach(id => {
    const p = pads.find(pp => pp.id === id)
    const buffer = getBuffer(id)
    if (!p || !buffer) return
    playBuffer(buffer, when, {
      gain: p.gain,
      attack: p.attack,
      decay: p.decay,
      startOffset: p.startOffset,
      loop: p.loop,
    })
  })
})

export function TransportBar() {
  const t = useStore(s => s.transport)
  const setTransport = useStore(s => s.setTransport)

  useEffect(() => {
    sched.set(t.bpm, t.stepsPerBar, t.bars)
  }, [t.bpm, t.stepsPerBar, t.bars])

  return (
    <Card className="bg-glass-black shadow-neon-glow">
      <CardHeader>
        <CardTitle className="text-white">Transport</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4 text-white">
          <Button
            variant="outline"
            className="w-24 bg-glass-white hover:bg-brand-primary hover:shadow-neon-glow"
            onClick={async () => {
              await engine.resume()
              if (t.playing) {
                sched.stop()
                setTransport({ playing: false })
              } else {
                sched.start()
                setTransport({ playing: true })
              }
            }}
          >
            {t.playing ? <SquareStop className="mr-2" /> : <Play className="mr-2" />}
            {t.playing ? 'Stop' : 'Play'}
          </Button>

          <div className="flex items-center gap-2">
            <label className="text-sm">BPM</label>
            <Slider
              min={60}
              max={200}
              value={[t.bpm]}
              onValueChange={([val]) => setTransport({ bpm: val })}
              className="w-32"
            />
            <span className="w-8 text-center">{t.bpm}</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm">Bars</label>
            <BarsControl />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <MidiControls />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BarsControl() {
  const bars = useStore(s => s.transport.bars)
  const setBars = useStore(s => s.setBars)
  return (
    <div className="flex items-center gap-2">
      <Button size="icon" variant="outline" onClick={() => setBars(Math.max(1, bars - 1))}>
        <Minus />
      </Button>
      <span className="w-6 text-center">{bars}</span>
      <Button size="icon" variant="outline" onClick={() => setBars(Math.min(8, bars + 1))}>
        <Plus />
      </Button>
    </div>
  )
}

function MidiControls() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pads = useStore(s => s.pads)
  const pattern = useStore(s => s.pattern)
  const transport = useStore(s => s.transport)
  const setBars = useStore(s => s.setBars)
  const setPattern = useStore(s => s.setPattern)
  const setTransport = useStore(s => s.setTransport)

  const handleExport = useCallback(() => {
    try {
      const blob = createMidiBlob({ pads, pattern, transport })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'untitled-pattern.mid'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Unable to export MIDI file', error)
    }
  }, [pads, pattern, transport])

  const handleFile = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer()
      const result = decodeMidiPattern(buffer, pads, transport.stepsPerBar)
      if (!result) {
        throw new Error('Unsupported MIDI file')
      }
      const updates: Partial<TransportState> = { playing: false }
      if (result.bpm) {
        updates.bpm = result.bpm
      }
      setTransport(updates)
      setBars(result.bars)
      setPattern(result.pattern)
    } catch (error) {
      console.error('Unable to import MIDI file', error)
    }
  }, [pads, transport, setTransport, setBars, setPattern])

  const onFileChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(event => {
    const file = event.target.files?.[0]
    if (file) {
      void handleFile(file)
    }
    event.target.value = ''
  }, [handleFile])

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi,audio/midi"
        className="hidden"
        onChange={onFileChange}
      />
      <Button variant="outline" size="icon" onClick={handleExport} title="Export MIDI">
        <Download className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        title="Import MIDI"
      >
        <Upload className="h-4 w-4" />
      </Button>
    </>
  )
}
