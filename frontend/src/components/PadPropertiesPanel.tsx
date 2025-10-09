import React from 'react'
import { useStore } from '../store'
import { getBuffer } from '../audio/BufferStore'
import { computePeaks } from '@/lib/audioAnalysis'
import type {
  EqualizerBand,
  Pad,
  ReverbPreset,
} from '@shared/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SampleRecorder } from './SampleRecorder'

const EQ_BANDS: { id: EqualizerBand; label: string }[] = [
  { id: '31', label: '31 Hz' },
  { id: '62', label: '62 Hz' },
  { id: '125', label: '125 Hz' },
  { id: '250', label: '250 Hz' },
  { id: '500', label: '500 Hz' },
  { id: '1k', label: '1 kHz' },
  { id: '2k', label: '2 kHz' },
  { id: '4k', label: '4 kHz' },
  { id: '8k', label: '8 kHz' },
  { id: '16k', label: '16 kHz' },
]

const REVERB_PRESETS: { value: ReverbPreset; label: string; description: string }[] = [
  { value: 'off', label: 'Off', description: 'Bypass ambience processing' },
  { value: 'room', label: 'Room', description: 'Tight early reflections' },
  { value: 'hall', label: 'Hall', description: 'Wide, lush sustain' },
  { value: 'plate', label: 'Plate', description: 'Classic studio sheen' },
  { value: 'spring', label: 'Spring', description: 'Vintage bounce' },
  { value: 'shimmer', label: 'Shimmer', description: 'Ethereal high octave' },
]

function formatSeconds(seconds: number) {
  if (Number.isNaN(seconds)) return '0.00s'
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`
  }
  return `${seconds.toFixed(2)}s`
}

type WaveformPreviewProps = {
  peaks: number[]
  trimStart: number
  trimEnd: number
  duration: number
}

function WaveformPreview({ peaks, trimStart, trimEnd, duration }: WaveformPreviewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const startPercent = duration > 0 ? (trimStart / duration) * 100 : 0
  const endPercent = duration > 0 ? (trimEnd / duration) * 100 : 100

  const drawWaveform = React.useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = Math.max(1, Math.floor(container.clientWidth))
    const height = Math.max(1, Math.floor(container.clientHeight))
    const dpr = window.devicePixelRatio ?? 1

    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    // draw subtle midline
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.fillRect(0, height / 2 - 0.5, width, 1)

    if (peaks.length > 0) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      gradient.addColorStop(0, 'rgba(160, 233, 255, 0.95)')
      gradient.addColorStop(1, 'rgba(0, 169, 255, 0.9)')
      ctx.fillStyle = gradient

      const totalBars = width
      const center = height / 2
      const maxHeight = height * 0.9

      for (let x = 0; x < totalBars; x += 1) {
        const peakIndex = Math.min(
          peaks.length - 1,
          Math.floor((x / totalBars) * peaks.length)
        )
        const value = peaks[peakIndex] ?? 0
        const barHeight = Math.max(1, value * maxHeight)
        const y = center - barHeight / 2
        ctx.fillRect(x, y, 1, barHeight)
      }
    }

    ctx.restore()
  }, [peaks])

  React.useEffect(() => {
    drawWaveform()
  }, [drawWaveform])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleResize = () => {
      drawWaveform()
    }

    if (typeof window === 'undefined') {
      return
    }

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => handleResize())
      observer.observe(container)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawWaveform])

  return (
    <div
      ref={containerRef}
      className="relative h-32 w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {peaks.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-white/40">
          Load a sample to visualize its waveform
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-y-0 left-0 bg-black/60"
        style={{ width: `${Math.max(0, Math.min(startPercent, 100))}%` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 bg-black/60"
        style={{ width: `${Math.max(0, 100 - Math.min(endPercent, 100))}%` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-brand-primary"
        style={{ left: `${Math.min(startPercent, 100)}%` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-brand-primary"
        style={{ left: `${Math.min(endPercent, 100)}%` }}
      />
    </div>
  )
}

export function PadPropertiesPanel() {
  const selectedPad = useStore(
    React.useCallback(
      state =>
        state.selectedPadId
          ? state.pads.find(pad => pad.id === state.selectedPadId)
          : undefined,
      []
    )
  )
  const setPad = useStore(state => state.setPad)

  const [peaks, setPeaks] = React.useState<number[]>([])

  const sampleDuration = React.useMemo(() => {
    if (!selectedPad) return 0
    if (selectedPad.sample?.duration && selectedPad.sample.duration > 0) {
      return selectedPad.sample.duration
    }
    if (selectedPad.trimEnd && selectedPad.trimEnd > 0) {
      return selectedPad.trimEnd
    }
    return 0
  }, [selectedPad])

  React.useEffect(() => {
    if (!selectedPad?.sample) {
      setPeaks([])
      return
    }
    const buffer = getBuffer(selectedPad.id)
    if (!buffer) {
      setPeaks([])
      return
    }
    setPeaks(computePeaks(buffer))
  }, [selectedPad?.id, selectedPad?.sample?.id])

  if (!selectedPad) {
    return (
      <Card className="border-white/10 bg-gradient-to-br from-white/5 via-white/10 to-white/0 text-white shadow-neon-glow backdrop-blur-xl">
        <CardHeader>
          <CardTitle>Pad Properties</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-white/70">
          Select a pad from the grid to reveal its controls.
        </CardContent>
      </Card>
    )
  }

  const trimEnd = selectedPad.trimEnd ?? sampleDuration
  const sliderMax = Math.max(trimEnd, sampleDuration)
  const trimSliderDisabled = sliderMax <= 0

  const updatePad = (patch: Partial<Pad>) => {
    setPad(selectedPad.id, patch)
  }

  return (
    <Card className="border-white/10 bg-gradient-to-br from-brand-primary/20 via-white/5 to-white/0 text-white shadow-neon-glow backdrop-blur-xl">
      <CardHeader className="flex flex-col gap-2">
        <CardTitle className="flex items-center justify-between text-lg font-semibold">
          <span className="flex items-center gap-3">
            <span
              className="h-3 w-10 rounded-full"
              style={{ backgroundColor: selectedPad.color }}
              aria-hidden
            />
            {selectedPad.name}
          </span>
          <span className="text-xs uppercase tracking-[0.4em] text-brand-light/70">
            Sampler Lab
          </span>
        </CardTitle>
        {selectedPad.sample ? (
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/70">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 font-medium text-white">
              {selectedPad.sample.name}
            </span>
            <span>Sample Rate: {selectedPad.sample.sampleRate || '—'} Hz</span>
            <span>Length: {formatSeconds(sampleDuration)}</span>
          </div>
        ) : (
          <div className="text-xs text-white/60">
            Load or record a sample to unlock trimming and spectral controls.
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <SampleRecorder layout="embedded" activePadId={selectedPad.id} />
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <WaveformPreview
              peaks={peaks}
              trimStart={selectedPad.trimStart}
              trimEnd={trimEnd}
              duration={sampleDuration || trimEnd}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-brand-light/70">
                <span>Trim</span>
                <span>
                  {formatSeconds(selectedPad.trimStart)} – {formatSeconds(trimEnd)}
                </span>
              </div>
              <Slider
                min={0}
                max={sliderMax > 0 ? sliderMax : 1}
                step={0.005}
                disabled={trimSliderDisabled}
                value={[
                  Math.min(selectedPad.trimStart, sliderMax > 0 ? sliderMax : 0),
                  Math.min(trimEnd, sliderMax > 0 ? sliderMax : trimEnd || 0),
                ]}
                onValueChange={([start, end]) => {
                  if (trimSliderDisabled) return
                  const maxDuration = sliderMax > 0 ? sliderMax : 0
                  const safeStart = Math.max(0, Math.min(start, Math.max(maxDuration - 0.01, 0)))
                  const safeEnd = Math.max(safeStart + 0.01, Math.min(end, Math.max(maxDuration, 0.01)))
                  updatePad({
                    trimStart: safeStart,
                    trimEnd: safeEnd,
                    startOffset: safeStart,
                  })
                }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <PadSlider
                label="Gain"
                value={selectedPad.gain}
                min={0}
                max={1.2}
                step={0.01}
                format={val => `${(val * 100).toFixed(0)}%`}
                onChange={value => updatePad({ gain: value })}
              />
              <PadSlider
                label="Attack"
                value={selectedPad.attack}
                min={0}
                max={1}
                step={0.005}
                format={formatSeconds}
                onChange={value => updatePad({ attack: value })}
              />
              <PadSlider
                label="Decay"
                value={selectedPad.decay}
                min={0.05}
                max={2.5}
                step={0.01}
                format={formatSeconds}
                onChange={value => updatePad({ decay: value })}
              />
              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-xs uppercase tracking-[0.3em] text-brand-light/70">
                <span>Playback</span>
                <div className="flex items-center gap-3 text-[11px] normal-case">
                  <Checkbox
                    id="loop-toggle"
                    checked={selectedPad.loop}
                    onCheckedChange={checked =>
                      updatePad({ loop: checked === true })
                    }
                  />
                  <Label htmlFor="loop-toggle" className="cursor-pointer text-white">
                    Loop Sample
                  </Label>
                </div>
                <div className="flex items-center gap-3 text-[11px] normal-case">
                  <Checkbox
                    id="mute-toggle"
                    checked={selectedPad.muted}
                    onCheckedChange={checked =>
                      updatePad({ muted: checked === true })
                    }
                  />
                  <Label htmlFor="mute-toggle" className="cursor-pointer text-white">
                    Mute Pad
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-brand-light/70">
                Reverb
              </div>
              <Select
                value={selectedPad.reverbPreset}
                onValueChange={value => updatePad({ reverbPreset: value as ReverbPreset })}
              >
                <SelectTrigger className="w-full bg-black/40 text-left text-white">
                  <SelectValue placeholder="Choose a preset" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-white">
                  {REVERB_PRESETS.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{preset.label}</span>
                        <span className="text-xs text-white/60">{preset.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <PadSlider
                label="Mix"
                value={selectedPad.reverbMix}
                min={0}
                max={1}
                step={0.01}
                format={val => `${Math.round(val * 100)}%`}
                onChange={value => updatePad({ reverbMix: value })}
              />
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-brand-light/70">
                <span>Noise Gate</span>
                <div className="flex items-center gap-2 text-[11px] normal-case">
                  <Checkbox
                    id="noise-gate-enable"
                    checked={selectedPad.noiseGate.enabled}
                    onCheckedChange={checked =>
                      updatePad({
                        noiseGate: {
                          ...selectedPad.noiseGate,
                          enabled: checked === true,
                        },
                      })
                    }
                  />
                  <Label htmlFor="noise-gate-enable" className="cursor-pointer text-white">
                    Enabled
                  </Label>
                </div>
              </div>
              <PadSlider
                label="Threshold"
                value={selectedPad.noiseGate.threshold}
                min={-80}
                max={0}
                step={1}
                format={val => `${val.toFixed(0)} dB`}
                onChange={value =>
                  updatePad({
                    noiseGate: { ...selectedPad.noiseGate, threshold: value },
                  })
                }
              />
              <PadSlider
                label="Attack"
                value={selectedPad.noiseGate.attack}
                min={1}
                max={100}
                step={1}
                format={val => `${Math.round(val)} ms`}
                onChange={value =>
                  updatePad({
                    noiseGate: { ...selectedPad.noiseGate, attack: value },
                  })
                }
              />
              <PadSlider
                label="Release"
                value={selectedPad.noiseGate.release}
                min={50}
                max={1000}
                step={10}
                format={val => `${Math.round(val)} ms`}
                onChange={value =>
                  updatePad({
                    noiseGate: { ...selectedPad.noiseGate, release: value },
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-4 text-xs uppercase tracking-[0.3em] text-brand-light/70">
            10-Band EQ
          </div>
          <div className="grid gap-6 md:grid-cols-5 lg:grid-cols-10">
            {EQ_BANDS.map(band => (
              <div key={band.id} className="flex flex-col items-center gap-3">
                <span className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                  {band.label}
                </span>
                <Slider
                  orientation="vertical"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={[selectedPad.eq[band.id]]}
                  className="h-32 w-8 flex-col"
                  onValueChange={([value]) =>
                    updatePad({
                      eq: { ...selectedPad.eq, [band.id]: value },
                    })
                  }
                />
                <span className="text-xs text-white/70">
                  {selectedPad.eq[band.id].toFixed(1)} dB
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

type PadSliderProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
}

function PadSlider({ label, value, min, max, step, format, onChange }: PadSliderProps) {
  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-brand-light/70">
        <span>{label}</span>
        <span className="font-semibold text-white">{format(value)}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([val]) => onChange(val)}
      />
    </div>
  )
}
