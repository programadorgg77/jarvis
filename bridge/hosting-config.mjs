export function hostingConfig(env = process.env) {
  const deployed = env.JARVIS_DEPLOY === '1'
  const port = Number(deployed ? env.PORT ?? env.JARVIS_BRIDGE_PORT ?? 8787 : env.JARVIS_BRIDGE_PORT ?? 8787)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta invalida.')
  if (!deployed) return { deployed, port, host: '127.0.0.1', origin: null }
  const publicUrl = env.JARVIS_PUBLIC_URL || env.RENDER_EXTERNAL_URL || (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : '')
  if (!publicUrl) throw new Error('Configure o dominio publico da hospedagem ou JARVIS_PUBLIC_URL (origin).')
  let url
  try { url = new URL(publicUrl) } catch { throw new Error('Dominio publico invalido.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('JARVIS_PUBLIC_URL deve ser uma origem HTTPS, sem caminho, parametros ou credenciais.')
  }
  const user = String(env.JARVIS_ACCESS_USER ?? '').trim()
  const password = String(env.JARVIS_ACCESS_PASSWORD ?? '')
  if (!user || user.length > 100 || password.length < 12 || password.length > 1024) {
    throw new Error('Configure usuario e senha (password com pelo menos 12 caracteres) para acesso ao Jarvis.')
  }
  return { deployed, port, host: '0.0.0.0', origin: url.origin, user, password }
}

export function environmentServers(env = process.env) {
  if (!env.UTMIFY_MCP_URL) return {}
  let url
  try { url = new URL(env.UTMIFY_MCP_URL) } catch { throw new Error('UTMIFY_MCP_URL invalida.') }
  if (url.protocol !== 'https:' || url.hostname !== 'mcp.utmify.com.br' || url.port || url.username || url.password
    || !['/mcp', '/mcp/'].includes(url.pathname) || !url.searchParams.get('token')) {
    throw new Error('UTMIFY_MCP_URL deve ser a URL HTTPS de conexao MCP da UTMify.')
  }
  return { utmify: { type: 'http', url: url.href } }
}
