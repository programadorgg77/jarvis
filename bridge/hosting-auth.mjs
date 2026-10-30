import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const COOKIE = '__Host-jarvis'
const TTL = 8 * 60 * 60 * 1000
const hash = (value) => createHash('sha256').update(value).digest()
const SESSION_NAME = `${COOKIE}=`

function loginPage(failed = false) {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acesso · J.A.R.V.I.S.</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#02080d;color:#d4efff;font:15px system-ui}main{width:min(340px,80vw);padding:36px;border:1px solid #17526a;background:#04121b}h1{letter-spacing:.35em;font-size:23px;color:#8ddfff}p{color:#89a9ba;line-height:1.5}label{display:block;margin-top:20px}input,button{box-sizing:border-box;width:100%;padding:12px;margin-top:8px;background:#051d29;border:1px solid #21627b;color:#e1f6ff;font:inherit;border-radius:3px}button{margin-top:26px;cursor:pointer;background:#103d50}input:focus-visible,button:focus-visible{outline:2px solid #73dcff;outline-offset:3px}.error{color:#ffb3a1}</style>
<main><h1>J.A.R.V.I.S.</h1><p>Identifique-se para acessar seu centro de comando.</p>${failed ? '<p class="error" role="alert">Usuário ou senha incorretos.</p>' : ''}
<form method="post" action="/login"><label>Usuário<input name="username" autocomplete="username" maxlength="100" required></label><label>Senha<input type="password" name="password" autocomplete="current-password" maxlength="1024" required></label><button type="submit">Acessar Jarvis</button></form></main></html>`
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '', size = 0, failed = false
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 4096) { failed = true; reject(new Error('body too large')); return }
      data += chunk
    })
    req.on('end', () => { if (!failed) resolve(data) })
    req.on('error', reject)
  })
}

export function createAccessGate({ user, password, origin, secure = true, now = Date.now }) {
  const usernameHash = hash(user)
  const passwordHash = hash(password)
  const sessions = new Map()
  const failures = new Map()
  const tokenOf = (req) => (req.headers.cookie ?? '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith(SESSION_NAME))?.slice(SESSION_NAME.length) ?? ''
  const sessionId = (req) => hash(tokenOf(req)).toString('hex')
  const authenticated = (req) => {
    const id = sessionId(req)
    const expires = sessions.get(id)
    if (!expires || expires <= now()) { sessions.delete(id); return false }
    return true
  }
  const cookie = (value, maxAge) => `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
  const redirect = (res, location) => { res.writeHead(303, { location }); res.end() }
  const json = (res, code, message) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: message })) }
  const page = (res, code = 200, failed = false) => {
    res.writeHead(code, { 'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" })
    res.end(loginPage(failed))
  }
  return {
    authenticated,
    async handle(req, res) {
      const path = (req.url ?? '/').split('?')[0]
      if (path === '/login') {
        if (req.method === 'GET') { page(res); return true }
        if (req.method !== 'POST') { json(res, 405, 'Metodo invalido.'); return true }
        if (req.headers.origin !== origin) { json(res, 403, 'Origem invalida.'); return true }
        if (!(req.headers['content-type'] ?? '').startsWith('application/x-www-form-urlencoded')) {
          json(res, 415, 'Formato invalido.'); return true
        }
        const time = now()
        for (const [key, value] of failures) if (value.until <= time) failures.delete(key)
        const ip = req.socket.remoteAddress ?? 'unknown'
        const fail = failures.get(ip) ?? { count: 0, until: time + 5 * 60_000 }
        if (fail.count >= 5) {
          res.setHeader('retry-after', String(Math.max(1, Math.ceil((fail.until - time) / 1000))))
          json(res, 429, 'Muitas tentativas. Aguarde alguns minutos.'); return true
        }
        let body
        try { body = new URLSearchParams(await readBody(req)) } catch { json(res, 413, 'Formulario muito grande.'); return true }
        const userMatches = timingSafeEqual(hash(body.get('username') ?? ''), usernameHash)
        const passwordMatches = timingSafeEqual(hash(body.get('password') ?? ''), passwordHash)
        if (!userMatches || !passwordMatches) {
          fail.count++
          if (failures.size >= 2048) failures.delete(failures.keys().next().value)
          failures.set(ip, fail)
          page(res, 401, true); return true
        }
        failures.delete(ip)
        for (const [id, expires] of sessions) if (expires <= time) sessions.delete(id)
        if (sessions.size >= 64) sessions.delete(sessions.keys().next().value)
        const token = randomBytes(32).toString('base64url')
        sessions.set(hash(token).toString('hex'), time + TTL)
        res.setHeader('set-cookie', cookie(token, TTL / 1000))
        redirect(res, '/'); return true
      }
      if (path === '/logout') {
        if (req.method !== 'POST' || req.headers.origin !== origin) { json(res, 403, 'Origem invalida.'); return true }
        sessions.delete(sessionId(req))
        res.setHeader('set-cookie', cookie('', 0))
        redirect(res, '/login'); return true
      }
      if (authenticated(req)) return false
      if (req.method === 'GET' && (req.headers.accept ?? '').includes('text/html')) redirect(res, '/login')
      else json(res, 401, 'Entre na sua conta para acessar o Jarvis.')
      return true
    },
  }
}
