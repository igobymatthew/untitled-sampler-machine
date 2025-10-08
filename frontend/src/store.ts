import create from 'zustand'
import type { Pad, Transport, Pattern, Project, PadId } from '@shared/types'
import { demoProject } from './lib/demoProject'

function cloneProject(project: Project): Project {
  return {
    ...project,
    transport: { ...project.transport },
    pads: project.pads.map(pad => ({
      ...pad,
      sample: pad.sample ? { ...pad.sample } : undefined,
      noiseGate: { ...pad.noiseGate },
      eq: { ...pad.eq },
    })),
    pattern: {
      length: project.pattern.length,
      steps: Object.entries(project.pattern.steps).reduce<Record<number, PadId[]>>(
        (acc, [step, ids]) => {
          acc[Number(step)] = [...ids]
          return acc
        },
        {}
      ),
    },
  }
}

const defaultProject = cloneProject(demoProject)

const defaultPads = defaultProject.pads

const defaultTransport: Transport = defaultProject.transport

const defaultPattern: Pattern = defaultProject.pattern

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
  selectedPadId: defaultPads[0]?.id,
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
