import { createInterface } from 'node:readline/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const input = createInterface({ input: process.stdin, output: process.stdout })
console.log('Na UTMify, crie um token MCP e copie a URL completa de conexao.')
console.log('A URL sera salva somente na configuracao local do Claude deste Windows.')
try {
  const value = (await input.question('Cole sua URL MCP da UTMify: ')).trim()
  input.close()
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.hostname !== 'mcp.utmify.com.br' || url.port
    || url.username || url.password || url.pathname !== '/mcp/' || !url.searchParams.get('token')) {
    throw new Error('Use a URL completa HTTPS gerada pela UTMify, com token e recursos.')
  }
  const cli = fileURLToPath(new URL('../node_modules/@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe', import.meta.url))
  const child = spawn(cli, ['mcp', 'add', '--transport', 'http', '--scope', 'user', 'utmify', url.href], {
    windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
  })
  // The CLI may echo the URL. Do not print its stdout or stderr with the token.
  child.stdout.resume()
  child.stderr.resume()
  child.once('error', () => { console.error('Nao foi possivel abrir o Claude local.'); process.exitCode = 1 })
  child.once('close', (code) => {
    if (code === 0) console.log('UTMify configurada. Reinicie o Jarvis para consultar seus dados.')
    else { console.error('Nao foi possivel salvar. Se ja existe uma conexao utmify, ajuste-a no Claude Code.'); process.exitCode = 1 }
  })
} catch (error) {
  input.close()
  console.error(error instanceof TypeError ? 'URL invalida. Copie a URL MCP completa da UTMify.' : error.message)
  process.exitCode = 1
}
