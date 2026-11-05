import assert from 'node:assert/strict'
import { test } from 'node:test'

test('clear requests are routed without an upstream classifier and cancellation is preserved', async () => {
  const { prepareWithJev, localRoute } = await import('./jev.mjs')
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('Network must not be needed') }
  try {
    const result = await prepareWithJev('Qual foi o lucro de hoje?')
    assert.match(result, /mcp__jarvis_sales__get_sales_summary/)
    assert.equal(calls, 0)
    assert.equal(await prepareWithJev('Bom dia!'), 'Bom dia!')
    assert.equal(localRoute('Analise as campanhas no Meta Ads'), 'ads')
    const cancelled = new AbortController(); cancelled.abort()
    assert.equal(await prepareWithJev('Qual foi o lucro de hoje?', cancelled.signal), 'Qual foi o lucro de hoje?')
  } finally { globalThis.fetch = original }
})

test('optional upstream routing is bounded and falls back to the original request', async () => {
  const previous = Object.fromEntries(['TYPESAFE_API_KEY', 'JARVIS_JEV_ENABLED', 'JARVIS_ROUTING_BUDGET_MS'].map((key) => [key, process.env[key]]))
  const original = globalThis.fetch
  process.env.TYPESAFE_API_KEY = 'unit-test-no-real-credential'
  process.env.JARVIS_JEV_ENABLED = '1'
  process.env.JARVIS_ROUTING_BUDGET_MS = '150'
  globalThis.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
  // A keepalive is required: AbortSignal.timeout itself is unref'ed in Node.
  const keepalive = setInterval(() => {}, 1000)
  try {
    const { prepareWithJev } = await import(`./jev.mjs?test=${Date.now()}`)
    const start = performance.now()
    assert.equal(await prepareWithJev('O que você acha dessa ideia?'), 'O que você acha dessa ideia?')
    assert.ok(performance.now() - start < 900, 'Optional routing must not consume the old 1.8-second budget')
  } finally {
    clearInterval(keepalive)
    globalThis.fetch = original
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
  }
})
