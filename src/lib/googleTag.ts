import { GOOGLE_TAG_ID } from '../config'

type GoogleTagParams = Record<string, string | number | boolean | undefined>
type GoogleTagConnection = 'not-configured' | 'loading' | 'connected' | 'error'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const STORAGE_KEY = 'jarvis.googleTagId'
const TAG_ID_PATTERN = /^(?:G|GT|GTM)-[A-Z0-9]+$/i
const scriptPromises = new Map<string, Promise<GoogleTagConnection>>()
const pageViews = new Set<string>()
let activeTagId: string | null = null

export function normaliseGoogleTagId(raw: string): string {
  return raw.trim().toUpperCase()
}

export function isGoogleTagId(raw: string): boolean {
  return TAG_ID_PATTERN.test(normaliseGoogleTagId(raw))
}

export function readGoogleTagId(): string {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)?.trim()
    if (saved && isGoogleTagId(saved)) return normaliseGoogleTagId(saved)
  } catch {
    // Storage can be disabled; the environment value remains available.
  }
  return GOOGLE_TAG_ID
}

export function saveGoogleTagId(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, normaliseGoogleTagId(id))
  } catch {
    // The current session can still use the ID if the browser blocks storage.
  }
}

function dataLayer(): unknown[] {
  window.dataLayer ??= []
  return window.dataLayer
}

function gtag(..._args: unknown[]): void {
  // gtag.js consumes the argument queue in Google's documented format.
  dataLayer().push(arguments)
}

/** Track the initial page without requiring Olho de Deus to be opened. */
export function initialiseGoogleTag(): Promise<GoogleTagConnection> {
  const connection = connectGoogleTag(readGoogleTagId())
  sendGoogleTagEvent('page_view', { page_path: window.location.pathname })
  return connection
}

export function connectGoogleTag(rawId: string): Promise<GoogleTagConnection> {
  const id = normaliseGoogleTagId(rawId)
  if (!id) return Promise.resolve('not-configured')
  if (!isGoogleTagId(id)) return Promise.resolve('error')

  activeTagId = id
  const existing = scriptPromises.get(id)
  if (existing) return existing

  const layer = dataLayer()
  const isTagManager = id.startsWith('GTM-')
  if (isTagManager) {
    layer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  } else {
    window.gtag ??= gtag
    window.gtag('js', new Date())
    window.gtag('config', id, {
      send_page_view: false,
      page_location: `${window.location.origin}${window.location.pathname}`,
      page_referrer: (() => { try { const url = new URL(document.referrer); return url.origin + url.pathname } catch { return '' } })(),
      campaign_source: new URLSearchParams(window.location.search).get('utm_source')?.slice(0, 120),
      campaign_medium: new URLSearchParams(window.location.search).get('utm_medium')?.slice(0, 120),
      campaign_name: new URLSearchParams(window.location.search).get('utm_campaign')?.slice(0, 120),
    })
  }

  const script = document.createElement('script')
  const promise = new Promise<GoogleTagConnection>((resolve) => {
    script.async = true
    script.dataset.jarvisGoogleTag = id
    script.src = isTagManager
      ? `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`
      : `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
    const timer = window.setTimeout(() => resolve('error'), 15_000)
    script.onload = () => { window.clearTimeout(timer); resolve('connected') }
    script.onerror = () => { window.clearTimeout(timer); resolve('error') }
    document.head.append(script)
  })

  scriptPromises.set(id, promise)
  void promise.then((status) => {
    if (status === 'error' && scriptPromises.get(id) === promise) {
      scriptPromises.delete(id)
      script.remove()
      for (const key of pageViews) if (key.startsWith(`${id}|`)) pageViews.delete(key)
    }
  })
  return promise
}

export function sendGoogleTagEvent(name: string, params: GoogleTagParams = {}): void {
  if (!activeTagId) return
  if (name === 'page_view') {
    const key = `${activeTagId}|${window.location.pathname}`
    if (pageViews.has(key)) return
    pageViews.add(key)
  }

  const safeParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  )
  if (activeTagId.startsWith('GTM-')) {
    dataLayer().push({ event: name, ...safeParams })
  } else {
    window.gtag?.('event', name, { ...safeParams, send_to: activeTagId,
      page_location: `${window.location.origin}${window.location.pathname}` })
  }
}

export function pauseGoogleTagEvents(): void {
  activeTagId = null
}
