import { memo, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

type PadVisualProps = {
  color: string
  gain: number
  decay: number
  isSelected: boolean
  triggerSignal: number
  sampleDuration?: number
}

type Rgb = [number, number, number]

const WHITE: Rgb = [255, 255, 255]
const DEEP_BACKGROUND: Rgb = [12, 10, 9]

export const PadVisual = memo(function PadVisual({
  color,
  gain,
  decay,
  isSelected,
  triggerSignal,
  sampleDuration,
}: PadVisualProps) {
  const [pulse, setPulse] = useState(0)
  const base = useMemo<Rgb>(() => hexToRgb(color), [color])
  const isTestEnv =
    typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test'

  useEffect(() => {
    if (isTestEnv || typeof window === 'undefined') return
    setPulse(1)
    const duration = 260 + decay * 480
    const timeout = window.setTimeout(() => setPulse(0), duration)
    return () => window.clearTimeout(timeout)
  }, [triggerSignal, decay, isTestEnv])

  if (isTestEnv) {
    const fallbackStyle: CSSProperties = {
      backgroundImage: [
        `radial-gradient(circle at 20% 20%, ${withAlpha(mixColor(base, WHITE, 0.3), 0.5)}, transparent 60%)`,
        `linear-gradient(135deg, rgba(${DEEP_BACKGROUND.join(',')}, 0.85), rgba(17, 24, 39, 0.4))`,
      ].join(', '),
      border: `1px solid ${withAlpha(mixColor(base, WHITE, 0.28), 0.35)}`,
      opacity: isSelected ? 0.92 : 0.82,
    }
    return (
      <div className="pad-visual" aria-hidden>
        <div className="pad-visual__background" style={fallbackStyle} />
      </div>
    )
  }

  const shimmerDuration = useMemo(() => {
    const gainFactor = clamp(gain, 0, 1.2)
    const lengthFactor = clamp(sampleDuration ?? 0, 0, 4)
    const seconds = Math.max(3.8, 8 - gainFactor * 2.2 - lengthFactor * 0.6)
    return `${seconds.toFixed(2)}s`
  }, [gain, sampleDuration])

  const backgroundStyle = useMemo<CSSProperties>(() => {
    const accent = withAlpha(mixColor(base, WHITE, 0.35), 0.55 + (isSelected ? 0.18 : 0) + pulse * 0.28)
    const secondary = withAlpha(mixColor(base, WHITE, 0.12), 0.2 + (isSelected ? 0.1 : 0) + pulse * 0.12)
    const borderColor = withAlpha(mixColor(base, WHITE, 0.28), 0.38 + (isSelected ? 0.16 : 0))
    const glowPrimary = withAlpha(mixColor(base, WHITE, 0.18), 0.26 + pulse * 0.3 + (isSelected ? 0.18 : 0.04))
    const glowSecondary = withAlpha(mixColor(base, WHITE, 0.45), 0.18 + pulse * 0.22)
    const scale = 1 + (isSelected ? 0.015 : 0) + pulse * 0.012
    const translate = isSelected ? '-2px' : '0px'

    return {
      backgroundImage: [
        `radial-gradient(circle at 20% 20%, ${accent}, transparent 55%)`,
        `radial-gradient(circle at 80% 80%, ${secondary}, transparent 68%)`,
        `linear-gradient(135deg, rgba(${DEEP_BACKGROUND.join(',')}, 0.9), rgba(17, 24, 39, 0.45))`,
      ].join(', '),
      boxShadow: `0 0 ${18 + pulse * 18 + (isSelected ? 8 : 0)}px ${glowPrimary}, 0 0 ${48 + pulse * 26}px ${glowSecondary}`,
      border: `1px solid ${borderColor}`,
      transform: `translateY(${translate}) scale(${scale})`,
      opacity: clamp(0.84 + (isSelected ? 0.09 : 0) + pulse * 0.14, 0.65, 1),
    }
  }, [base, isSelected, pulse])

  const shimmerColor = useMemo(() => withAlpha(mixColor(base, WHITE, 0.7), 0.22 + (isSelected ? 0.08 : 0)), [base, isSelected])
  const shimmerTrail = useMemo(() => withAlpha(mixColor(base, WHITE, 0.4), 0.08 + pulse * 0.05), [base, pulse])
  const gridColor = useMemo(() => withAlpha(mixColor(base, WHITE, 0.6), 0.06 + (isSelected ? 0.05 : 0)), [base, isSelected])

  return (
    <div className="pad-visual" aria-hidden>
      <div className="pad-visual__background" style={backgroundStyle} />
      <div
        className="pad-visual__shimmer"
        style={{
          background: `conic-gradient(from 180deg at 50% 50%, ${shimmerColor} 0deg, transparent 120deg, ${shimmerTrail} 240deg, transparent 360deg)`,
          animationDuration: shimmerDuration,
        }}
      />
      <div
        className="pad-visual__grid"
        style={{
          backgroundImage: `repeating-linear-gradient(135deg, ${gridColor}, ${gridColor} 2px, transparent 2px, transparent 12px)`
        }}
      />
      <div className="pad-visual__glare" />
    </div>
  )
})

function hexToRgb(hex: string): Rgb {
  let normalized = hex.trim()
  if (normalized.startsWith('#')) {
    normalized = normalized.slice(1)
  }

  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map(char => char + char)
      .join('')
  }

  if (normalized.length !== 6) {
    return WHITE
  }

  const value = Number.parseInt(normalized, 16)
  if (Number.isNaN(value)) {
    return WHITE
  }

  return [
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255,
  ]
}

function mixColor(base: Rgb, other: Rgb, ratio: number): Rgb {
  const t = clamp(ratio, 0, 1)
  return [
    Math.round(base[0] + (other[0] - base[0]) * t),
    Math.round(base[1] + (other[1] - base[1]) * t),
    Math.round(base[2] + (other[2] - base[2]) * t),
  ]
}

function withAlpha(rgb: Rgb, alpha: number) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp(alpha, 0, 1)})`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
