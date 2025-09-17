// Simple Audio Engine
export class Engine {
  public ctx: AudioContext
  public master: GainNode

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(this.ctx.destination)
  }

  resume() { return this.ctx.resume() }
}

export const engine = new Engine()
