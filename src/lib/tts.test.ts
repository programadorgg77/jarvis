import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer } from 'vite'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tick = () => new Promise<void>((done) => setImmediate(done))
const requests: Array<{ text: string; signal?: AbortSignal; finish: () => void }> = []
const audio: FakeAudio[] = []
const revoked: string[] = []
let sequence = 0
const blobs = new WeakMap<Blob, string>()
const urls = new Map<string, string>()
let cloudEnabled = true
let audioStarts = true
let pauseEvent = true
const nativeUtterances: FakeUtterance[] = []
class FakeUtterance {
  text: string
  onend: (() => void) | null = null
  constructor(text: string) { this.text = text }
}
class FakeAudio {
  onplaying: (() => void) | null = null
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  onpause: (() => void) | null = null
  text: string
  constructor(url: string) { this.text = urls.get(url) ?? ''; audio.push(this) }
  play() { if (audioStarts) queueMicrotask(() => this.onplaying?.()); return Promise.resolve() }
  pause() { if (pauseEvent) this.onpause?.() }
  finish() { this.onended?.() }
}
const saved = new Map<string, PropertyDescriptor | undefined>()
function replaceGlobal(name: string, value: unknown) {
  saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
}
let vite: Awaited<ReturnType<typeof createServer>>
let tts: typeof import('./tts')
let probeCapabilities: () => Promise<unknown>
const originalCreate = URL.createObjectURL
const originalRevoke = URL.revokeObjectURL
before(async () => {
  replaceGlobal('window', { location: { protocol: 'http:', host: 'localhost:5173' } })
  replaceGlobal('speechSynthesis', { getVoices: () => [], addEventListener() {}, resume() {}, cancel() {}, speak(item: FakeUtterance) { nativeUtterances.push(item) } })
  replaceGlobal('SpeechSynthesisUtterance', FakeUtterance)
  replaceGlobal('Audio', FakeAudio)
  replaceGlobal('requestAnimationFrame', () => 1)
  replaceGlobal('cancelAnimationFrame', () => {})
  replaceGlobal('fetch', async (input: string, options?: RequestInit) => {
    if (String(input).endsWith('/health')) return { ok: true, json: async () => ({ tts: cloudEnabled, stt: false, voiceEngine: 'edge' }) }
    assert.ok(String(input).endsWith('/tts'))
    const text = JSON.parse(String(options?.body)).text as string
    return new Promise((resolve) => requests.push({ text, signal: options?.signal ?? undefined,
      finish: () => resolve({ ok: true, blob: async () => { const blob = new Blob([text]); blobs.set(blob, text); return blob } }),
    }))
  })
  URL.createObjectURL = (blob) => { const url = `blob:test-${++sequence}`; urls.set(url, blob instanceof Blob ? blobs.get(blob) ?? '' : ''); return url }
  URL.revokeObjectURL = (url) => { revoked.push(url) }
  vite = await createServer({ configFile: false, cacheDir: mkdtempSync(join(tmpdir(), 'jarvis-tts-test-')),
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null }, appType: 'custom' })
  const capabilities = await vite.ssrLoadModule('/src/lib/capabilities.ts')
  probeCapabilities = capabilities.probeCapabilities
  await capabilities.probeCapabilities()
  tts = await vite.ssrLoadModule('/src/lib/tts.ts') as typeof tts
})
beforeEach(async () => {
  requests.length = 0; audio.length = 0; revoked.length = 0; nativeUtterances.length = 0
  cloudEnabled = true; audioStarts = true; pauseEvent = true
  await probeCapabilities()
})
after(async () => {
  await vite?.close()
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
  URL.createObjectURL = originalCreate
  URL.revokeObjectURL = originalRevoke
})

test('prepares a streamed second sentence while the first sentence is playing, without replaying either', async () => {
  const speaker = tts.createSpeaker()
  try {
    speaker.push('Primeira frase. ')
    await tick()
    requests[0].finish()
    await tick()
    assert.equal(audio.length, 1)
    speaker.push('Segunda frase. ')
    await tick()
    assert.equal(requests.length, 2, 'Next audio must start preparing before the current audio ends')
    requests[1].finish()
    await tick()
    audio[0].finish()
    await tick()
    assert.deepEqual(audio.map((item) => item.text), ['Primeira frase.', 'Segunda frase.'])
    audio[1].finish()
    await speaker.end()
  } finally { speaker.cancel() }
})

test('cancels unfinished synthesis and disposes late audio instead of leaving requests or URLs behind', async () => {
  const speaker = tts.createSpeaker()
  speaker.push('Uma frase pendente. ')
  await tick()
  speaker.cancel()
  assert.equal(requests[0].signal?.aborted, true, 'Cancelling the answer must abort its audio request')
  requests[0].finish()
  await tick()
  assert.equal(audio.length, 0)
  assert.equal(revoked.length, 1, 'Late synthesis output must be released')
  await speaker.end()
})

test('a playback resume does not announce the same sentence as a new speech start', async () => {
  let starts = 0
  const speaker = tts.createSpeaker({ onStart: () => { starts++ } })
  try {
    speaker.push('Fala contínua. ')
    await tick()
    requests[0].finish()
    await tick()
    audio[0].onplaying?.()
    assert.equal(starts, 1)
    audio[0].finish()
    await speaker.end()
  } finally { speaker.cancel() }
})

test('Portuguese titles with several dots stay in a single spoken sentence', async () => {
  const speaker = tts.createSpeaker()
  try {
    speaker.push('Sr. Dr. João verificou o faturamento. ')
    await tick()
    assert.deepEqual(requests.map((item) => item.text), ['Sr. Dr. João verificou o faturamento.'])
    requests[0].finish()
    await tick()
    audio[0].finish()
    await speaker.end()
  } finally {
    speaker.cancel()
    for (const request of requests) request.finish()
    await tick()
  }
})

test('lookahead remains bounded and cancellation releases already prepared clips', async () => {
  const speaker = tts.createSpeaker()
  speaker.push('Primeira frase. Segunda frase. Terceira frase. Quarta frase. ')
  await tick()
  assert.equal(requests.length, 2, 'Only the current and next clip may be generated')
  requests[0].finish()
  requests[1].finish()
  await tick()
  assert.equal(audio.length, 1)
  speaker.cancel()
  await tick()
  assert.equal(revoked.length, 2)
  await speaker.end()
})

test('cancelling before system voice starts cannot resurrect the old sentence on its retry timer', async () => {
  cloudEnabled = false
  await probeCapabilities()
  const speaker = tts.createSpeaker()
  try {
    speaker.push('Uma fala interrompida antes de começar. ')
    await tick()
    assert.equal(nativeUtterances.length, 1)
    speaker.cancel()
    await new Promise((done) => setTimeout(done, 850))
    assert.equal(nativeUtterances.length, 1, 'A cancelled native voice must not be spoken again')
  } finally {
    speaker.cancel()
    for (const utterance of nativeUtterances) utterance.onend?.()
  }
})

test('cancellation releases an audio clip even when a not-yet-playing element emits no pause event', async () => {
  audioStarts = false
  pauseEvent = false
  const speaker = tts.createSpeaker()
  speaker.push('Ainda aguardando o início do áudio. ')
  await tick()
  requests[0].finish()
  await tick()
  assert.equal(audio.length, 1)
  speaker.cancel()
  assert.equal(revoked.length, 1, 'Playback cleanup must not depend on a browser pause callback')
  audio[0].finish()
  await speaker.end()
})

test('microphone self-echo guard starts with actual playback, not while waiting for synthesis', async () => {
  const speaker = tts.createSpeaker()
  try {
    speaker.push('Uma resposta começando a tocar. ')
    await tick()
    assert.equal(tts.speakingSince(), 0)
    requests[0].finish()
    await tick()
    assert.ok(tts.speakingSince() > 0)
    audio[0].finish()
    await speaker.end()
  } finally {
    speaker.cancel()
    for (const request of requests) request.finish()
  }
})

test('starts synthesis at a natural opening clause before the full answer is streamed', async () => {
  const speaker = tts.createSpeaker()
  try {
    speaker.push('O desempenho das campanhas melhorou durante esta semana, e vou detalhar os resultados')
    await tick()
    assert.deepEqual(requests.map((item) => item.text), ['O desempenho das campanhas melhorou durante esta semana,'])
    speaker.push(' por produto. ')
    await tick()
    assert.equal(requests[1]?.text, 'e vou detalhar os resultados por produto.')
  } finally {
    speaker.cancel()
    for (const request of requests) request.finish()
    await tick()
  }
})

test('decimal commas do not split a financial amount into separate speech clips', async () => {
  const speaker = tts.createSpeaker()
  try {
    speaker.push('O faturamento confirmado no período informado foi de R$ 1.234,56 com todos os pedidos aprovados')
    await tick()
    assert.equal(requests.length, 0)
    speaker.push('. ')
    await tick()
    assert.equal(requests.length, 1)
    assert.ok(requests[0].text.includes('R$ 1.234,56'))
  } finally {
    speaker.cancel()
    for (const request of requests) request.finish()
    await tick()
  }
})
