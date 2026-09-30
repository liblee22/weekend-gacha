const GEO_TIMEOUT_MS = 8000
const GEO_HARD_LIMIT_MS = 12000 // 使用者不理會定位詢問時，瀏覽器的 timeout 不會觸發
const GEO_MAX_AGE_MS = 10 * 60 * 1000

function currentPosition() {
  const ask = new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS },
    )
  })
  const giveUp = new Promise((_, reject) => setTimeout(() => reject(new Error('定位逾時')), GEO_HARD_LIMIT_MS))
  return Promise.race([ask, giveUp])
}

// 定位只在 https 或 localhost 能用（iPhone Safari 規定）
export function createLocator() {
  let found = null

  async function resolve() {
    if (found) return found
    if (!window.isSecureContext || !('geolocation' in navigator)) return null
    try {
      found = { origin: await currentPosition() }
    } catch {
      // 拒絕、逾時或沒訊號：不快取失敗，下次轉再試
    }
    return found
  }

  // 不觸發定位詢問，只回傳已經知道的位置
  const peek = () => found

  return { resolve, peek, supported: () => window.isSecureContext && 'geolocation' in navigator }
}
