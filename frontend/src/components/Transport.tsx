import React, { useEffect } from 'react'
import { Play, SquareStop, Minus, Plus } from 'lucide-react'
import { useStore } from '../store'
import { Scheduler } from '../audio/Scheduler'
import { engine } from '../audio/Engine'
import { playBuffer } from '../audio/SamplePlayer'
import { getBuffer } from '../audio/BufferStore'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
        <div className="flex items-center gap-4 text-white">
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
