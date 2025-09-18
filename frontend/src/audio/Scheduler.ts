// Basic look-ahead scheduler
import { engine } from './Engine'

type Callback = (when: number, stepInBar: number, absoluteStep: number) => void

export class Scheduler {
  tempo = 120
  stepsPerBar = 16
  bars = 1
  lookahead = 0.025 // seconds
  scheduleHorizon = 0.10 // seconds
  private nextTime = 0
  private stepInBar = 0
  private stepIndex = 0
  private totalSteps = this.stepsPerBar * this.bars
  private rafId: number | null = null
  private cb: Callback

  constructor(cb:Callback) {
    this.cb = cb
  }

  set(tempo:number, stepsPerBar:number, bars = 1) {
    this.tempo = tempo
    this.stepsPerBar = stepsPerBar
    this.bars = bars
    this.totalSteps = Math.max(1, this.stepsPerBar * this.bars)
    this.stepIndex = this.stepIndex % this.totalSteps
    this.stepInBar = this.stepIndex % this.stepsPerBar
  }

  private stepDurationSec() {
    const beatsPerSec = this.tempo / 60
    // 4 steps per beat for 16th-notes when stepsPerBar=16 and 4/4
    return 1 / (beatsPerSec * (this.stepsPerBar/4))
  }

  start() {
    this.nextTime = engine.ctx.currentTime + 0.06
    this.stepIndex = 0
    this.stepInBar = 0
    const tick = () => {
      const now = engine.ctx.currentTime
      while (this.nextTime < now + this.scheduleHorizon) {
        this.cb(this.nextTime, this.stepInBar, this.stepIndex)
        this.nextTime += this.stepDurationSec()
        this.stepIndex = (this.stepIndex + 1) % this.totalSteps
        this.stepInBar = this.stepIndex % this.stepsPerBar
      }
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.stepIndex = 0
    this.stepInBar = 0
  }
}
