import React from 'react'
import { useStore } from '../store'

export function Sequencer() {
  const { pattern, pads, currentStep, toggleStep } = useStore()
  const steps = Array.from({ length: pattern.length }, (_, i) => i)

  return (
    <div className="space-y-2">
      {pads.map(p => (
        <div key={p.id} className="flex items-center gap-4">
          <div className="w-20 text-right text-sm" style={{ color: p.color }}>
            {p.name}
          </div>
          <div className="flex-1 grid grid-cols-16 gap-1">
            {steps.map(i => {
              const on = (pattern.steps[i] || []).includes(p.id)
              const isNow = i === currentStep
              return (
                <div
                  key={i}
                  className={`h-8 rounded-md cursor-pointer transition-all duration-150 ${
                    on ? 'bg-brand-primary shadow-neon-glow' : 'bg-gray-700'
                  } ${isNow ? 'ring-2 ring-brand-secondary' : ''} ${
                    i % 4 === 0 ? 'border-l-2 border-gray-600' : ''
                  }`}
                  onClick={() => toggleStep(i, p.id)}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
