import { useEffect, useState } from 'react'
import { BRIDGE_HTTP_URL } from '../config'

export type VisitorRegion = { id: string; name: string; lat: number; lng: number; activeUsers: number; cities: string[] }
export type AnalyticsConfig = { propertyId: string; siteUrl: string; pageTitle: string; measurementId: string; credentialReady: boolean; readerEmail: string | null }
export type AnalyticsSnapshot = {
  status: 'setup' | 'connected' | 'error'
  message: string
  config: AnalyticsConfig
  fetchedAt: number | null
  windowMinutes: number
  activeUsers: number | null
  eventCount: number | null
  pageViews: number | null
  unlocated: number
  regions: VisitorRegion[]
  pages: { title: string; activeUsers: number }[]
}

export async function saveAnalyticsConfig(config: Omit<AnalyticsConfig, 'credentialReady' | 'readerEmail'>) {
  const response = await fetch(`${BRIDGE_HTTP_URL}/analytics/config`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(config), signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error('Não foi possível salvar. Confira o ID numérico da propriedade e a URL.')
}

export function useLiveAnalytics(active: boolean, revision: number) {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!active) return
    let stopped = false
    let timer: number | undefined
    let controller: AbortController | undefined
    setSnapshot(null)
    const poll = async () => {
      if (document.visibilityState === 'hidden') { timer = window.setTimeout(poll, 15_000); return }
      controller = new AbortController()
      try {
        const response = await fetch(`${BRIDGE_HTTP_URL}/analytics/realtime`, { credentials: 'same-origin', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]) })
        if (!response.ok) throw new Error()
        const data = await response.json() as AnalyticsSnapshot
        if (!stopped) { setSnapshot(data); setError(null) }
      } catch {
        if (!stopped) setError('Sem atualização do servidor. Os indicadores de presença estão pausados.')
      } finally {
        if (!stopped) timer = window.setTimeout(poll, 15_000)
      }
    }
    void poll()
    return () => { stopped = true; controller?.abort(); window.clearTimeout(timer) }
  }, [active, revision])
  return { snapshot, error }
}
