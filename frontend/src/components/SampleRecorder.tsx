import React, { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { useStore } from '../store'
import { decodeArrayBuffer, playBuffer } from '../audio/SamplePlayer'
import { setBuffer } from '../audio/BufferStore'
import { engine } from '../audio/Engine'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function SampleRecorder() {
  const sel = useStore(s => s.selectedPadId)
  const setPad = useStore(s => s.setPad)
  const [recState, setRecState] = useState<'idle' | 'recording' | 'processing'>('idle')
  const mediaRec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  useEffect(() => {
    return () => {
      if (mediaRec.current?.state === 'recording') mediaRec.current.stop()
    }
  }, [])

  const startRec = async () => {
    if (!sel || recState !== 'idle') return
    const padId = sel

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream)
    mediaRec.current = mr
    chunks.current = []

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

        // cache buffer + update store
        setBuffer(padId, buffer)
        setPad(padId, {
          sample: {
            id: padId,
            name: file.name,
            duration: buffer.duration,
            sampleRate: buffer.sampleRate,
            url,
          },
        })

        // auto audition
        const pad = useStore.getState().pads.find(p => p.id === padId)
        if (pad) {
          await engine.resume()
          playBuffer(buffer, engine.ctx.currentTime, {
            gain: pad.gain,
            attack: pad.attack,
            decay: pad.decay,
            startOffset: pad.startOffset,
            loop: pad.loop,
          })
        }
      } catch (err) {
        console.error('Failed to process recording', err)
      } finally {
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
  }

  return (
    <Card className="bg-glass-black shadow-neon-glow">
      <CardHeader>
        <CardTitle className="text-white">Record Sample</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={startRec}
          disabled={!sel || recState !== 'idle'}
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
        <div className="flex items-center gap-2 text-white">
          {recState === 'recording' && (
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          )}
          <span className="text-sm">
            {sel ? `Target: ${sel}` : 'Select a pad'}
            {recState === 'processing' && ' (processing...)'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
