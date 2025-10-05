import React, { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { useStore } from '../store'
import { Button } from '@/components/ui/button'

export function SampleRecorder() {
  const sel = useStore(s => s.selectedPadId)
  const setPad = useStore(s => s.setPad)
  const [recState, setRecState] = useState<'idle' | 'recording' | 'stopped'>('idle')
  const mediaRec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  useEffect(() => {
    return () => {
      if (mediaRec.current?.state === 'recording') mediaRec.current.stop()
    }
  }, [])

  const startRec = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream)
    chunks.current = []
    mr.ondataavailable = e => {
      if (e.data.size > 0) chunks.current.push(e.data)
    }
    mr.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'audio/webm' })
      const url = URL.createObjectURL(blob)
      const file = new File([blob], 'recording.webm', { type: 'audio/webm' })
      if (!sel) return
      setPad(sel, { sample: { id: sel, name: file.name, duration: 0, sampleRate: 0, url } })
    }
    mr.start()
    mediaRec.current = mr
    setRecState('recording')
  }

  const stopRec = () => {
    mediaRec.current?.stop()
    setRecState('stopped')
    setTimeout(() => setRecState('idle'), 500)
  }

  return (
    <div className="text-white">
      <div className="text-sm mb-2">Record into selected pad</div>
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={startRec}
          disabled={!sel || recState === 'recording'}
          className="bg-glass-white hover:bg-red-500 hover:shadow-neon-glow"
        >
          <Mic className="mr-2" />
          Record
        </Button>
        <Button
          variant="outline"
          onClick={stopRec}
          disabled={recState !== 'recording'}
          className="bg-glass-white hover:bg-brand-primary hover:shadow-neon-glow"
        >
          <Square className="mr-2" />
          Stop
        </Button>
        <div className="flex items-center gap-2">
          {recState === 'recording' && <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />}
          <span className="text-sm">{sel ? `Target: ${sel}` : 'Select a pad'}</span>
        </div>
      </div>
    </div>
  )
}
