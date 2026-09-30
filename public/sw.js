// 離線支援：
// - 網頁本身（app shell）：同一版本的檔案一起快取、快取優先；部署時 VERSION 換成 commit SHA，
//   新 service worker 會整批重抓，避免新舊 JS 模組混用
// - 景點資料 data/*.json：先抓網路拿最新，沒網路就用上次存的
// 只處理同網域請求；照片（外部網站）、地圖不快取
const VERSION = 'dev' // deploy.yml 會換成 commit SHA
const SHELL_CACHE = `gacha-shell-${VERSION}`
const DATA_CACHE = 'gacha-data'
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'categories.js', 'data-source.js', 'favorites.js',
  'favorites-ui.js', 'geo.js', 'location.js', 'pick.js', 'manifest.webmanifest',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  // cache: 'reload' 跳過瀏覽器 HTTP 快取，確保整批都是這個版本
  const requests = SHELL.map((url) => new Request(url, { cache: 'reload' }))
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(requests)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, DATA_CACHE])
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// iOS Safari 不接受 service worker 回傳「經過重導向」的頁面（GitHub Pages 會把 /repo 導到 /repo/）
async function withoutRedirect(response) {
  if (!response.redirected) return response
  const body = await response.blob()
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
}

async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw error
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request.mode === 'navigate' ? 'index.html' : request, { ignoreSearch: true })
  if (cached) return cached
  return withoutRedirect(await fetch(request))
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
  const isData = url.pathname.includes('/data/') && url.pathname.endsWith('.json')
  event.respondWith(isData ? networkFirst(event.request) : cacheFirst(event.request))
})
