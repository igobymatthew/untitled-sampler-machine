import React from 'react'
import { useStore } from '../store'

export function Sequencer() {
  const pattern = useStore(s => s.pattern)
  const pads = useStore(s => s.pads)
  const currentStep = useStore(s => s.currentStep)
  const toggleStep = useStore(s => s.toggleStep)
  const steps = React.useMemo(() => Array.from({ length: pattern.length }, (_, i) => i), [pattern.length])

  return (
    <div className="space-y-2">
      {pads.map(pad => (
        <div
          key={pad.id}
          className="grid items-center gap-1"
          style={{ gridTemplateColumns: `6.5rem repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          <div
            className="flex h-8 items-center justify-end rounded-md border border-white/10 bg-white/5 px-3 text-sm font-medium backdrop-blur"
            style={{ color: pad.color }}
          >
            {pad.name}
          </div>
          {steps.map(stepIndex => {
            const activePads = pattern.steps[stepIndex] || []
            const on = activePads.includes(pad.id)
            const isNow = stepIndex === currentStep
            return (
              <button
                key={stepIndex}
                type="button"
                aria-pressed={on}
                className={`h-8 rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary ${
                  on ? 'bg-brand-primary shadow-neon-glow' : 'bg-gray-700'
                } ${isNow ? 'ring-2 ring-brand-secondary' : ''} ${
                  stepIndex % 4 === 0 ? 'border-l-2 border-gray-600' : ''
                }`}
                onClick={() => toggleStep(stepIndex, pad.id)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
