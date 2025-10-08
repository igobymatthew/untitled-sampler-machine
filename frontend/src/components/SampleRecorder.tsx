import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Info, Mic, Play, RefreshCcw, Square } from 'lucide-react'
import { useStore } from '../store'
import { decodeArrayBuffer, playBuffer } from '../audio/SamplePlayer'
import { setBuffer } from '../audio/BufferStore'
import { engine } from '../audio/Engine'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { computePeaks } from '@/lib/audioAnalysis'

type PreviewSample = {
  buffer: AudioBuffer
  fileName: string
  url: string
}

type StrictFloat32Array = Float32Array<ArrayBuffer>

const MIN_TRIM_GAP = 0.01

export function SampleRecorder() {
  const pads = useStore(s => s.pads)
  const sel = useStore(s => s.selectedPadId)
  const setPad = useStore(s => s.setPad)
  const setSelectedPad = useStore(s => s.setSelectedPad)
  const [recState, setRecState] = useState<'idle' | 'recording' | 'processing'>('idle')
  const mediaRec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const levelData = useRef<StrictFloat32Array | null>(null)
  const levelFrame = useRef<number>()

  const [inputLevel, setInputLevel] = useState(0)
  const [targetPadId, setTargetPadId] = useState<string | undefined>(sel)
  const [preview, setPreview] = useState<PreviewSample | null>(null)
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 0])
  const [peaks, setPeaks] = useState<number[]>([])
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [trimInputs, setTrimInputs] = useState<{ start: string; end: string }>({
    start: '0.00',
    end: '0.00',
  })

  const previewDuration = preview?.buffer.duration ?? 0

  useEffect(() => {
    if (sel) {
      setTargetPadId(sel)
    }
  }, [sel])

  useEffect(() => {
    return () => {
      if (mediaRec.current?.state === 'recording') mediaRec.current.stop()
      stopMonitoring()
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [])

  useEffect(() => {
    return () => {
      if (preview?.url) {
        URL.revokeObjectURL(preview.url)
      }
    }
  }, [preview?.url])

  useEffect(() => {
    if (preview?.buffer) {
      const duration = preview.buffer.duration
      setTrimRange([0, duration])
      setPeaks(computePeaks(preview.buffer))
    } else {
      setTrimRange([0, 0])
      setPeaks([])
    }
  }, [preview?.buffer])

  useEffect(() => {
    setTrimInputs({
      start: trimRange[0].toFixed(2),
      end: trimRange[1].toFixed(2),
    })
  }, [trimRange[0], trimRange[1]])

  const applyTrimRange = useCallback(
    (start: number, end: number) => {
      if (!preview || previewDuration <= 0) return

      setTrimRange(prev => {
        const safeStart = Math.max(0, Math.min(start, Math.max(previewDuration - MIN_TRIM_GAP, 0)))
        const safeEnd = Math.max(
          safeStart + MIN_TRIM_GAP,
          Math.min(end, previewDuration)
        )

        if (safeStart === prev[0] && safeEnd === prev[1]) {
          return prev
        }

        return [safeStart, safeEnd]
      })
    },
    [preview, previewDuration]
  )

  const commitTrimInput = (position: 'start' | 'end') => {
    if (!preview || previewDuration <= 0) {
      setTrimInputs({
        start: trimRange[0].toFixed(2),
        end: trimRange[1].toFixed(2),
      })
      return
    }

    const rawValue = Number.parseFloat(trimInputs[position])
    if (Number.isNaN(rawValue)) {
      setTrimInputs(prev => ({
        ...prev,
        [position]: position === 'start' ? trimRange[0].toFixed(2) : trimRange[1].toFixed(2),
      }))
      return
    }

    if (position === 'start') {
      applyTrimRange(rawValue, trimRange[1])
    } else {
      applyTrimRange(trimRange[0], rawValue)
    }
  }

  const handleTrimInputKeyDown = (
    position: 'start' | 'end'
  ): React.KeyboardEventHandler<HTMLInputElement> => event => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitTrimInput(position)
      event.currentTarget.blur()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setTrimInputs(prev => ({
        ...prev,
        [position]: position === 'start' ? trimRange[0].toFixed(2) : trimRange[1].toFixed(2),
      }))
      event.currentTarget.blur()
    }
  }

  const stopMonitoring = () => {
    if (levelFrame.current) {
      cancelAnimationFrame(levelFrame.current)
      levelFrame.current = undefined
    }
    analyserRef.current?.disconnect()
    analyserRef.current = null
    sourceRef.current?.disconnect()
    sourceRef.current = null
    levelData.current = null
    setInputLevel(0)
  }

  const handleLevelFrame = () => {
    const analyser = analyserRef.current
    if (!analyser || !levelData.current) return

    analyser.getFloatTimeDomainData(levelData.current)
    let sumSquares = 0
    for (let i = 0; i < levelData.current.length; i += 1) {
      const sample = levelData.current[i]
      sumSquares += sample * sample
    }
    const rms = Math.sqrt(sumSquares / levelData.current.length)
    setInputLevel(rms)
    levelFrame.current = requestAnimationFrame(handleLevelFrame)
  }

  const startRec = async () => {
    if (recState !== 'idle') return
    if (!targetPadId) {
      setStatusMessage('Select a pad to assign the recording to before capturing audio.')
      return
    }

    setStatusMessage('')
    setPreview(null)
    setPeaks([])

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream
    const mr = new MediaRecorder(stream)
    mediaRec.current = mr
    chunks.current = []

    await engine.resume()
    const source = engine.ctx.createMediaStreamSource(stream)
    const analyser = engine.ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.4
    source.connect(analyser)
    analyserRef.current = analyser
    sourceRef.current = source
    levelData.current = new Float32Array(new ArrayBuffer(analyser.fftSize * 4)) as StrictFloat32Array
    levelFrame.current = requestAnimationFrame(handleLevelFrame)

    mr.ondataavailable = e => {
      if (e.data.size > 0) chunks.current.push(e.data)
    }

    mr.onstop = async () => {
      setRecState('processing')

      const blob = new Blob(chunks.current, { type: 'audio/webm' })
      const url = URL.createObjectURL(blob)
      const file = new File([blob], 'recording.webm', { type: 'audio/webm' })

      try {
        const arrayBuffer = await blob.arrayBuffer()
        const buffer = await decodeArrayBuffer(arrayBuffer)
        setPreview(prev => {
          if (prev?.url) {
            URL.revokeObjectURL(prev.url)
          }
          return {
            buffer,
            fileName: file.name,
            url,
          }
        })
      } catch (err) {
        console.error('Failed to process recording', err)
        setStatusMessage('Something went wrong while decoding the recording.')
      } finally {
        stopMonitoring()
        stream.getTracks().forEach(track => track.stop())
        // only clear if this stop corresponds to the same recorder
        if (mediaRec.current === mr) {
          mediaRec.current = null
        }
        setRecState('idle')
      }
    }

    mr.start()
    setRecState('recording')
  }

  const stopRec = () => {
    if (mediaRec.current?.state === 'recording') {
      mediaRec.current.stop()
    }
    stopMonitoring()
  }

  const assignToPad = async () => {
    if (!preview || !targetPadId) {
      setStatusMessage('Record audio first, then choose a destination pad to assign it to.')
      return
    }

    setBuffer(targetPadId, preview.buffer)
    setPad(targetPadId, {
      sample: {
        id: targetPadId,
        name: preview.fileName,
        duration: preview.buffer.duration,
        sampleRate: preview.buffer.sampleRate,
        url: preview.url,
      },
      trimStart: trimRange[0],
      trimEnd: trimRange[1],
      startOffset: trimRange[0],
    })
    setSelectedPad(targetPadId)

    const pad = useStore.getState().pads.find(p => p.id === targetPadId)
    await engine.resume()
    playBuffer(preview.buffer, engine.ctx.currentTime, {
      gain: pad?.gain ?? 1,
      attack: pad?.attack ?? 0,
      decay: pad?.decay ?? 0.25,
      startOffset: trimRange[0],
      endOffset: trimRange[1],
      loop: pad?.loop ?? false,
    })

    setStatusMessage(`Assigned to ${pad?.name ?? targetPadId}.`)
  }

  const auditionRecording = async () => {
    if (!preview) return
    const pad = targetPadId
      ? useStore.getState().pads.find(p => p.id === targetPadId)
      : undefined
    await engine.resume()
    playBuffer(preview.buffer, engine.ctx.currentTime, {
      gain: pad?.gain ?? 1,
      attack: pad?.attack ?? 0,
      decay: pad?.decay ?? 0.25,
      startOffset: trimRange[0],
      endOffset: trimRange[1],
      loop: false,
    })
  }

  const discardPreview = () => {
    if (preview?.url) {
      URL.revokeObjectURL(preview.url)
    }
    setPreview(null)
    setTrimRange([0, 0])
    setPeaks([])
    setStatusMessage('Recording cleared.')
  }

  const levelPercent = Math.min(1, inputLevel * 3)
  const trimDisabled = !preview || previewDuration <= 0

  return (
    <Card className="bg-glass-black shadow-neon-glow">
      <CardHeader>
        <CardTitle className="text-white">Record Sample</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="outline"
            onClick={startRec}
            disabled={recState !== 'idle'}
            className="bg-glass-white text-white hover:bg-red-500 hover:shadow-neon-glow"
          >
            <Mic className="mr-2" />
            Record
          </Button>
          <Button
            variant="outline"
            onClick={stopRec}
            disabled={recState !== 'recording'}
            className="bg-glass-white text-white hover:bg-brand-primary hover:shadow-neon-glow"
          >
            <Square className="mr-2" />
            Stop
          </Button>
          <Select
            value={targetPadId}
            onValueChange={value => {
              setTargetPadId(value)
              setSelectedPad(value)
            }}
          >
            <SelectTrigger className="w-48 bg-black/40 text-left text-white">
              <SelectValue placeholder="Assign to pad" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 text-white">
              {pads.map(pad => (
                <SelectItem key={pad.id} value={pad.id}>
                  {pad.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-white/70">
            <span className="uppercase tracking-[0.35em] text-brand-light/70">Input Level</span>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-500 transition-all duration-150"
                style={{ width: `${Math.round(levelPercent * 100)}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-white">
            {recState === 'recording' && (
              <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
            )}
            <span className="text-sm capitalize">{recState}</span>
          </div>
        </div>

        {preview && (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.35em] text-brand-light/70">
              <span>Trim &amp; Review</span>
              <span className="text-[11px] normal-case tracking-normal text-white/60">
                {preview.fileName} · {(trimRange[1] - trimRange[0]).toFixed(2)}s of {preview.buffer.duration.toFixed(2)}s
              </span>
            </div>

            <div className="relative h-28 w-full overflow-hidden rounded-xl border border-white/10 bg-black/40">
              <svg
                viewBox={`0 0 ${Math.max(peaks.length, 1)} 100`}
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full text-brand-secondary/80"
              >
                {peaks.length > 0 ? (
                  peaks.map((value, index) => {
                    const height = value * 50
                    const center = 50
                    return (
                      <rect
                        key={index}
                        x={index}
                        y={center - height}
                        width={1}
                        height={height * 2}
                        fill="currentColor"
                        opacity={0.8}
                      />
                    )
                  })
                ) : (
                  <text
                    x="50%"
                    y="50%"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    className="fill-white/40 text-xs"
                  >
                    Recording ready — adjust trim below
                  </text>
                )}
              </svg>
              <div
                className="absolute inset-y-0 left-0 bg-black/70"
                style={{ width: `${(trimRange[0] / (preview.buffer.duration || 1)) * 100}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 bg-black/70"
                style={{
                  width: `${Math.max(
                    0,
                    100 - (trimRange[1] / (preview.buffer.duration || 1)) * 100
                  )}%`,
                }}
              />
              <div
                className="absolute inset-y-0 w-0.5 bg-brand-primary"
                style={{ left: `${(trimRange[0] / (preview.buffer.duration || 1)) * 100}%` }}
              />
              <div
                className="absolute inset-y-0 w-0.5 bg-brand-primary"
                style={{ left: `${(trimRange[1] / (preview.buffer.duration || 1)) * 100}%` }}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-brand-light/70">
                <span>Trim Window</span>
                <span className="text-[11px] normal-case tracking-normal text-white/60">
                  {trimRange[0].toFixed(2)}s – {trimRange[1].toFixed(2)}s
                </span>
              </div>
              <Slider
                min={0}
                max={previewDuration > 0 ? previewDuration : 1}
                step={0.005}
                disabled={trimDisabled}
                value={[trimRange[0], trimRange[1]]}
                onValueChange={([start, end]) => {
                  if (trimDisabled) return
                  applyTrimRange(start, end)
                }}
              />
            </div>

            <div className="grid gap-3 text-xs uppercase tracking-[0.35em] text-brand-light/70 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span>Start</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  max={previewDuration > 0 ? previewDuration : undefined}
                  value={trimInputs.start}
                  disabled={trimDisabled}
                  onChange={event =>
                    setTrimInputs(prev => ({ ...prev, start: event.target.value }))
                  }
                  onBlur={() => commitTrimInput('start')}
                  onKeyDown={handleTrimInputKeyDown('start')}
                  className="tracking-normal text-base bg-black/40 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-brand-primary/60"
                  aria-label="Trim start time in seconds"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span>End</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  max={previewDuration > 0 ? previewDuration : undefined}
                  value={trimInputs.end}
                  disabled={trimDisabled}
                  onChange={event =>
                    setTrimInputs(prev => ({ ...prev, end: event.target.value }))
                  }
                  onBlur={() => commitTrimInput('end')}
                  onKeyDown={handleTrimInputKeyDown('end')}
                  className="tracking-normal text-base bg-black/40 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-brand-primary/60"
                  aria-label="Trim end time in seconds"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                className="bg-black/60 text-white hover:bg-brand-primary hover:shadow-neon-glow"
                onClick={auditionRecording}
              >
                <Play className="mr-2 h-4 w-4" />
                Audition Trim
              </Button>
              <Button
                variant="outline"
                className="bg-black/60 text-white hover:bg-emerald-500 hover:shadow-neon-glow"
                onClick={assignToPad}
              >
                <Check className="mr-2 h-4 w-4" />
                Assign to Pad
              </Button>
              <Button
                variant="outline"
                className="bg-black/60 text-white hover:bg-red-500/80 hover:shadow-neon-glow"
                onClick={discardPreview}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Discard
              </Button>
            </div>
          </div>
        )}

        {statusMessage && (
          <div className="flex items-center gap-2 text-xs text-white/70">
            <Info className="h-3.5 w-3.5 text-brand-secondary" />
            <span>{statusMessage}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
