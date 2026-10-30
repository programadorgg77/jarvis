import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
process.chdir(root)
if (!existsSync(join(root, 'dist/index.html'))) {
  console.error('Extraia a pasta inteira do ZIP antes de abrir o Jarvis.')
  process.exit(1)
}

async function freePort() {
  for (let port = 8787; port <= 8817; port++) {
    const free = await new Promise((resolve) => {
      const probe = createServer()
      probe.once('error', () => resolve(false))
      probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)))
    })
    if (free) return port
  }
  throw new Error('Nao ha uma porta local disponivel. Feche outras instancias do Jarvis.')
}

function openBrowser(url) {
  const edge = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA]
    .filter(Boolean).map((base) => join(base, 'Microsoft/Edge/Application/msedge.exe'))
    .find(existsSync)
  const browser = edge ? spawn(edge, [url], { detached: true, stdio: 'ignore', windowsHide: true })
    : spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore', windowsHide: true })
  browser.on('error', () => console.log(`Abra este endereco no Edge ou Chrome: ${url}`))
  browser.unref()
}

const port = await freePort()
const url = `http://127.0.0.1:${port}`
const child = spawn(process.execPath, [join(root, 'bridge/server.mjs')], {
  cwd: root, windowsHide: true, stdio: 'inherit',
  env: { ...process.env, PATH: `${dirname(process.execPath)};${process.env.PATH ?? ''}`,
    JARVIS_SERVE_LOCAL: '1', JARVIS_BRIDGE_PORT: String(port), JARVIS_ALLOW_WRITES: '0',
    JARVIS_ALLOWED_ORIGINS: `${url},http://localhost:${port}` },
})
let stopping = false
const stop = () => {
  if (stopping) return
  stopping = true
  child.kill()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
child.on('error', () => {
  console.error('O motor local nao iniciou. Extraia novamente o ZIP completo.')
  process.exitCode = 1
})
child.on('exit', (code) => { process.exitCode = stopping ? 0 : (code ?? 1) })

try {
  let ready = false
  for (let attempt = 0; attempt < 100 && child.exitCode === null && !stopping; attempt++) {
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(500) })
      if (response.ok && (await response.json()).ok) { ready = true; break }
    } catch { /* The bridge is still loading its dependencies. */ }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  if (!ready) throw new Error('O Jarvis nao iniciou. Confira a mensagem acima e tente novamente.')
  console.log(`\nJARVIS ABERTO EM ${url}`)
  console.log('Mantenha esta janela aberta. Para encerrar, pressione Ctrl+C.')
  console.log('Primeiro uso: conecte sua conta em Conectar Claude.cmd e permita o microfone no navegador.\n')
  if (!process.argv.includes('--no-open')) openBrowser(url)
} catch (error) {
  console.error(error.message)
  stop()
  process.exitCode = 1
}
