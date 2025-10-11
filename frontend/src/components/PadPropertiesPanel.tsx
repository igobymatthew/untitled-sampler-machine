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
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SampleRecorder } from './SampleRecorder'
import { useWebglSupport } from '@/hooks/useWebglSupport'

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
  disabled?: boolean
  onTrimChange?: (start: number, end: number) => void
}

function WaveformPreview({
  peaks,
  trimStart,
  trimEnd,
  duration,
  disabled,
  onTrimChange,
}: WaveformPreviewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const startPercent = duration > 0 ? (trimStart / duration) * 100 : 0
  const endPercent = duration > 0 ? (trimEnd / duration) * 100 : 100
  const pointerIdRef = React.useRef<number | null>(null)
  const [draggingHandle, setDraggingHandle] = React.useState<'start' | 'end' | null>(
    null
  )
  const interactive = Boolean(onTrimChange && !disabled && duration > 0)

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

  const updateTrimFromPointer = React.useCallback(
    (clientX: number, handle: 'start' | 'end') => {
      if (!onTrimChange || duration <= 0) return
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0) return

      const ratio = (clientX - rect.left) / rect.width
      const clamped = Math.min(1, Math.max(0, ratio))
      const position = clamped * duration
      if (Number.isNaN(position)) return

      if (handle === 'start') {
        onTrimChange(position, trimEnd)
      } else {
        onTrimChange(trimStart, position)
      }
    },
    [duration, onTrimChange, trimEnd, trimStart]
  )

  const beginDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, handle: 'start' | 'end') => {
      if (!interactive) return
      event.preventDefault()
      event.stopPropagation()
      pointerIdRef.current = event.pointerId
      setDraggingHandle(handle)
      updateTrimFromPointer(event.clientX, handle)
    },
    [interactive, updateTrimFromPointer]
  )

  React.useEffect(() => {
    if (!draggingHandle) return

    const handlePointerMove = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) {
        return
      }
      event.preventDefault()
      updateTrimFromPointer(event.clientX, draggingHandle)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) {
        return
      }
      pointerIdRef.current = null
      setDraggingHandle(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [draggingHandle, updateTrimFromPointer])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, handle: 'start' | 'end') => {
      if (!interactive || duration <= 0 || !onTrimChange) return

      const baseStep = Math.max(duration / 200, 0.005)
      const step = event.shiftKey ? baseStep * 10 : baseStep
      let delta = 0

      if (event.key === 'ArrowLeft') {
        delta = -step
      } else if (event.key === 'ArrowRight') {
        delta = step
      } else {
        return
      }

      event.preventDefault()

      if (handle === 'start') {
        onTrimChange(trimStart + delta, trimEnd)
      } else {
        onTrimChange(trimStart, trimEnd + delta)
      }
    },
    [duration, interactive, onTrimChange, trimEnd, trimStart]
  )

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5"
      style={{ height: '8rem', minHeight: '8rem' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full rounded-[inherit]"
      />
      {peaks.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-white/40">
          Load a sample to visualize its waveform
        </div>
      )}

      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-y-0 left-0 bg-black/60"
          style={{ width: `${Math.max(0, Math.min(startPercent, 100))}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-black/60"
          style={{ width: `${Math.max(0, 100 - Math.min(endPercent, 100))}%` }}
        />
        <div
          className="absolute inset-y-0 bg-brand-primary/20"
          style={{
            left: `${Math.min(startPercent, 100)}%`,
            right: `${Math.max(0, 100 - Math.min(endPercent, 100))}%`,
          }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-brand-primary"
          style={{ left: `${Math.min(startPercent, 100)}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-brand-primary"
          style={{ left: `${Math.min(endPercent, 100)}%` }}
        />
      </div>

      {interactive && (
        <>
          <button
            type="button"
            className="group absolute -top-4 flex -translate-x-1/2 flex-col items-center gap-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            style={{ left: `${Math.min(startPercent, 100)}%` }}
            aria-label="Adjust trim start"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={trimStart}
            aria-valuetext={formatSeconds(trimStart)}
            onPointerDown={event => beginDrag(event, 'start')}
            onKeyDown={event => handleKeyDown(event, 'start')}
          >
            <span className="rounded-sm bg-brand-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-950 opacity-80 transition-opacity group-hover:opacity-100">
              IN
            </span>
            <span className="h-4 w-3 rounded-sm border border-brand-primary bg-slate-950/80 shadow-[0_0_6px_rgba(0,213,255,0.6)]" />
          </button>
          <button
            type="button"
            className="group absolute -top-4 flex -translate-x-1/2 flex-col items-center gap-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            style={{ left: `${Math.min(endPercent, 100)}%` }}
            aria-label="Adjust trim end"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={trimEnd}
            aria-valuetext={formatSeconds(trimEnd)}
            onPointerDown={event => beginDrag(event, 'end')}
            onKeyDown={event => handleKeyDown(event, 'end')}
          >
            <span className="rounded-sm bg-brand-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-950 opacity-80 transition-opacity group-hover:opacity-100">
              OUT
            </span>
            <span className="h-4 w-3 rounded-sm border border-brand-primary bg-slate-950/80 shadow-[0_0_6px_rgba(0,213,255,0.6)]" />
          </button>
        </>
      )}
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
  const supportsWebgl = useWebglSupport(true)

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
  const minTrimGap = React.useMemo(() => {
    if (sliderMax <= 0) return 0
    return Math.min(sliderMax, 0.01)
  }, [sliderMax])

  const updatePad = (patch: Partial<Pad>) => {
    setPad(selectedPad.id, patch)
  }

  const handleTrimChange = React.useCallback(
    (start: number, end: number) => {
      if (sliderMax <= 0 || minTrimGap <= 0) return
      const maxDuration = sliderMax
      const safeStart = Math.max(0, Math.min(start, Math.max(maxDuration - minTrimGap, 0)))
      const safeEnd = Math.max(
        safeStart + minTrimGap,
        Math.min(end, Math.max(maxDuration, minTrimGap))
      )

      updatePad({
        trimStart: safeStart,
        trimEnd: safeEnd,
        startOffset: safeStart,
      })
    },
    [minTrimGap, sliderMax, updatePad]
  )

  return (
    <Card className="relative overflow-hidden border-white/10 bg-slate-950/60 text-white shadow-neon-glow backdrop-blur-2xl">
      <WaveformBackground
        peaks={peaks}
        color={selectedPad.color}
        trimStart={selectedPad.trimStart}
        trimEnd={trimEnd}
        duration={sliderMax}
        attack={selectedPad.attack}
        decay={selectedPad.decay}
        supportsWebgl={supportsWebgl}
      />
      <CardHeader className="relative z-10 flex flex-col gap-2">
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
      <CardContent className="relative z-10 space-y-6">
        <SampleRecorder layout="embedded" activePadId={selectedPad.id} />
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <WaveformPreview
              peaks={peaks}
              trimStart={selectedPad.trimStart}
              trimEnd={trimEnd}
              duration={sliderMax}
              disabled={trimSliderDisabled}
              onTrimChange={handleTrimChange}
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
                  sliderMax > 0 ? Math.min(selectedPad.trimStart, sliderMax) : 0,
                  sliderMax > 0 ? Math.min(trimEnd, sliderMax) : 0,
                ]}
                onValueChange={([start, end]) => {
                  if (typeof start !== 'number' || typeof end !== 'number') return
                  handleTrimChange(start, end)
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
                <HudToggleRow
                  id="loop-toggle"
                  label="Loop Sample"
                  checked={selectedPad.loop}
                  color={selectedPad.color}
                  onChange={checked => updatePad({ loop: checked })}
                  supportsWebgl={supportsWebgl}
                />
                <HudToggleRow
                  id="mute-toggle"
                  label="Mute Pad"
                  checked={selectedPad.muted}
                  color={selectedPad.color}
                  onChange={checked => updatePad({ muted: checked })}
                  supportsWebgl={supportsWebgl}
                />
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

type WaveformBackgroundProps = {
  peaks: number[]
  color: string
  trimStart: number
  trimEnd: number
  duration: number
  attack: number
  decay: number
  supportsWebgl: boolean
}

function WaveformBackground({
  peaks,
  color,
  trimStart,
  trimEnd,
  duration,
  attack,
  decay,
  supportsWebgl,
}: WaveformBackgroundProps) {
  const accentColor = React.useMemo(() => new THREE.Color(color || '#38bdf8'), [color])
  const accentRgb = React.useMemo(
    () => `${Math.round(accentColor.r * 255)}, ${Math.round(accentColor.g * 255)}, ${Math.round(accentColor.b * 255)}`,
    [accentColor],
  )
  const [startPercent, endPercent] = React.useMemo(() => {
    if (duration <= 0) {
      return [0, 100]
    }
    const safeStart = THREE.MathUtils.clamp(trimStart, 0, duration)
    const safeEnd = THREE.MathUtils.clamp(trimEnd, 0, duration)
    return [
      (safeStart / duration) * 100,
      (Math.max(safeStart, safeEnd) / duration) * 100,
    ]
  }, [duration, trimEnd, trimStart])
  const highlightStyle = React.useMemo((): React.CSSProperties => {
    const start = Number.isFinite(startPercent) ? startPercent : 0
    const end = Number.isFinite(endPercent) ? endPercent : 100
    const paddedStart = Math.max(0, Math.min(100, start - 0.6))
    const paddedEnd = Math.max(0, Math.min(100, end + 0.6))
    return {
      backgroundImage: `linear-gradient(90deg, transparent ${paddedStart.toFixed(2)}%, rgba(${accentRgb}, 0.22) ${start.toFixed(
        2,
      )}%, rgba(${accentRgb}, 0.4) ${end.toFixed(2)}%, transparent ${paddedEnd.toFixed(2)}%)`,
      mixBlendMode: 'screen',
    }
  }, [accentRgb, endPercent, startPercent])
  const shimmerStyle = React.useMemo((): React.CSSProperties => ({
    backgroundImage: `linear-gradient(120deg, rgba(${accentRgb}, 0.16), transparent 65%)`,
    opacity: 0.35,
  }), [accentRgb])
  const gridStyle = React.useMemo((): React.CSSProperties => ({
    backgroundImage:
      'repeating-linear-gradient(0deg, rgba(148, 163, 255, 0.08), rgba(148, 163, 255, 0.08) 1px, transparent 1px, transparent 4px)',
  }), [])
  const envelopeStyle = React.useMemo((): React.CSSProperties => {
    const attackWidth = Math.min(35, attack * 80)
    const decayWidth = Math.min(30, decay * 60)
    return {
      backgroundImage: `linear-gradient(90deg, rgba(${accentRgb}, 0.12) 0%, transparent ${Math.max(
        6,
        attackWidth,
      ).toFixed(2)}%, transparent ${Math.max(0, 100 - decayWidth).toFixed(2)}%, rgba(${accentRgb}, 0.12) 100%)`,
      opacity: 0.55,
    }
  }, [accentRgb, attack, decay])

  if (!supportsWebgl) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#050714] via-[#0b1025] to-[#01020a]" />
        <div className="absolute inset-0 opacity-50" style={gridStyle} />
        <div className="absolute inset-0" style={highlightStyle} />
        <div className="absolute inset-0 animate-[waveGlow_14s_linear_infinite]" style={shimmerStyle} />
        <div className="absolute inset-0" style={envelopeStyle} />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <style>
          {`
            @keyframes waveGlow {
              0% { transform: translateX(-20%); opacity: 0.25; }
              45% { opacity: 0.5; }
              100% { transform: translateX(20%); opacity: 0.25; }
            }
          `}
        </style>
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <Canvas
        className="absolute inset-0"
        style={{ borderRadius: 'inherit' }}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 1.6, 3.6], fov: 42 }}
        dpr={[1, 1.5]}
        frameloop="always"
      >
        <React.Suspense fallback={null}>
          <color attach="background" args={["#050714"]} />
          <fog attach="fog" args={["#050714", 6, 14]} />
          <WaveformScene
            peaks={peaks}
            color={color}
            trimStart={trimStart}
            trimEnd={trimEnd}
            duration={duration}
            attack={attack}
            decay={decay}
          />
        </React.Suspense>
      </Canvas>
    </div>
  )
}

type WaveformSceneProps = {
  peaks: number[]
  color: string
  trimStart: number
  trimEnd: number
  duration: number
  attack: number
  decay: number
}

function WaveformScene({ peaks, color, trimStart, trimEnd, duration, attack, decay }: WaveformSceneProps) {
  const { size } = useThree()
  const { horizontalScale, depthScale } = React.useMemo(() => {
    const width = Math.max(size.width, 1)
    const height = Math.max(size.height, 1)
    const aspect = width / height
    if (aspect >= 1) {
      const clamped = THREE.MathUtils.clamp(aspect, 1, 3.5)
      return { horizontalScale: clamped, depthScale: 1 }
    }
    const inverse = height / width
    const clamped = THREE.MathUtils.clamp(inverse, 1, 3.5)
    return { horizontalScale: 1, depthScale: clamped }
  }, [size.height, size.width])

  return (
    <>
      <WaveformLights color={color} />
      <WaveformMesh
        peaks={peaks}
        color={color}
        trimStart={trimStart}
        trimEnd={trimEnd}
        duration={duration}
        attack={attack}
        decay={decay}
        horizontalScale={horizontalScale}
        depthScale={depthScale}
      />
      <WaveformAura color={color} horizontalScale={horizontalScale} depthScale={depthScale} />
    </>
  )
}

function WaveformLights({ color }: { color: string }) {
  const lightColor = React.useMemo(() => new THREE.Color(color || "#38bdf8"), [color])
  const rimColor = React.useMemo(() => lightColor.clone().multiplyScalar(1.35), [lightColor])

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[2.5, 3.8, 4.6]} intensity={0.8} color={lightColor} />
      <pointLight position={[-3.2, -1.5, 2]} intensity={0.65} color={lightColor.clone().multiplyScalar(0.7)} />
      <spotLight
        position={[0, 5.5, 5.5]}
        angle={0.7}
        penumbra={0.5}
        intensity={0.95}
        color={rimColor}
      />
    </>
  )
}

type WaveformMeshProps = {
  peaks: number[]
  color: string
  trimStart: number
  trimEnd: number
  duration: number
  attack: number
  decay: number
  horizontalScale: number
  depthScale: number
}

function WaveformMesh({
  peaks,
  color,
  trimStart,
  trimEnd,
  duration,
  attack,
  decay,
  horizontalScale,
  depthScale,
}: WaveformMeshProps) {
  const meshRef = React.useRef<THREE.Mesh>(null)
  const materialRef = React.useRef<THREE.MeshStandardMaterial>(null)

  const geometry = React.useMemo(() => generateWaveformGeometry(peaks), [peaks])

  React.useEffect(() => () => geometry.dispose(), [geometry])

  const targetRange = React.useMemo(() => {
    if (duration <= 0) {
      return { scale: 1.1, offset: 0, depth: 1, normalized: 0.8 }
    }
    const safeStart = THREE.MathUtils.clamp(trimStart, 0, duration)
    const safeEnd = THREE.MathUtils.clamp(trimEnd, 0, duration)
    const length = Math.max(0, safeEnd - safeStart)
    const normalizedLength = duration > 0 ? length / duration : 1
    const center = duration > 0 ? (safeStart + length / 2) / duration : 0.5
    const offset = (center - 0.5) * 1.6
    const scale = 0.6 + normalizedLength * 1.25
    const depth = 0.8 + normalizedLength * 0.9
    return { scale, offset, depth, normalized: normalizedLength }
  }, [trimStart, trimEnd, duration])

  const envelopeTarget = React.useMemo(() => {
    const attackNorm = THREE.MathUtils.clamp(attack, 0, 1)
    const decayNorm = THREE.MathUtils.clamp(decay, 0, 2.5) / 2.5
    return 0.85 + decayNorm * 0.7 - attackNorm * 0.35
  }, [attack, decay])

  const emissiveColor = React.useMemo(() => new THREE.Color(color || "#38bdf8"), [color])

  React.useEffect(() => {
    if (!materialRef.current) return
    materialRef.current.color.copy(emissiveColor.clone().multiplyScalar(0.65))
    materialRef.current.emissive.copy(emissiveColor)
  }, [emissiveColor])

  const animated = React.useRef({
    scale: targetRange.scale,
    offset: targetRange.offset,
    depth: targetRange.depth,
    envelope: envelopeTarget,
  })

  React.useEffect(() => {
    animated.current = {
      scale: targetRange.scale,
      offset: targetRange.offset,
      depth: targetRange.depth,
      envelope: envelopeTarget,
    }
  }, [targetRange.scale, targetRange.offset, targetRange.depth, envelopeTarget])

  useFrame((state, delta) => {
    if (!meshRef.current || !materialRef.current) return
    const lerpFactor = Math.min(1, delta * 4.5)
    animated.current.scale = THREE.MathUtils.lerp(
      animated.current.scale,
      targetRange.scale,
      lerpFactor
    )
    animated.current.offset = THREE.MathUtils.lerp(
      animated.current.offset,
      targetRange.offset,
      lerpFactor
    )
    animated.current.depth = THREE.MathUtils.lerp(
      animated.current.depth,
      targetRange.depth,
      lerpFactor
    )
    animated.current.envelope = THREE.MathUtils.lerp(
      animated.current.envelope,
      envelopeTarget,
      Math.min(1, delta * 3.5)
    )

    meshRef.current.scale.set(
      animated.current.scale * horizontalScale,
      animated.current.envelope,
      animated.current.depth * depthScale,
    )
    meshRef.current.position.x = animated.current.offset * horizontalScale
    meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.35) * 0.05

    const emissivePulse = 0.45 + Math.sin(state.clock.elapsedTime * 2.1) * 0.05
    materialRef.current.emissiveIntensity = emissivePulse + targetRange.normalized * 0.6
    materialRef.current.opacity = 0.7 + targetRange.normalized * 0.2
  })

  return (
    <group position={[0, -0.6, 0]}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        rotation={[-Math.PI / 3.2, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          ref={materialRef}
          roughness={0.4}
          metalness={0.25}
          transparent
          opacity={0.85}
          emissiveIntensity={0.6}
        />
      </mesh>
      <WaveformHalo
        color={color}
        intensity={targetRange.normalized}
        horizontalScale={horizontalScale}
      />
    </group>
  )
}

function WaveformAura({
  color,
  horizontalScale,
  depthScale,
}: {
  color: string
  horizontalScale: number
  depthScale: number
}) {
  const auraColor = React.useMemo(() => new THREE.Color(color || "#38bdf8"), [color])
  return (
    <mesh
      position={[0, -1.6, -1]}
      rotation={[Math.PI / 2, 0, 0]}
      scale={[horizontalScale, depthScale, 1]}
    >
      <planeGeometry args={[12, 12, 1, 1]} />
      <meshBasicMaterial
        color={auraColor.clone().multiplyScalar(0.2)}
        opacity={0.35}
        transparent
      />
    </mesh>
  )
}

function WaveformHalo({
  color,
  intensity,
  horizontalScale,
}: {
  color: string
  intensity: number
  horizontalScale: number
}) {
  const haloMaterial = React.useRef<THREE.MeshBasicMaterial>(null)
  const haloColor = React.useMemo(() => new THREE.Color(color || "#38bdf8"), [color])

  useFrame((state, delta) => {
    if (!haloMaterial.current) return
    const pulse = Math.sin(state.clock.elapsedTime * 1.8) * 0.2 + 0.8
    const targetOpacity = THREE.MathUtils.clamp(intensity * 0.6 + 0.2, 0.1, 0.85)
    haloMaterial.current.opacity = THREE.MathUtils.lerp(
      haloMaterial.current.opacity,
      targetOpacity * pulse,
      Math.min(1, delta * 2.5)
    )
  })

  return (
    <mesh position={[0, -0.05, 0]} scale={[horizontalScale, 1, 1]}>
      <ringGeometry args={[1.6, 2.3, 64]} />
      <meshBasicMaterial
        ref={haloMaterial}
        color={haloColor}
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

type HudToggleRowProps = {
  id: string
  label: string
  checked: boolean
  color: string
  onChange: (checked: boolean) => void
  supportsWebgl: boolean
}

function HudToggleRow({ id, label, checked, color, onChange, supportsWebgl }: HudToggleRowProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
      <div className="pointer-events-none absolute inset-0">
        <HudStateIndicator active={checked} color={color} supportsWebgl={supportsWebgl} />
      </div>
      <div className="relative z-10 flex items-center gap-3 text-[11px] normal-case text-white">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={value => onChange(value === true)}
          className="data-[state=checked]:border-brand-primary data-[state=checked]:bg-brand-primary/60"
        />
        <Label htmlFor={id} className="cursor-pointer text-white">
          {label}
        </Label>
        <span className="ml-auto text-[10px] uppercase tracking-[0.45em] text-brand-light/70">
          {checked ? 'ACTIVE' : 'STANDBY'}
        </span>
      </div>
    </div>
  )
}

function HudStateIndicator({
  active,
  color,
  supportsWebgl,
}: {
  active: boolean
  color: string
  supportsWebgl: boolean
}) {
  const accent = React.useMemo(() => new THREE.Color(color || '#38bdf8'), [color])
  const accentRgb = React.useMemo(
    () => `${Math.round(accent.r * 255)}, ${Math.round(accent.g * 255)}, ${Math.round(accent.b * 255)}`,
    [accent],
  )

  if (!supportsWebgl) {
    const pulseClass = active ? 'animate-[hudPulse_2.4s_ease-in-out_infinite]' : ''
    return (
      <div className="absolute inset-0" aria-hidden>
        <div
          className={`absolute inset-0 rounded-lg bg-slate-950/60 ${pulseClass}`}
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, rgba(${accentRgb}, ${active ? 0.32 : 0.18}), transparent 65%), linear-gradient(135deg, rgba(${accentRgb}, ${active ? 0.28 : 0.12}), rgba(8, 11, 24, 0.9))`,
            boxShadow: active ? `0 0 18px rgba(${accentRgb}, 0.35)` : 'none',
            border: `1px solid rgba(${accentRgb}, 0.28)`,
          }}
        />
        <div
          className="absolute inset-0 mix-blend-screen opacity-60"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(148, 163, 255, 0.12), rgba(148, 163, 255, 0.12) 1px, transparent 1px, transparent 4px)',
          }}
        />
        <style>
          {`
            @keyframes hudPulse {
              0%, 100% { opacity: 0.45; }
              50% { opacity: 0.85; }
            }
          `}
        </style>
      </div>
    )
  }

  return (
    <Canvas
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 1.6], fov: 35 }}
      frameloop="always"
      dpr={[1, 1.5]}
    >
      <HudShaderPlane active={active} color={color} />
    </Canvas>
  )
}

type HudShaderPlaneProps = {
  active: boolean
  color: string
}

function HudShaderPlane({ active, color }: HudShaderPlaneProps) {
  const materialRef = React.useRef<THREE.ShaderMaterial>(null)
  const progress = React.useRef(active ? 1 : 0)
  const target = React.useRef(active ? 1 : 0)

  React.useEffect(() => {
    target.current = active ? 1 : 0
  }, [active])

  const onColor = React.useMemo(() => new THREE.Color(color || '#38bdf8'), [color])
  const offColor = React.useMemo(() => onColor.clone().lerp(new THREE.Color('#0f172a'), 0.8), [onColor])

  useFrame((_, delta) => {
    if (!materialRef.current) return
    progress.current = THREE.MathUtils.lerp(
      progress.current,
      target.current,
      Math.min(1, delta * 5)
    )
    const uniforms = materialRef.current.uniforms as HudUniforms
    uniforms.uProgress.value = progress.current
    uniforms.uTime.value += delta
  })

  React.useEffect(() => {
    if (!materialRef.current) return
    const uniforms = materialRef.current.uniforms as HudUniforms
    uniforms.uOnColor.value.copy(onColor)
    uniforms.uOffColor.value.copy(offColor)
  }, [onColor, offColor])

  return (
    <mesh>
      <planeGeometry args={[2.6, 1.4, 64, 32]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        uniforms={{
          uProgress: { value: progress.current },
          uOnColor: { value: onColor.clone() },
          uOffColor: { value: offColor.clone() },
          uTime: { value: 0 },
        }}
        vertexShader={HUD_VERTEX_SHADER}
        fragmentShader={HUD_FRAGMENT_SHADER}
      />
    </mesh>
  )
}

type HudUniforms = {
  uProgress: { value: number }
  uOnColor: { value: THREE.Color }
  uOffColor: { value: THREE.Color }
  uTime: { value: number }
}

const HUD_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const HUD_FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform float uProgress;
  uniform float uTime;
  uniform vec3 uOnColor;
  uniform vec3 uOffColor;

  float vignette(vec2 uv) {
    float dist = distance(uv, vec2(0.5));
    return smoothstep(0.9, 0.2, dist);
  }

  void main() {
    float progress = smoothstep(0.0, 1.0, uProgress);
    vec3 baseColor = mix(uOffColor, uOnColor, progress);
    float scan = sin((vUv.y + uTime * 0.6) * 16.0) * 0.5 + 0.5;
    float gridX = sin((vUv.x + uTime * 0.3) * 24.0) * 0.5 + 0.5;
    float gridY = sin((vUv.y + uTime * 0.25) * 24.0) * 0.5 + 0.5;
    float grid = smoothstep(0.4, 1.0, gridX * gridY);
    float glow = sin(uTime * 4.0 + vUv.y * 8.0) * 0.5 + 0.5;
    vec3 hud = baseColor + (grid * 0.35 + glow * 0.2 + scan * 0.15) * (baseColor * 0.6 + vec3(0.1, 0.2, 0.35));
    float alpha = mix(0.18, 0.75, progress);
    alpha *= vignette(vUv);
    alpha += scan * 0.08;
    gl_FragColor = vec4(hud, clamp(alpha, 0.05, 0.9));
  }
`

function generateWaveformGeometry(peaks: number[]) {
  if (peaks.length < 2) {
    const fallback = new THREE.BoxGeometry(1.8, 0.4, 0.6)
    fallback.center()
    fallback.rotateX(Math.PI / 2)
    return fallback
  }

  const shape = new THREE.Shape()
  const length = peaks.length
  const step = length > 1 ? 2 / (length - 1) : 0
  const baseline = -0.4

  shape.moveTo(-1, baseline)
  for (let i = 0; i < length; i += 1) {
    const x = -1 + step * i
    const value = THREE.MathUtils.clamp(peaks[i] ?? 0, -1, 1)
    const amplitude = Math.max(Math.abs(value), 0.05)
    const y = baseline + amplitude * 1.2
    shape.lineTo(x, y)
  }
  shape.lineTo(1, baseline)

  for (let i = length - 1; i >= 0; i -= 1) {
    const x = -1 + step * i
    const value = THREE.MathUtils.clamp(peaks[i] ?? 0, -1, 1)
    const amplitude = Math.max(Math.abs(value), 0.05)
    const y = baseline - amplitude * 1.1
    shape.lineTo(x, y)
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.6,
    bevelEnabled: false,
    steps: length,
  })

  geometry.center()
  geometry.rotateX(Math.PI / 2)

  return geometry
}
