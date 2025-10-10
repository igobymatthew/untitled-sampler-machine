import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Color, ShaderMaterial, Vector2 } from 'three'
import { useWebglSupport } from '@/hooks/useWebglSupport'

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
  const supportsWebgl = useWebglSupport(!isTestEnv)

  useEffect(() => {
    if (isTestEnv || typeof window === 'undefined') return
    setPulse(1)
    const duration = 260 + decay * 480
    const timeout = window.setTimeout(() => setPulse(0), duration)
    return () => window.clearTimeout(timeout)
  }, [triggerSignal, decay, isTestEnv])

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

  const layers = (
    <>
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
          backgroundImage: `repeating-linear-gradient(135deg, ${gridColor}, ${gridColor} 2px, transparent 2px, transparent 12px)`,
        }}
      />
      <div className="pad-visual__glare" />
    </>
  )

  if (typeof window === 'undefined') {
    return (
      <div className="pad-visual" aria-hidden>
        {layers}
      </div>
    )
  }

  return (
    <div className="pad-visual" aria-hidden>
      {layers}
      {supportsWebgl ? (
        <div className="pad-visual__canvas">
          <Canvas
            dpr={[1, 1.75]}
            gl={{ alpha: true, antialias: true }}
            frameloop="always"
            camera={{ position: [0, 0, 2.8], fov: 35 }}
          >
            <PadSurface
              color={color}
              isSelected={isSelected}
              gain={gain}
              triggerSignal={triggerSignal}
              sampleDuration={sampleDuration}
            />
          </Canvas>
        </div>
      ) : null}
    </div>
  )
})

type PadSurfaceProps = {
  color: string
  isSelected: boolean
  gain: number
  triggerSignal: number
  sampleDuration?: number
}

function PadSurface({ color, isSelected, gain, triggerSignal, sampleDuration }: PadSurfaceProps) {
  const materialRef = useRef<ShaderMaterial | null>(null)
  const pulseRef = useRef(0)
  const baseColor = useMemo(() => toThreeColor(color), [color])
  const { size } = useThree()
  const [scaleX, scaleY] = useMemo(() => {
    const width = Math.max(size.width, 1)
    const height = Math.max(size.height, 1)
    const aspect = width / height
    if (aspect >= 1) {
      return [aspect, 1]
    }
    return [1, 1 / Math.max(aspect, 1e-6)]
  }, [size.height, size.width])

  useEffect(() => {
    pulseRef.current = 1
    if (materialRef.current) {
      materialRef.current.uniforms.uPulse.value = 1
    }
  }, [triggerSignal])

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uColor.value.copy(baseColor)
    }
  }, [baseColor])

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uSelected.value = isSelected ? 1 : 0
    }
  }, [isSelected])

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uGain.value = gain
    }
  }, [gain])

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uLength.value = sampleDuration ?? 0
    }
  }, [sampleDuration])

  useEffect(() => {
    if (materialRef.current) {
      const width = Math.max(size.width, 1)
      const height = Math.max(size.height, 1)
      materialRef.current.uniforms.uResolution.value.set(width, height)
    }
  }, [size.height, size.width])

  useFrame((_, delta) => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uTime.value += delta
    pulseRef.current = Math.max(pulseRef.current - delta * (1.2 + gain * 0.55), 0)
    material.uniforms.uPulse.value = pulseRef.current
  })

  return (
    <mesh scale={[scaleX, scaleY, 1]}>
      <planeGeometry args={[2, 2, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        uniforms={{
          uColor: { value: baseColor.clone() },
          uTime: { value: 0 },
          uPulse: { value: 0 },
          uSelected: { value: isSelected ? 1 : 0 },
          uGain: { value: gain },
          uLength: { value: sampleDuration ?? 0 },
          uResolution: { value: new Vector2(1, 1) },
        }}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        toneMapped={false}
      />
    </mesh>
  )
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;

  uniform vec3 uColor;
  uniform float uTime;
  uniform float uPulse;
  uniform float uSelected;
  uniform float uGain;
  uniform float uLength;
  uniform vec2 uResolution;

  float roundedRectSdf(vec2 uv, float radius) {
    vec2 centered = uv * 2.0 - 1.0;
    vec2 q = abs(centered) - vec2(1.0 - radius);
    float outsideDist = length(max(q, 0.0));
    float insideDist = min(max(q.x, q.y), 0.0);
    return outsideDist + insideDist - radius;
  }

  float roundedRectMask(vec2 uv, float radius) {
    float sdf = roundedRectSdf(uv, radius);
    return 1.0 - smoothstep(0.0, 0.045, sdf);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    float aspect = max(uResolution.x, 1.0) / max(uResolution.y, 1.0);
    vec2 aspectUv = vec2(uv.x * aspect, uv.y);
    float len = length(uv);
    float mask = roundedRectMask(vUv, 0.22);

    float time = uTime * (0.4 + uGain * 0.35);
    float swirl = sin((aspectUv.x + aspectUv.y) * 4.0 + time * 2.2);
    float sparkle = noise(vUv * (6.0 + uLength * 1.3) + time * 0.6);
    float ripple = sin(length(aspectUv) * 10.0 - time * 4.5) * exp(-len * (2.4 - uGain * 0.3));
    float burst = uPulse * exp(-len * (2.6 + uGain)) * (1.0 + sparkle * 0.6);
    float glow = smoothstep(0.95, 0.18, len + swirl * 0.05) * mask;

    float energy = clamp(glow + ripple * 0.25 + sparkle * 0.28 + burst, 0.0, 1.4) * mask;
    float selectedGlow = uSelected * 0.35 * mask;

    vec3 baseColor = mix(vec3(0.05, 0.05, 0.07), uColor, 0.55 + energy * 0.32);
    vec3 highlight = uColor * (0.25 + energy * 0.5 + selectedGlow);
    vec3 finalColor = clamp(baseColor + highlight * 0.6, 0.0, 1.0) * mask;

    gl_FragColor = vec4(finalColor, mask * 0.9);
  }
`

function toThreeColor(input: string) {
  const color = new Color()
  try {
    color.set(input)
  } catch {
    color.set('#ffffff')
  }
  return color
}

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
