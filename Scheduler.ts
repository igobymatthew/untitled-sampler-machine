// Basic look-ahead scheduler
import { engine } from './Engine'
type Callback = (when:number, step:number)=>void

export class Scheduler {
  tempo = 120
  stepsPerBar = 16
  lookahead = 0.025 // seconds
  scheduleHorizon = 0.10 // seconds
  private nextTime = 0
  private currentStep = 0
  private rafId: number | null = null
  private cb: Callback

  constructor(cb:Callback) {
    this.cb = cb
  }

  set(tempo:number, stepsPerBar:number) {
    this.tempo = tempo
    this.stepsPerBar = stepsPerBar
  }

  private stepDurationSec() {
    const beatsPerSec = this.tempo / 60
    // 4 steps per beat for 16th-notes when stepsPerBar=16 and 4/4
    return 1 / (beatsPerSec * (this.stepsPerBar/4))
  }

  start() {
    this.nextTime = engine.ctx.currentTime + 0.06
    const tick = () => {
      const now = engine.ctx.currentTime
      while (this.nextTime < now + this.scheduleHorizon) {
        this.cb(this.nextTime, this.currentStep)
        this.nextTime += this.stepDurationSec()
        this.currentStep = (this.currentStep + 1) % this.stepsPerBar
      }
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = null
  }
}
