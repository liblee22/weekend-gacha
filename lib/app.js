import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { isAllowedHost } from './config.js'

// 本機預覽用的靜態伺服器；正式版放在 GitHub Pages
const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
})

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(payload))
}

export function createApp({ publicDir }) {
  async function handleStatic(res, pathname) {
    const rel = normalize(pathname === '/' ? '/index.html' : pathname).replace(/^[\\/]+/, '')
    const file = join(publicDir, rel)
    if (!file.startsWith(publicDir + sep)) return sendJson(res, 403, { success: false, error: 'Forbidden' })
    try {
      const body = await readFile(file)
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      })
      return res.end(body)
    } catch {
      return sendJson(res, 404, { success: false, error: 'Not found' })
    }
  }

  return async function handler(req, res) {
    try {
      if (!isAllowedHost(req.headers.host)) return sendJson(res, 421, { success: false, error: 'Misdirected request' })
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { success: false, error: 'Method not allowed' })
      const { pathname } = new URL(req.url, 'http://localhost')
      return await handleStatic(res, pathname)
    } catch (error) {
      console.error('Request failed:', error)
      return sendJson(res, 500, { success: false, error: 'Server error' })
    }
  }
}
