import React from 'react'
import { useStore } from '../store'
import { engine } from '../audio/Engine'
import { decodeArrayBuffer, playBuffer } from '../audio/SamplePlayer'
import { getBuffer, setBuffer } from '../audio/BufferStore'

export function PadGrid() {
  const pads = useStore(s=>s.pads)
  const setPad = useStore(s=>s.setPad)
  const selected = useStore(s=>s.selectedPadId)
  const setSelected = useStore(s=>s.setSelectedPad)

  const onTrigger = async (id:string) => {
    await engine.resume()
    const p = pads.find(p=>p.id===id)!
    const buf = getBuffer(id)
    if (!buf) return
    playBuffer(buf, engine.ctx.currentTime, {
      gain: p.gain, attack: p.attack, decay: p.decay, startOffset: p.startOffset, loop: p.loop
    })
  }

  const onLoad = async (id:string, file:File) => {
    const ab = await file.arrayBuffer()
    const buffer = await decodeArrayBuffer(ab)
    setBuffer(id, buffer)
    setPad(id, {
      sample: {
        id,
        name: file.name,
        duration: buffer.duration,
        sampleRate: buffer.sampleRate,
        url: URL.createObjectURL(file)
      }
    })
  }

  return (
    <div className="grid">
      {pads.map(p=>{
        const isSel = selected===p.id
        return (
          <div key={p.id} className={'pad' + (isSel? ' active' : '')} style={{background: '#151a21', borderColor: p.color}}
            onClick={()=> setSelected(p.id)}
            onDoubleClick={()=> onTrigger(p.id)}
          >
            <div style={{textAlign:'center'}}>
              <div>{p.name}</div>
              <div className="small">{p.sample? (p.sample.name) : 'Drop/Load'}</div>
              <div style={{height:6}}/>
              <input type="file" accept="audio/*" onChange={e=>{
                const f = e.target.files?.[0]; if (f) onLoad(p.id, f)
              }}/>
            </div>
          </div>
        )
      })}
    </div>
  )
}
