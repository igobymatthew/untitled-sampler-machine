import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

export function SampleRecorder(){
  const sel = useStore(s=>s.selectedPadId)
  const setPad = useStore(s=>s.setPad)
  const [recState, setRecState] = useState<'idle'|'recording'|'stopped'>('idle')
  const mediaRec = useRef<MediaRecorder|null>(null)
  const chunks = useRef<Blob[]>([])

  useEffect(()=>{
    return ()=> { if (mediaRec.current?.state === 'recording') mediaRec.current.stop() }
  }, [])

  const startRec = async ()=>{
    const stream = await navigator.mediaDevices.getUserMedia({audio:true})
    const mr = new MediaRecorder(stream)
    chunks.current = []
    mr.ondataavailable = (e)=> { if (e.data.size>0) chunks.current.push(e.data) }
    mr.onstop = ()=>{
      const blob = new Blob(chunks.current, { type: 'audio/webm' })
      const url = URL.createObjectURL(blob)
      const file = new File([blob], 'recording.webm', { type: 'audio/webm' })
      if (!sel) return
      // Assign to selected pad (client-side only; convert as needed)
      setPad(sel, { sample: { id: sel, name: file.name, duration: 0, sampleRate: 0, url } })
    }
    mr.start()
    mediaRec.current = mr
    setRecState('recording')
  }

  const stopRec = ()=>{
    mediaRec.current?.stop()
    setRecState('stopped')
    setTimeout(()=> setRecState('idle'), 500)
  }

  return (
    <div>
      <div className="small">Record into selected pad</div>
      <div style={{display:'flex', gap:8}}>
        <button onClick={startRec} disabled={!sel || recState==='recording'}>● Record</button>
        <button onClick={stopRec} disabled={recState!=='recording'}>■ Stop</button>
        <span className="small">{sel? `Target: ${sel}` : 'Select a pad'}</span>
      </div>
    </div>
  )
}
