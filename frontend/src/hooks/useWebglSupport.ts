import { useEffect, useState } from 'react'

function isTestEnvironment() {
  try {
    return typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test'
  } catch {
    return false
  }
}

export function useWebglSupport(enabled: boolean) {
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || isTestEnvironment()) {
      setSupported(false)
      return
    }

    let cancelled = false
    let detected = false

    try {
      const canvas = document.createElement('canvas')
      const context =
        typeof canvas.getContext === 'function'
          ? canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')
          : null

      if (context && typeof (context as WebGLRenderingContext).getExtension === 'function') {
        detected = true
        ;(context as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext()
      }
    } catch {
      detected = false
    }

    if (!cancelled) {
      setSupported(detected)
    }

    return () => {
      cancelled = true
    }
  }, [enabled])

  return enabled ? supported : false
}

