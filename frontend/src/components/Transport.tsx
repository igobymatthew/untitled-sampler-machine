import React, { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { Scheduler } from '../audio/Scheduler'
import { engine } from '../audio/Engine'
import { playBuffer, decodeArrayBuffer } from '../audio/SamplePlayer'

const sched = new Scheduler((when, step)=>{
  // UI step cursor
  useStore.setState({ currentStep: step })
  // Trigger pads that have events on this step
  const { pattern, pads } = useStore.getState()
  const ids = pattern.steps[step] || []
  ids.forEach(id=>{
    const p = pads.find(pp=>pp.id===id)
    if (!p || !(window as any).__buffers?.[id]) return
    playBuffer((window as any).__buffers[id], when, {
      gain: p.gain, attack: p.attack, decay: p.decay, startOffset: p.startOffset, loop: p.loop
    })
  })
})

;(window as any).__buffers = (window as any).__buffers || {}

export function TransportBar() {
  const t = useStore(s=>s.transport)
  const setTransport = useStore(s=>s.setTransport)

  useEffect(()=>{ sched.set(t.bpm, t.stepsPerBar) }, [t.bpm, t.stepsPerBar])

  return (
    <div className="transport">
      <button onClick={async ()=>{
        await engine.resume()
        if (t.playing) { sched.stop(); setTransport({playing:false}) }
        else { sched.start(); setTransport({playing:true}) }
      }}>{t.playing? 'Stop' : 'Play'}</button>

      <label className="small">BPM</label>
      <input type="range" min={60} max={200} value={t.bpm} onChange={e=> setTransport({bpm: Number(e.target.value)}) }/>
      <span>{t.bpm}</span>

      <label className="small">Bars</label>
      <BarsControl />
    </div>
  )
}

function BarsControl(){
  const bars = useStore(s=>s.transport.bars)
  const setBars = useStore(s=>s.setBars)
  return (
    <div style={{display:'flex', gap:6, alignItems:'center'}}>
      <button onClick={()=> setBars(Math.max(1, bars-1))}>-</button>
      <span>{bars}</span>
      <button onClick={()=> setBars(Math.min(8, bars+1))}>+</button>
    </div>
  )
}
