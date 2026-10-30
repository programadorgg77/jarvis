import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { WebSocket } from 'ws'

const root = resolve(process.argv[2] ?? '')
assert.ok(existsSync(join(root, 'runtime/node.exe')), 'Pass the extracted portable folder')
const profile = join(root, '..', 'empty-test-profile')
await mkdir(profile, { recursive: true })
const env = { ...process.env, USERPROFILE: profile, HOME: profile,
  APPDATA: join(profile, 'AppData/Roaming'), LOCALAPPDATA: join(profile, 'AppData/Local'),
  CLAUDE_CONFIG_DIR: join(profile, '.claude'), PYTHONDONTWRITEBYTECODE: '1',
  PATH: join(process.env.SystemRoot ?? 'C:\\Windows', 'System32'),
}
for (const key of Object.keys(env)) {
  if (/ANTHROPIC|TYPESAFE|ELEVENLABS|CLAUDE_CODE_OAUTH|JARVIS_|VITE_/i.test(key)) delete env[key]
}
const child = spawn(join(root, 'runtime/node.exe'), [join(root, 'scripts/start-portable.mjs'), '--no-open'], {
  cwd: profile, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
})
let logs = ''
child.stdout.on('data', (data) => { logs += data })
child.stderr.on('data', (data) => { logs += data })
try {
  let url
  for (let i = 0; i < 150; i++) {
    url = logs.match(/JARVIS ABERTO EM (http:\/\/127\.0\.0\.1:\d+)/)?.[1]
    if (url) break
    if (child.exitCode !== null) throw new Error('Portable launcher exited before readiness')
    await new Promise((done) => setTimeout(done, 200))
  }
  assert.ok(url, 'Portable launcher becomes ready')
  const health = await (await fetch(`${url}/health`)).json()
  assert.equal(health.ok, true)
  assert.equal(health.voiceEngine, 'edge')
  assert.equal(health.jev.configured, false, 'No original Jev credentials')
  const html = await (await fetch(url)).text()
  assert.match(html, /J\.A\.R\.V\.I\.S\./)
  for (const asset of [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map((m) => m[1])) {
    assert.equal((await fetch(`${url}${asset}`, { method: 'HEAD' })).status, 200, asset)
  }
  for (const path of ['/.claude.json', '/.env', '/bridge/server.mjs', '/package.json']) {
    assert.equal((await fetch(`${url}${path}`)).status, 404, path)
  }
  assert.equal((await fetch(`${url}/health`, { headers: { origin: 'https://unrelated.example' } })).status, 403)
  await new Promise((done, reject) => {
    const ws = new WebSocket(url.replace('http:', 'ws:'), { origin: url, handshakeTimeout: 5000 })
    ws.on('open', () => { ws.close(); done() })
    ws.on('error', reject)
  })
  await new Promise((done, reject) => {
    const ws = new WebSocket(url.replace('http:', 'ws:'), { origin: 'https://unrelated.example', handshakeTimeout: 5000 })
    ws.on('open', () => { ws.close(); reject(new Error('Unrelated origin was accepted')) })
    ws.on('unexpected-response', (_req, res) => { res.resume(); ws.terminate(); assert.equal(res.statusCode, 403); done() })
    ws.on('error', () => {})
  })
  // Verify the bundled native CLI sees an empty profile, without logging in.
  const status = await new Promise((done, reject) => {
    execFile(join(root, 'node_modules/@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe'), ['auth', 'status'],
      { cwd: profile, env, windowsHide: true, timeout: 20000 }, (error, stdout) => {
        if (error?.killed) return reject(error)
        try { done(JSON.parse(stdout)) } catch { reject(new Error('Claude auth status did not return JSON')) }
      })
  })
  assert.equal(status.loggedIn, false, 'The original Claude login was not included')
  const audio = await fetch(`${url}/tts`, { method: 'POST', headers: { 'content-type': 'application/json', origin: url },
    body: JSON.stringify({ text: 'Jarvis pronto para conversar em português.' }), signal: AbortSignal.timeout(18000) })
  assert.equal(audio.status, 200, 'Bundled Portuguese voice generates audio')
  assert.match(audio.headers.get('content-type'), /audio/)
  assert.ok((await audio.arrayBuffer()).byteLength > 1000)
  const config = await readFile(join(root, 'runtime/python/python314._pth'), 'utf8')
  assert.ok(!config.includes('Mathias'))
  console.log('PASS: extracted portable launch with no Node/Python in PATH and an empty user profile')
  console.log(`PASS: dashboard, compiled assets, WebSocket, origin guards and Portuguese audio (${url})`)
  console.log('PASS: bundled Claude CLI runs; no original Claude or Jev account included')
} finally {
  // Stop only this test process and its own backend; Windows does not cascade
  // child.kill() to descendants. No existing Jarvis instance is touched.
  if (child.exitCode === null) await new Promise((done) => execFile(
    join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/taskkill.exe'),
    ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => done(),
  ))
}
