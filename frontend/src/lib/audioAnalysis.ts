export function computePeaks(buffer: AudioBuffer, resolution = 256): number[] {
  const bucketSize = Math.max(1, Math.floor(buffer.length / resolution))
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i)
  )
  const values: number[] = []

  for (let bucket = 0; bucket < resolution; bucket += 1) {
    const start = bucket * bucketSize
    const end = Math.min(start + bucketSize, buffer.length)
    if (start >= end) {
      values.push(0)
      continue
    }

    let sum = 0
    for (const channel of channels) {
      for (let i = start; i < end; i += 1) {
        sum += Math.abs(channel[i])
      }
    }

    const count = (end - start) * channels.length
    values.push(count ? sum / count : 0)
  }

  const max = values.reduce((acc, val) => (val > acc ? val : acc), 0)
  return max > 0 ? values.map(v => v / max) : values
}
