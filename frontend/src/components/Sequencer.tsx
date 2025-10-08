import React from 'react'
import { useStore } from '../store'

export function Sequencer() {
  const { pattern, pads, currentStep, toggleStep } = useStore()
  const steps = Array.from({ length: pattern.length }, (_, i) => i)

  return (
    <div className="space-y-2">
      {pads.map(p => (
        <div
          key={p.id}
          className="grid items-center gap-1"
          style={{ gridTemplateColumns: `6.5rem repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          <div
            className="flex h-8 items-center justify-end rounded-md border border-white/10 bg-white/5 px-3 text-sm font-medium backdrop-blur"
            style={{ color: p.color }}
          >
            {p.name}
          </div>
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
      ))}
    </div>
  )
}
