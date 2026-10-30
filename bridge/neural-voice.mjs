import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const portablePython = fileURLToPath(new URL('../runtime/python/python.exe', import.meta.url))
const python = existsSync(portablePython) ? portablePython : fileURLToPath(new URL(process.platform === 'win32' ? '../.venv-voice/Scripts/python.exe' : '../.venv-voice/bin/python', import.meta.url))
const script = fileURLToPath(new URL('../scripts/neural-voice.py', import.meta.url))
export const neuralVoiceAvailable = () => existsSync(python)
let concurrent = 0

export async function neuralSpeech(text, signal) {
  if (!neuralVoiceAvailable() || concurrent >= 4) throw new Error('Neural voice unavailable')
  concurrent += 1
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(python, [script], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
      const chunks = []
      let bytes = 0, settled = false
      const finish = (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
        if (error) { child.kill(); reject(error) } else resolve(Buffer.concat(chunks))
      }
      const abort = () => finish(new Error('Speech cancelled'))
      const timer = setTimeout(() => finish(new Error('Neural voice timed out')), 12_000)
      signal?.addEventListener('abort', abort, { once: true })
      child.stdout.on('data', (chunk) => {
        bytes += chunk.length
        if (bytes > 4 * 1024 * 1024) return finish(new Error('Audio too large'))
        chunks.push(chunk)
      })
      // Drain stderr without logging sentences or upstream details.
      child.stderr.on('data', () => {})
      child.on('error', () => finish(new Error('Neural voice could not start')))
      child.on('close', (code) => finish(code === 0 && bytes > 0 ? null : new Error('Neural voice returned no audio')))
      child.stdin.on('error', () => finish(new Error('Neural voice input failed')))
      if (signal?.aborted) return abort()
      child.stdin.end(JSON.stringify({ text }))
    })
  } finally { concurrent -= 1 }
}
