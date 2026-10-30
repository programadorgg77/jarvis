import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WebSocket } from 'ws'

const base = new URL(process.argv[2]).origin
assert.equal(new URL(base).protocol, 'https:')
const access = JSON.parse(readFileSync('output/render/access.local', 'utf8'))
const request = (path, options = {}) => fetch(`${base}${path}`, { ...options, signal: AbortSignal.timeout(20000) })
assert.deepEqual(await (await request('/ready')).json(), { ok: true })
assert.equal((await request('/health')).status, 401)
assert.equal((await request('/login')).headers.get('referrer-policy'), 'same-origin')
const login = await request('/login', { method: 'POST', redirect: 'manual',
  headers: { origin: base, 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ username: access.username, password: access.password }),
})
assert.equal(login.status, 303)
const sessionCookie = login.headers.get('set-cookie')
assert.match(sessionCookie, /HttpOnly/)
assert.match(sessionCookie, /Secure/)
const cookie = sessionCookie.split(';')[0]
const headers = { cookie, origin: base }
const health = await (await request('/health', { headers })).json()
assert.equal(health.ok, true)
const html = await (await request('/', { headers })).text()
assert.match(html, /J\.A\.R\.V\.I\.S\./)
for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)) {
  assert.equal((await request(match[1], { method: 'HEAD', headers })).status, 200)
}
const ready = await new Promise((resolve, reject) => {
  const ws = new WebSocket(base.replace('https:', 'wss:'), { origin: base, headers: { cookie }, handshakeTimeout: 10000 })
  const timer = setTimeout(() => { ws.terminate(); reject(new Error('No ready frame')) }, 15000)
  ws.on('message', (data) => {
    const frame = JSON.parse(String(data))
    if (frame.type === 'ready') { clearTimeout(timer); ws.close(); resolve(frame) }
  })
  ws.on('error', (error) => { clearTimeout(timer); reject(error) })
})
let voice = 'browser fallback'
if (process.argv.includes('--utmify')) assert.ok(ready.servers.includes('utmify'), 'Hosted UTMify configuration is active')
if (health.tts) {
  const audio = await request('/tts', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Jarvis pronto para conversar em português.' }) })
  if (audio.ok && (audio.headers.get('content-type') ?? '').includes('audio') && (await audio.arrayBuffer()).byteLength > 1000) voice = 'neural audio generated'
}
await request('/logout', { method: 'POST', redirect: 'manual', headers })
assert.equal((await request('/health', { headers })).status, 401)
console.log(JSON.stringify({ url: base, readiness: 'PASS', loginAndLogout: 'PASS', protectedDashboardAndAssets: 'PASS',
  secureWebSocket: 'PASS', voice, configuredIntegrations: ready.servers, claudeModelResponse: 'not tested; friend credential pending' }))
