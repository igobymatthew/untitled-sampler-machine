import React from 'react'
import { useStore } from '../store'
import { useWebglSupport } from '@/hooks/useWebglSupport'

type SequencerStepButtonProps = {
  on: boolean
  isNow: boolean
  padColor: string
  showBarDivider: boolean
  onClick: () => void
}

type GlState = {
  gl: WebGLRenderingContext
  program: WebGLProgram
  buffers: {
    position: WebGLBuffer
  }
  uniforms: {
    resolution: WebGLUniformLocation | null
    progress: WebGLUniformLocation | null
    cursor: WebGLUniformLocation | null
    activeColor: WebGLUniformLocation | null
    inactiveColor: WebGLUniformLocation | null
    time: WebGLUniformLocation | null
  }
  attributes: {
    position: number
  }
}

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision mediump float;
  varying vec2 v_uv;

  uniform vec2 u_resolution;
  uniform float u_progress;
  uniform float u_cursor;
  uniform vec3 u_activeColor;
  uniform vec3 u_inactiveColor;
  uniform float u_time;

  float easeInOutCubic(float t) {
    return t < 0.5
      ? 4.0 * t * t * t
      : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  }

  vec3 toneMap(vec3 color) {
    return color / (color + vec3(1.0));
  }

  void main() {
    vec2 uv = v_uv;
    float eased = easeInOutCubic(clamp(u_progress, 0.0, 1.0));

    vec3 base = mix(u_inactiveColor, u_activeColor, eased);

    float ripple = sin((uv.x + uv.y) * 24.0 + u_time * 3.8) * 0.04;
    ripple *= eased;

    float cursor = clamp(u_cursor, -0.25, 1.25);
    float sweep = exp(-24.0 * pow(uv.x - cursor, 2.0));
    float trail = exp(-18.0 * max(cursor - uv.x, 0.0));
    vec3 sweepColor = vec3(0.85, 0.95, 1.0) * sweep * 0.65 + vec3(0.55, 0.65, 0.9) * trail * 0.25;

    vec3 glow = base + ripple + sweepColor;
    vec3 finalColor = toneMap(glow);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error('Failed to create shader')
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(info || 'Could not compile shader')
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext, vertex: string, fragment: string) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertex)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragment)

  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    throw new Error('Failed to create program')
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(info || 'Could not link WebGL program')
  }

  return program
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized

  const intVal = Number.parseInt(value, 16)
  if (Number.isNaN(intVal)) {
    return INACTIVE_COLOR
  }

  const r = (intVal >> 16) & 255
  const g = (intVal >> 8) & 255
  const b = intVal & 255

  return [r / 255, g / 255, b / 255]
}

const INACTIVE_COLOR: [number, number, number] = [0.10, 0.11, 0.15]

function SequencerStepButton({ on, isNow, padColor, showBarDivider, onClick }: SequencerStepButtonProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const buttonRef = React.useRef<HTMLButtonElement | null>(null)
  const animationRef = React.useRef<number>()
  const glStateRef = React.useRef<GlState | null>(null)
  const progressRef = React.useRef(on ? 1 : 0)
  const targetProgressRef = React.useRef(on ? 1 : 0)
  const cursorStateRef = React.useRef<{ active: boolean; value: number }>({ active: false, value: -0.25 })
  const startTimeRef = React.useRef<number | null>(null)
  const lastTimeRef = React.useRef<number | null>(null)
  const [activeColor] = React.useState(() => hexToRgb(padColor))
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  const supportsWebgl = useWebglSupport(!prefersReducedMotion)
  const [glReady, setGlReady] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches)
    media.addEventListener('change', handler)

    return () => {
      media.removeEventListener('change', handler)
    }
  }, [])

  const startAnimation = React.useCallback(() => {
    if (prefersReducedMotion || !glStateRef.current) {
      return
    }

    if (animationRef.current) {
      return
    }

    const step = (time: number) => {
      if (!glStateRef.current) {
        animationRef.current = undefined
        return
      }

      if (startTimeRef.current == null) {
        startTimeRef.current = time
      }

      const delta = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0
      lastTimeRef.current = time

      const state = glStateRef.current
      const { gl, program, uniforms } = state

      const target = targetProgressRef.current
      const current = progressRef.current
      const speed = 6
      const diff = target - current
      if (Math.abs(diff) > 0.001) {
        const change = Math.sign(diff) * Math.min(Math.abs(diff), delta * speed)
        progressRef.current = current + change
      } else {
        progressRef.current = target
      }

      if (cursorStateRef.current.active) {
        cursorStateRef.current.value += delta * 2.2
        if (cursorStateRef.current.value >= 1.2) {
          cursorStateRef.current.active = false
        }
      } else if (cursorStateRef.current.value > -0.25) {
        cursorStateRef.current.value = Math.max(-0.25, cursorStateRef.current.value - delta * 1.5)
      }

      gl.useProgram(program)

      if (uniforms.progress) {
        gl.uniform1f(uniforms.progress, progressRef.current)
      }

      if (uniforms.cursor) {
        gl.uniform1f(
          uniforms.cursor,
          cursorStateRef.current.active ? cursorStateRef.current.value : Math.max(cursorStateRef.current.value, -0.25),
        )
      }

      if (uniforms.activeColor) {
        gl.uniform3f(uniforms.activeColor, activeColor[0], activeColor[1], activeColor[2])
      }

      if (uniforms.inactiveColor) {
        gl.uniform3f(uniforms.inactiveColor, INACTIVE_COLOR[0], INACTIVE_COLOR[1], INACTIVE_COLOR[2])
      }

      if (uniforms.time && startTimeRef.current != null) {
        gl.uniform1f(uniforms.time, (time - startTimeRef.current) / 1000)
      }

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      if (
        Math.abs(targetProgressRef.current - progressRef.current) <= 0.001 &&
        !cursorStateRef.current.active &&
        cursorStateRef.current.value <= -0.25
      ) {
        animationRef.current = undefined
        return
      }

      animationRef.current = requestAnimationFrame(step)
    }

    animationRef.current = requestAnimationFrame(step)
  }, [activeColor, prefersReducedMotion])

  React.useEffect(() => {
    targetProgressRef.current = on ? 1 : 0
    if (!prefersReducedMotion && glStateRef.current) {
      startAnimation()
    }
  }, [on, prefersReducedMotion, startAnimation])

  React.useEffect(() => {
    if (!prefersReducedMotion && glStateRef.current && isNow) {
      cursorStateRef.current = { active: true, value: 0 }
      startAnimation()
    }
  }, [isNow, prefersReducedMotion, startAnimation])

  React.useEffect(() => {
    if (prefersReducedMotion || !supportsWebgl) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = undefined
      }
      if (glStateRef.current) {
        const { gl: currentGl, program: currentProgram, buffers } = glStateRef.current
        currentGl.deleteProgram(currentProgram)
        currentGl.deleteBuffer(buffers.position)
        glStateRef.current = null
      }
      setGlReady(false)
      return
    }

    if (typeof window === 'undefined') {
      setGlReady(false)
      return
    }

    const canvas = canvasRef.current
    const button = buttonRef.current
    if (!canvas || !button) {
      setGlReady(false)
      return
    }

    const gl = canvas.getContext('webgl', {
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    })

    if (!gl || typeof (gl as WebGLRenderingContext).createShader !== 'function') {
      setGlReady(false)
      return
    }

    const typedGl = gl as WebGLRenderingContext

    const program = createProgram(typedGl, vertexShaderSource, fragmentShaderSource)
    typedGl.useProgram(program)

    const positionLocation = typedGl.getAttribLocation(program, 'a_position')
    const positionBuffer = typedGl.createBuffer()

    if (!positionBuffer) {
      typedGl.deleteProgram(program)
      setGlReady(false)
      return
    }

    typedGl.bindBuffer(typedGl.ARRAY_BUFFER, positionBuffer)
    typedGl.bufferData(
      typedGl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1,
      ]),
      typedGl.STATIC_DRAW,
    )

    typedGl.enableVertexAttribArray(positionLocation)
    typedGl.vertexAttribPointer(positionLocation, 2, typedGl.FLOAT, false, 0, 0)

    glStateRef.current = {
      gl: typedGl,
      program,
      buffers: {
        position: positionBuffer,
      },
      uniforms: {
        resolution: typedGl.getUniformLocation(program, 'u_resolution'),
        progress: typedGl.getUniformLocation(program, 'u_progress'),
        cursor: typedGl.getUniformLocation(program, 'u_cursor'),
        activeColor: typedGl.getUniformLocation(program, 'u_activeColor'),
        inactiveColor: typedGl.getUniformLocation(program, 'u_inactiveColor'),
        time: typedGl.getUniformLocation(program, 'u_time'),
      },
      attributes: {
        position: positionLocation,
      },
    }

    const resize = () => {
      const rect = button.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const width = Math.max(1, Math.floor(rect.width * dpr))
      const height = Math.max(1, Math.floor(rect.height * dpr))
      canvas.width = width
      canvas.height = height
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      gl.viewport(0, 0, width, height)
      const state = glStateRef.current
      if (state) {
        gl.useProgram(state.program)
        state.uniforms.resolution && gl.uniform2f(state.uniforms.resolution, rect.width, rect.height)
      }
    }

    resize()

    let resizeObserver: ResizeObserver | null = null
    const handleWindowResize = () => resize()

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => resize())
      resizeObserver.observe(button)
    } else {
      window.addEventListener('resize', handleWindowResize)
    }

    setGlReady(true)
    startAnimation()

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect()
      } else {
        window.removeEventListener('resize', handleWindowResize)
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = undefined
      }
      if (glStateRef.current) {
        const { gl: currentGl, program: currentProgram, buffers } = glStateRef.current
        currentGl.deleteProgram(currentProgram)
        currentGl.deleteBuffer(buffers.position)
      }
      glStateRef.current = null
      setGlReady(false)
    }
  }, [prefersReducedMotion, supportsWebgl, startAnimation])

  React.useEffect(() => {
    if (prefersReducedMotion) {
      progressRef.current = on ? 1 : 0
    }
  }, [on, prefersReducedMotion])

  const fallbackStyles = React.useMemo(() => {
    const [r, g, b] = activeColor
    const rgb = `${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}`
    const baseColor = `rgba(${rgb}, ${on ? 0.82 : 0.18})`
    const nowGlow = isNow ? `0 0 18px rgba(${rgb}, 0.55)` : 'none'
    return {
      background: `radial-gradient(circle at 30% 30%, ${baseColor}, rgba(15, 18, 30, 0.95))`,
      boxShadow: nowGlow,
      position: 'relative' as const,
      overflow: 'hidden' as const,
    }
  }, [activeColor, isNow, on])

  const showCanvas = !prefersReducedMotion && glReady

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`relative h-8 overflow-hidden rounded-md border border-white/10 bg-gray-900/70 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary ${
        on ? 'shadow-[0_0_12px_rgba(77,116,255,0.35)]' : ''
      }`}
      style={showCanvas ? undefined : fallbackStyles}
    >
      {showCanvas ? (
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
      ) : (
        <FallbackSweep isNow={isNow} color={activeColor} />
      )}
      {showBarDivider ? (
        <span className="pointer-events-none absolute inset-y-0 left-0 w-px bg-white/10" aria-hidden="true" />
      ) : null}
      <span className="sr-only">{on ? 'Active step' : 'Inactive step'}</span>
    </button>
  )
}

function FallbackSweep({ isNow, color }: { isNow: boolean; color: [number, number, number] }) {
  const sweepStyle = React.useMemo(() => {
    const rgb = `${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}`
    return {
      backgroundImage: `linear-gradient(120deg, rgba(${rgb}, 0.05) 0%, rgba(${rgb}, 0.35) 40%, rgba(${rgb}, 0.6) 50%, rgba(${rgb}, 0.2) 70%, transparent 100%)`,
    }
  }, [color])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.12),transparent_60%),linear-gradient(135deg,rgba(11,16,35,0.8),rgba(6,9,20,0.95))]" />
      <div
        className={`absolute inset-0 ${isNow ? 'animate-[sweep_900ms_ease-out]' : ''}`}
        style={sweepStyle}
      />
      <div className="absolute inset-x-0 top-full h-full -translate-y-1/2 bg-[radial-gradient(circle,rgba(148,163,255,0.22),transparent_70%)] blur-xl" />
      <style>
        {`
          @keyframes sweep {
            0% { transform: translateX(-110%); opacity: 0; }
            15% { opacity: 0.35; }
            60% { opacity: 0.4; }
            100% { transform: translateX(120%); opacity: 0; }
          }
        `}
      </style>
    </div>
  )
}

export function Sequencer() {
  const pattern = useStore(s => s.pattern)
  const pads = useStore(s => s.pads)
  const currentStep = useStore(s => s.currentStep)
  const toggleStep = useStore(s => s.toggleStep)
  const steps = React.useMemo(() => Array.from({ length: pattern.length }, (_, i) => i), [pattern.length])

  return (
    <div className="space-y-2">
      {pads.map(pad => (
        <div
          key={pad.id}
          className="grid items-center gap-1"
          style={{ gridTemplateColumns: `6.5rem repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          <div
            className="flex h-8 items-center justify-end rounded-md border border-white/10 bg-white/5 px-3 text-sm font-medium backdrop-blur"
            style={{ color: pad.color }}
          >
            {pad.name}
          </div>
          {steps.map(stepIndex => {
            const activePads = pattern.steps[stepIndex] || []
            const on = activePads.includes(pad.id)
            const isNow = stepIndex === currentStep
            return (
              <SequencerStepButton
                key={stepIndex}
                on={on}
                isNow={isNow}
                padColor={pad.color}
                showBarDivider={stepIndex % 4 === 0}
                onClick={() => toggleStep(stepIndex, pad.id)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
