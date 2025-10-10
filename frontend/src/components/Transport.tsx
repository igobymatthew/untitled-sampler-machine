import React, { useEffect, useRef, useCallback } from 'react'
import { Play, SquareStop, Minus, Plus, Upload, Download } from 'lucide-react'
import { useStore } from '../store'
import { Scheduler } from '../audio/Scheduler'
import { engine } from '../audio/Engine'
import { playBuffer } from '../audio/SamplePlayer'
import { getBuffer } from '../audio/BufferStore'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { createMidiBlob, decodeMidiPattern } from '@/lib/midi'
import type { Transport as TransportState } from '@shared/types'

const sched = new Scheduler((when, stepInBar, absoluteStep) => {
  useStore.setState(state => {
    const length = state.pattern.length || state.transport.stepsPerBar * state.transport.bars
    return { currentStep: length > 0 ? absoluteStep % length : 0 }
  })
  const { pattern, pads } = useStore.getState()
  const ids = pattern.steps[absoluteStep] || []
  ids.forEach(id => {
    const p = pads.find(pp => pp.id === id)
    const buffer = getBuffer(id)
    if (!p || !buffer || p.muted) return
    playBuffer(buffer, when, {
      gain: p.gain,
      attack: p.attack,
      decay: p.decay,
      startOffset: p.startOffset,
      endOffset: p.trimEnd ?? undefined,
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
    <nav className="sticky bottom-4 z-50 w-full px-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 rounded-2xl border border-white/20 bg-gradient-to-br from-white/20 via-white/10 to-white/5 px-6 py-4 text-white shadow-neon-glow backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-4 md:flex-1">
          <div className="flex items-center gap-4">
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-semibold uppercase tracking-[0.5em] text-brand-light/80">Transport</span>
              <span className="text-sm font-medium text-brand-light">Control Center</span>
            </div>
            <Button
              variant="outline"
              className="h-12 rounded-xl border-brand-primary/60 bg-brand-primary/20 px-6 font-semibold text-brand-light transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-primary/40 hover:text-white hover:shadow-neon-glow"
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
              {t.playing ? <SquareStop className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              <span>{t.playing ? 'Stop' : 'Play'}</span>
            </Button>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <label className="text-[10px] uppercase tracking-[0.4em] text-brand-light/80">BPM</label>
            <Slider
              min={60}
              max={200}
              value={[t.bpm]}
              onValueChange={([val]) => setTransport({ bpm: val })}
              className="w-40"
            />
            <span className="min-w-[3rem] rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-center text-sm font-semibold text-brand-light">
              {t.bpm}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <label className="text-[10px] uppercase tracking-[0.4em] text-brand-light/80">Bars</label>
            <BarsControl />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <MidiControls />
          </div>
        </div>
      </div>
    </nav>
  )
}

function BarsControl() {
  const bars = useStore(s => s.transport.bars)
  const setBars = useStore(s => s.setBars)
  return (
    <div className="flex items-center gap-2">
      <Button
        size="icon"
        variant="outline"
        className="h-11 w-11 rounded-xl border-white/30 bg-white/10 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-primary/40 hover:text-white hover:shadow-neon-glow"
        onClick={() => setBars(Math.max(1, bars - 1))}
      >
        <Minus />
      </Button>
      <span className="min-w-[2.5rem] rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-center text-sm font-semibold text-brand-light">
        {bars}
      </span>
      <Button
        size="icon"
        variant="outline"
        className="h-11 w-11 rounded-xl border-white/30 bg-white/10 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-primary/40 hover:text-white hover:shadow-neon-glow"
        onClick={() => setBars(Math.min(8, bars + 1))}
      >
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
      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11 rounded-xl border-white/30 bg-white/10 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-primary/40 hover:text-white hover:shadow-neon-glow"
        onClick={handleExport}
        title="Export MIDI"
      >
        <Download className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11 rounded-xl border-white/30 bg-white/10 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-primary/40 hover:text-white hover:shadow-neon-glow"
        onClick={() => fileInputRef.current?.click()}
        title="Import MIDI"
      >
        <Upload className="h-4 w-4" />
      </Button>
    </>
  )
}
