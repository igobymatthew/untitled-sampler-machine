const buffers: Record<string, AudioBuffer> = {}

export function setBuffer(id: string, buffer: AudioBuffer) {
  buffers[id] = buffer
}

export function getBuffer(id: string) {
  return buffers[id]
}

export function hasBuffer(id: string) {
  return id in buffers
}

export function clearBuffer(id: string) {
  delete buffers[id]
}

export function getAllBuffers() {
  return buffers
}

export type BufferStore = Record<string, AudioBuffer>
