import React from 'react'
import { TransportBar } from './components/Transport'
import { PadGrid } from './components/PadGrid'
import { Sequencer } from './components/Sequencer'
import { SampleRecorder } from './components/SampleRecorder'

export default function App() {
  return (
    <div className="app">
      <div className="panel">
        <TransportBar />
        <hr style={{borderColor:'#1f242b', margin:'12px 0'}} />
        <SampleRecorder />
      </div>
      <div className="panel">
        <PadGrid />
        <div style={{height:12}} />
        <Sequencer />
      </div>
    </div>
  )
}
