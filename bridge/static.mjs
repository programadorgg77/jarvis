import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultRoot = fileURLToPath(new URL('../dist', import.meta.url))
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
}
const inside = (root, path) => {
  const rel = relative(root, path)
  return rel !== '' && !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)
}

// Serve only the compiled interface. Home configuration and bridge source are
// outside this root; realpath also prevents a symlink from escaping it.
export async function serveBuiltApp(req, res, root = defaultRoot) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  let path
  try { path = decodeURIComponent((req.url ?? '/').split('?')[0]) } catch { return false }
  if (!path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.includes(':')) return false
  if (path.split('/').some((part) => part.startsWith('.'))) return false
  const asked = path === '/' ? '/index.html' : path
  const type = types[extname(asked)]
  if (!type) return false
  try {
    const realRoot = await realpath(root)
    const target = await realpath(resolve(realRoot, `.${asked}`))
    if (!inside(realRoot, target)) return false
    const info = await stat(target)
    if (!info.isFile()) return false
    res.writeHead(200, { 'content-type': type, 'content-length': info.size })
    if (req.method === 'HEAD') res.end()
    else createReadStream(target).on('error', () => res.destroy()).pipe(res)
    return true
  } catch { return false }
}
