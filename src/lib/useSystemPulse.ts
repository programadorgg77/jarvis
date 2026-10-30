import { useEffect, useState } from 'react'
import { BRIDGE_HTTP_URL } from '../config'
import { diag } from './voice'

export type SystemPulse = { online: boolean | null; latency: number | null; microphone: boolean; engine: string }

/** Service RTT and actual recognizer state, rather than decorative statistics. */
export function useSystemPulse(): SystemPulse {
  const [pulse, setPulse] = useState<SystemPulse>({ online: null, latency: null, microphone: false, engine: 'EM ESPERA' })
  useEffect(() => {
    const controller = new AbortController()
    let probing = false
    const probe = async () => {
      if (probing) return
      probing = true
      const start = performance.now()
      try {
        const response = await fetch(`${BRIDGE_HTTP_URL}/health`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(4000)]), cache: 'no-store' })
        const health = response.ok ? await response.json() : null
        if (!controller.signal.aborted) setPulse((old) => ({ ...old, online: Boolean(health?.ok), latency: health?.ok ? Math.round(performance.now() - start) : null }))
      } catch { if (!controller.signal.aborted) setPulse((old) => ({ ...old, online: false, latency: null })) }
      finally { probing = false }
    }
    void probe()
    const ping = window.setInterval(() => void probe(), 15_000)
    const voice = window.setInterval(() => setPulse((old) => ({ ...old, microphone: diag.running && !['network', 'not-allowed', 'service-not-allowed', 'unsupported', 'mic'].includes(diag.lastError), engine: diag.running ? diag.engine === 'elevenlabs' ? 'SCRIBE' : 'NAVEGADOR' : 'EM ESPERA' })), 1000)
    return () => { controller.abort(); clearInterval(ping); clearInterval(voice) }
  }, [])
  return pulse
}
