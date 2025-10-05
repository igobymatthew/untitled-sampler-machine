import React from 'react'
import { useStore } from '../store'

export function Sequencer() {
  const { pattern, pads, currentStep, toggleStep, transport } = useStore()
  const steps = Array.from({length: pattern.length}, (_,i)=>i)

  return (
    <div>
      {pads.map(p=>(
        <div key={p.id} className="row">
          <div className="small" style={{color:p.color}}>{p.name}</div>
          <div className="seq">
            {steps.map(i=>{
              const on = (pattern.steps[i]||[]).includes(p.id)
              const isNow = i === currentStep
              return (
                <div key={i} className={'step' + (on? ' on':'')} style={{outline: isNow? '2px solid #7dd3fc44' : 'none'}}
                  onClick={()=> toggleStep(i, p.id)}
                >{(i%4)===0? '|':''}</div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
