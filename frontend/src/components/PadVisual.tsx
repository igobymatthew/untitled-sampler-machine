import { Canvas, useFrame } from '@react-three/fiber'
import type { RootState } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type PadVisualProps = {
  color: string
  gain: number
  decay: number
  isSelected: boolean
  triggerSignal: number
  sampleDuration?: number
}

type PadSurfaceUniforms = {
  uTime: THREE.IUniform<number>
  uColor: THREE.IUniform<THREE.Color>
  uIntensity: THREE.IUniform<number>
  uHighlight: THREE.IUniform<number>
  uPulse: THREE.IUniform<number>
}

const vertexShader = /* glsl */ `
  varying float vWave;
  varying float vRadial;
  varying float vIntensity;

  uniform float uTime;
  uniform float uIntensity;
  uniform float uPulse;

  void main() {
    vec3 pos = position;
    float wave = sin((pos.x + uTime * 0.7) * 3.6) + cos((pos.y - uTime * 1.1) * 3.2);
    float radial = sin(length(pos.xy) * 7.5 - uTime * 3.6);
    float pulse = exp(-length(pos.xy) * 2.8) * uPulse;
    pos.z += (wave * 0.025 + radial * 0.045) * (0.5 + uIntensity * 0.9) + pulse * 0.15;
    vWave = wave;
    vRadial = radial;
    vIntensity = uIntensity;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying float vWave;
  varying float vRadial;
  varying float vIntensity;

  uniform vec3 uColor;
  uniform float uHighlight;

  void main() {
    float shimmer = 0.55 + 0.45 * sin(vWave * 0.6 + vRadial * 0.8);
    float glow = smoothstep(0.0, 1.2, vIntensity + 0.25);
    vec3 base = mix(vec3(0.08, 0.09, 0.12), uColor, shimmer * 0.75);
    vec3 highlight = mix(base, vec3(1.0), clamp(uHighlight, 0.0, 1.0) * 0.45);
    float alpha = 0.55 + glow * 0.35;
    gl_FragColor = vec4(highlight, alpha);
  }
`

const PadSurface = memo(function PadSurface({ uniforms }: { uniforms: PadSurfaceUniforms }) {
  return (
    <mesh rotation-x={-Math.PI / 2}>
      <planeGeometry args={[1.35, 1.35, 128, 128]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
})

const PadVisualCanvas = memo(function PadVisualCanvas({
  color,
  gain,
  decay,
  isSelected,
  triggerSignal,
  sampleDuration,
}: PadVisualProps) {
  const highlight = useRef(isSelected ? 1 : 0)
  const highlightTarget = useRef(isSelected ? 1 : 0)
  const intensity = useRef(0.35)
  const pulse = useRef(0)

  const uniforms = useRef<PadSurfaceUniforms>({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uIntensity: { value: intensity.current },
    uHighlight: { value: highlight.current },
    uPulse: { value: pulse.current },
  })

  const speedBase = useMemo(() => {
    const duration = sampleDuration ?? 0
    const durationFactor = THREE.MathUtils.clamp(duration / 2.5, 0, 1)
    const decayFactor = THREE.MathUtils.clamp(decay * 1.5, 0, 1.2)
    return 1.1 + durationFactor * 0.9 + decayFactor * 0.6
  }, [decay, sampleDuration])

  useEffect(() => {
    highlightTarget.current = isSelected ? 1 : 0
  }, [isSelected])

  useEffect(() => {
    uniforms.current.uColor.value.set(color)
  }, [color])

  useEffect(() => {
    pulse.current = 1.6
  }, [triggerSignal])

  useFrame((_state: RootState, delta: number) => {
    const clampedDelta = Math.min(delta, 0.05)
    pulse.current = Math.max(pulse.current - clampedDelta * (1.5 + decay * 0.6), 0)

    const gainFactor = THREE.MathUtils.clamp(gain / 1.2, 0, 1.1)
    const base = 0.2 + gainFactor * 0.45
    const targetIntensity = base + highlight.current * 0.3 + pulse.current * 0.6
    intensity.current += (targetIntensity - intensity.current) * Math.min(clampedDelta * 6, 1)

    highlight.current += (highlightTarget.current - highlight.current) * Math.min(clampedDelta * 7.5, 1)

    uniforms.current.uTime.value = (uniforms.current.uTime.value + clampedDelta * speedBase) % 1000
    uniforms.current.uIntensity.value = intensity.current
    uniforms.current.uHighlight.value = highlight.current
    uniforms.current.uPulse.value = pulse.current
  })

  return (
    <Canvas
      className="absolute inset-0 h-full w-full pointer-events-none"
      camera={{ position: [0, 1.4, 1.5], fov: 55 }}
      gl={{ alpha: true, antialias: true }}
      onCreated={(state: RootState) => {
        state.gl.setClearColor(new THREE.Color('#000000'), 0)
        state.gl.setClearAlpha(0)
      }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.45} />
      <directionalLight position={[1.2, 1.8, 1.5]} intensity={0.6} color={color} />
      <PadSurface uniforms={uniforms.current} />
    </Canvas>
  )
})

const PadVisualFallback = memo(function PadVisualFallback({
  color,
  isSelected,
  triggerSignal,
}: Pick<PadVisualProps, 'color' | 'isSelected' | 'triggerSignal'>) {
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setPulse(1)
    const timeout = window.setTimeout(() => setPulse(0), 420)
    return () => window.clearTimeout(timeout)
  }, [triggerSignal])

  const opacity = 0.48 + (isSelected ? 0.22 : 0) + pulse * 0.24

  return (
    <div
      className="absolute inset-0 pointer-events-none transition duration-500 ease-out"
      style={{
        background: `radial-gradient(circle at 25% 25%, ${color}55, transparent 60%), radial-gradient(circle at 75% 75%, ${color}22, transparent 65%), linear-gradient(140deg, rgba(15,23,42,0.75), rgba(30,41,59,0.3))`,
        opacity,
        transform: `scale(${1 + pulse * 0.04})`,
        filter: isSelected ? 'blur(0)' : 'blur(0.4px)',
      }}
    />
  )
})

export const PadVisual = memo(function PadVisual(props: PadVisualProps) {
  const supportsWebGL = useMemo(() => {
    if (typeof document === 'undefined') return false
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext?.('webgl2') ?? canvas.getContext?.('webgl')
      return Boolean(gl)
    } catch (error) {
      return false
    }
  }, [])

  if (!supportsWebGL) {
    const { color, isSelected, triggerSignal } = props
    return (
      <PadVisualFallback
        color={color}
        isSelected={isSelected}
        triggerSignal={triggerSignal}
      />
    )
  }

  return <PadVisualCanvas {...props} />
})
