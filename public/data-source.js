import { matchesCategory } from './categories.js'

// 讀 GitHub Actions 預先建好的 data/*.json（相對路徑：GitHub Pages 子路徑也能用）
async function fetchJson(path) {
  let res
  try {
    res = await fetch(path)
  } catch {
    throw new Error('沒有網路，而且這個縣市還沒離線存過')
  }
  if (!res.ok) throw new Error('景點資料暫時拿不到，等一下再試試看')
  return res.json()
}

export function createDataSource() {
  const cityCache = new Map()

  async function loadIndex() {
    const index = await fetchJson('data/cities.json')
    if (!Array.isArray(index?.cities) || index.cities.length === 0) throw new Error('景點資料是空的')
    return index
  }

  function loadCity(code) {
    if (!cityCache.has(code)) {
      const pending = fetchJson(`data/${encodeURIComponent(code)}.json`).then((body) => {
        if (!Array.isArray(body?.spots)) throw new Error('景點資料格式不對')
        return body.spots
      })
      pending.catch(() => cityCache.delete(code))
      cityCache.set(code, pending)
    }
    return cityCache.get(code)
  }

  async function spotsFor(code, category) {
    return (await loadCity(code)).filter((s) => matchesCategory(s, category))
  }

  return { loadIndex, spotsFor }
}
