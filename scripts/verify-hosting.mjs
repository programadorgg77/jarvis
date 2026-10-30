import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { WebSocket } from 'ws'

const profile = await mkdtemp(join(tmpdir(), 'jarvis-hosted-test-'))
const probe = createServer()
await new Promise((done) => probe.listen(0, '127.0.0.1', done))
const port = probe.address().port
await new Promise((done) => probe.close(done))
const url = `http://127.0.0.1:${port}`
const origin = 'https://jarvis-test.example'
const password = 'verification-only-password-2026'
const env = { ...process.env, USERPROFILE: profile, HOME: profile, CLAUDE_CONFIG_DIR: join(profile, '.claude'),
  JARVIS_DEPLOY: '1', PORT: String(port), RAILWAY_PUBLIC_DOMAIN: 'jarvis-test.example',
  JARVIS_ACCESS_USER: 'testuser', JARVIS_ACCESS_PASSWORD: password,
  UTMIFY_MCP_URL: 'https://mcp.utmify.com.br/mcp/?token=verification-not-a-real-token&resources=gs,gm,gu',
}
for (const key of Object.keys(env)) if (/ANTHROPIC|TYPESAFE|ELEVENLABS|CLAUDE_CODE_OAUTH|JARVIS_PUBLIC_URL/i.test(key)) delete env[key]
const server = spawn(process.execPath, ['bridge/server.mjs'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
let logs = ''
server.stdout.on('data', (part) => { logs += part })
server.stderr.on('data', (part) => { logs += part })
async function socketStatus(cookie, socketOrigin) {
  return new Promise((done, reject) => {
    const ws = new WebSocket(url.replace('http:', 'ws:'), { origin: socketOrigin,
      headers: cookie ? { cookie } : {}, handshakeTimeout: 5000 })
    ws.on('message', (data) => {
      const frame = JSON.parse(String(data))
      if (frame.type === 'ready') { ws.close(); done({ code: 101, frame }) }
    })
    ws.on('unexpected-response', (_req, res) => { res.resume(); ws.terminate(); done({ code: res.statusCode }) })
    ws.on('error', (error) => { if (!error.message.includes('closed before')) reject(error) })
  })
}
try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${url}/ready`)).ok) { ready = true; break } } catch { /* starting */ }
    if (server.exitCode !== null) throw new Error('Hosted server exited before readiness')
    await new Promise((done) => setTimeout(done, 150))
  }
  assert.ok(ready)
  assert.deepEqual(await (await fetch(`${url}/ready`)).json(), { ok: true })
  const loginPage = await fetch(`${url}/login`)
  assert.equal(loginPage.headers.get('referrer-policy'), 'same-origin', 'HTML form submissions must retain the same-site Origin header')
  assert.equal((await fetch(`${url}/health`)).status, 401)
  assert.equal((await fetch(`${url}/tts`, { method: 'POST' })).status, 401)
  assert.equal((await socketStatus(null, origin)).code, 401)
  const nullOrigin = await fetch(`${url}/login`, { method: 'POST', headers: {
    origin: 'null', 'content-type': 'application/x-www-form-urlencoded',
  }, body: new URLSearchParams({ username: 'testuser', password }) })
  assert.equal(nullOrigin.status, 403, 'Opaque origins are still rejected')
  const login = await fetch(`${url}/login`, { method: 'POST', redirect: 'manual', headers: {
    origin, 'content-type': 'application/x-www-form-urlencoded',
  }, body: new URLSearchParams({ username: 'testuser', password }) })
  assert.equal(login.status, 303)
  const cookie = login.headers.get('set-cookie').split(';')[0]
  const html = await (await fetch(url, { headers: { cookie, origin } })).text()
  assert.match(html, /J\.A\.R\.V\.I\.S/)
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)) {
    assert.equal((await fetch(url + match[1], { headers: { cookie, origin } })).status, 200)
  }
  assert.equal((await fetch(`${url}/health`, { headers: { cookie, origin: 'https://wrong.example' } })).status, 403)
  const health = await (await fetch(`${url}/health`, { headers: { cookie, origin } })).json()
  assert.equal(health.jev.configured, false, 'Deployed mode never reads the workstation Jev file')
  const accepted = await socketStatus(cookie, origin)
  assert.equal(accepted.code, 101)
  assert.ok(accepted.frame.servers.includes('utmify'))
  assert.ok(!JSON.stringify(accepted.frame).includes('verification-not-a-real-token'))
  assert.equal((await socketStatus(cookie, 'https://wrong.example')).code, 403)
  for (const path of ['/.env', '/.claude.json', '/bridge/server.mjs']) {
    assert.equal((await fetch(url + path, { headers: { cookie, origin } })).status, 404)
  }
  assert.ok(!logs.includes(password))
  assert.ok(!logs.includes('verification-not-a-real-token'))
  console.log('PASS: hosted bridge readiness, protected UI/API, login, cookies and WS origin/session checks')
  console.log('PASS: environment-based UTMify discovered; credentials absent from ready frames and logs')
} finally {
  server.kill()
  await new Promise((done) => { if (server.exitCode !== null) done(); else server.once('exit', done) })
}
