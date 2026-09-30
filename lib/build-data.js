import { prepareSpots } from './spots.js'

// 限流由 TDX client 統一處理（每分鐘 5 次）
export const MAX_FAILURES = 3

// 網頁用不到的欄位不輸出，檔案小一點
function slim({ closed: _closed, ...spot }) {
  return spot
}

/**
 * 抓每個縣市的景點，寫成 data/<code>.json，再寫 data/cities.json 索引。
 * 失敗的縣市不寫檔也不列入索引；失敗超過 MAX_FAILURES 就整批放棄（線上保留舊版）。
 */
// previous(code)：拿線上現有的那份（可省略）；抓失敗時沿用，免得這個縣市消失一整週
async function fallbackFor(city, previous) {
  try {
    const old = previous ? await previous(city.code) : null
    return old?.city === city.code && Array.isArray(old.spots) && old.spots.length > 0 ? old : null
  } catch {
    return null
  }
}

export async function buildData({ tdx, cities, writeJson, log, previous, now = () => new Date() }) {
  const generatedAt = now().toISOString()
  const results = []
  for (const city of cities) {
    try {
      const spots = prepareSpots(await tdx.getAttractions(city.name)).map(slim)
      if (spots.length === 0) throw new Error('沒有任何可用景點')
      await writeJson(`${city.code}.json`, { city: city.code, generatedAt, spots })
      log(`✔ ${city.name} ${spots.length}`)
      results.push({ ...city, count: spots.length })
    } catch (error) {
      const old = await fallbackFor(city, previous)
      if (old) {
        await writeJson(`${city.code}.json`, old)
        log(`↺ ${city.name}：${error.message}；沿用 ${old.generatedAt} 的資料`)
        results.push({ ...city, count: old.spots.length, stale: true })
      } else {
        log(`✖ ${city.name}：${error.message}`)
        results.push({ ...city, count: 0, failed: true })
      }
    }
  }
  const failed = results.filter((r) => r.failed)
  if (failed.length > MAX_FAILURES) {
    throw new Error(`${failed.length} 個縣市失敗（上限 ${MAX_FAILURES}），這次不發布`)
  }
  const index = results.filter((r) => !r.failed).map(({ code, name, count }) => ({ code, name, count }))
  await writeJson('cities.json', { generatedAt, cities: index })
  return { generatedAt, cities: index, failed: failed.map((f) => f.name) }
}
