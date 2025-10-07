import create from 'zustand'
import type { Pad, Transport, Pattern, Project, PadId } from '@shared/types'

function makePad(i:number): Pad {
  const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#a855f7','#ec4899','#22d3ee','#84cc16']
  return {
    id: 'pad-' + i,
    name: 'Pad ' + (i+1),
    color: colors[i % colors.length],
    gain: 0.85,
    attack: 0.002,
    decay: 0.2,
    startOffset: 0,
    loop: false,
    muted: false
  }
}

const defaultPads = Array.from({length:8}, (_,i)=>makePad(i))

const defaultTransport: Transport = {
  playing: false,
  bpm: 120,
  stepsPerBar: 16,
  bars: 1,
  swing: 0
}

const defaultPattern: Pattern = {
  steps: {},
  length: defaultTransport.stepsPerBar * defaultTransport.bars
}

type State = {
  pads: Pad[]
  transport: Transport
  pattern: Pattern
  currentStep: number
  selectedPadId?: PadId
  setTransport: (t: Partial<Transport>) => void
  toggleStep: (index:number, padId:PadId)=>void
  setBars: (bars:number)=>void
  setSelectedPad: (id?:PadId)=>void
  setPad: (id:PadId, patch: Partial<Pad>)=>void
  setPattern: (pattern: Pattern) => void
}

export const useStore = create<State>((set,get)=>({
  pads: defaultPads,
  transport: defaultTransport,
  pattern: defaultPattern,
  currentStep: 0,
  selectedPadId: undefined,
  setTransport: (t)=> set(s=>({ transport: {...s.transport, ...t} })),
  toggleStep: (index, padId)=> set(s=>{
    const steps = {...s.pattern.steps}
    const list = new Set(steps[index] || [])
    if (list.has(padId)) list.delete(padId); else list.add(padId)
    steps[index] = Array.from(list)
    return { pattern: {...s.pattern, steps} }
  }),
  setBars: (bars)=> set(s=>{
    const length = s.transport.stepsPerBar * bars
    return { transport: {...s.transport, bars}, pattern: {...s.pattern, length} }
  }),
  setSelectedPad: (id)=> set({selectedPadId: id}),
  setPad: (id, patch)=> set(s=>({ pads: s.pads.map(p=> p.id===id ? {...p, ...patch} : p) })),
  setPattern: pattern => set({ pattern })
}))
