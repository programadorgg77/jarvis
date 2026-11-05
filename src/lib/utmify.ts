import { useSyncExternalStore } from 'react'

// Decoded from the user's supplied loader. Keep the official URL and its flags.
export const UTMIFY_SCRIPT_URL = 'https://cdn.utmify.com.br/scripts/utms/latest.js'
type Status = 'idle' | 'loading' | 'loaded' | 'error'
let status: Status = 'idle'
let pending: Promise<Status> | null = null
const listeners = new Set<() => void>()
const publish = (value: Status) => { status = value; listeners.forEach((fn) => fn()) }
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const useUtmifyStatus = () => useSyncExternalStore(subscribe, () => status, () => 'idle' as Status)

/** Attribution propagation only; this vendor script does not supply visitor geolocation. */
export function connectUtmify(): Promise<Status> {
  if (pending) return pending
  publish('loading')
  pending = new Promise<Status>((resolve) => {
    const script = document.createElement('script')
    script.src = UTMIFY_SCRIPT_URL
    script.async = true
    script.defer = true
    script.id = 'jarvis-utmify-attribution'
    for (const name of ['data-utmify-prevent-xcod-sck', 'data-utmify-prevent-subids', 'data-utmify-is-stripe']) script.setAttribute(name, '')
    // The assistant's chat/configuration forms and proxied content aren't checkout pages.
    script.setAttribute('data-utmify-ignore-classes', 'jarvis-internal')
    script.setAttribute('data-utmify-ignore-iframe', '')
    let finished = false
    const finish = (next: Status) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      publish(next)
      resolve(next)
    }
    const timer = setTimeout(() => finish('error'), 15_000)
    script.onload = () => finish('loaded')
    script.onerror = () => finish('error')
    document.head.append(script)
  })
  return pending
}

export function readUtmAttribution() {
  const params = new URLSearchParams(window.location.search)
  const read = (name: string) => {
    const current = params.get(name)
    if (current && current !== 'undefined' && current !== 'null') return current.split('jLj')[0].slice(0, 120)
    try {
      const value = localStorage.getItem(name)
      const expires = Date.parse(localStorage.getItem(`${name}_exp`) ?? '')
      if (value && Number.isFinite(expires) && expires > Date.now()) return value.split('jLj')[0].slice(0, 120)
    } catch { /* URL attribution still works with browser storage disabled. */ }
    return ''
  }
  return { source: read('utm_source'), campaign: read('utm_campaign'), medium: read('utm_medium') }
}

/** Exclude private operational forms before the vendor's load/mutation callbacks run. */
export function protectJarvisForms(root: Element): () => void {
  const mark = () => root.querySelectorAll('form,a').forEach((element) => element.classList.add('jarvis-internal'))
  mark()
  const observer = new MutationObserver(mark)
  observer.observe(root, { childList: true, subtree: true })
  return () => observer.disconnect()
}
