const TOKEN_URL = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token'
// 觀光資料 V2（觀光資料標準 V2.1）；舊的 /api/basic/v2/Tourism/ScenicSpot 已下架（404）
const API_BASE = 'https://tdx.transportdata.tw/api/tourism/service/odata/V2'
const TOKEN_SAFETY_MS = 60_000
const DEFAULT_TOKEN_TTL_S = 3600
const DEFAULT_TIMEOUT_MS = 15_000
const PAGE_SIZE = 500 // API 上限
const MAX_PAGES = 10
// 觀光 API 限制「每分鐘 5 次」（回應 header x-ratelimit-limit-minute: 5），不是每秒
const MIN_INTERVAL_MS = 12_500
const MAX_RETRIES = 4
const DEFAULT_RETRY_AFTER_S = 15
const MAX_RETRY_AFTER_S = 120

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function createTdxClient({
  clientId, clientSecret, fetchImpl = fetch, now = Date.now, timeoutMs = DEFAULT_TIMEOUT_MS,
  minIntervalMs = MIN_INTERVAL_MS, sleep = realSleep,
}) {
  if (!clientId || !clientSecret) {
    throw new Error('缺少 TDX_CLIENT_ID / TDX_CLIENT_SECRET，請參考 .env.example 建立 .env')
  }

  // 共用同一個 promise，避免同時多個請求各自去換 token
  let tokenPromise = null
  let tokenExpiresAt = 0

  async function fetchToken() {
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw new Error(`TDX 取得 token 失敗（HTTP ${res.status}），請確認金鑰是否正確`)
    const body = await res.json()
    if (!body?.access_token) throw new Error('TDX token 回應缺少 access_token')
    const lifetimeMs = (Number(body.expires_in) || DEFAULT_TOKEN_TTL_S) * 1000
    return { value: body.access_token, expiresAt: now() + lifetimeMs - TOKEN_SAFETY_MS }
  }

  function getToken() {
    if (!tokenPromise || now() >= tokenExpiresAt) {
      tokenExpiresAt = Infinity // 換 token 途中，其他請求一起等這個 promise
      tokenPromise = fetchToken().then(
        (t) => { tokenExpiresAt = t.expiresAt; return t.value },
        (error) => { tokenPromise = null; throw error },
      )
    }
    return tokenPromise
  }

  function invalidateToken() {
    tokenPromise = null
  }

  // 所有 API 請求排隊，兩次之間至少隔 minIntervalMs
  let lastRequestAt = -Infinity
  let queue = Promise.resolve()

  function throttled(fn) {
    const run = queue.then(async () => {
      const delay = lastRequestAt + minIntervalMs - now()
      if (delay > 0) await sleep(delay)
      lastRequestAt = now()
      return fn()
    })
    queue = run.catch(() => undefined)
    return run
  }

  async function request(url) {
    const token = await getToken()
    return throttled(() => fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'gzip' },
      signal: AbortSignal.timeout(timeoutMs),
    }))
  }

  function retryAfterMs(res) {
    const seconds = Number(res.headers?.get?.('retry-after'))
    const wanted = Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_AFTER_S
    return (Math.min(wanted, MAX_RETRY_AFTER_S) + 1) * 1000
  }

  async function getJson(path, params) {
    const url = `${API_BASE}${path}?${new URLSearchParams({ ...params, $format: 'JSON' })}`
    let res = await request(url)
    if (res.status === 401) {
      invalidateToken()
      res = await request(url)
    }
    for (let attempt = 0; res.status === 429 && attempt < MAX_RETRIES; attempt += 1) {
      await sleep(retryAfterMs(res))
      res = await request(url)
    }
    if (res.status === 429) throw new Error('TDX 請求太頻繁（429），重試後還是被擋')
    if (!res.ok) throw new Error(`TDX API 錯誤（HTTP ${res.status}）`)
    return res.json()
  }

  // cityName 例：'臺北市'（呼叫端已用白名單驗證過）
  async function getAttractions(cityName) {
    const filter = `PostalAddress/City eq '${cityName.replaceAll("'", "''")}'`
    const collect = async (page, acc) => {
      const body = await getJson('/Tourism/Attraction', { $filter: filter, $top: String(PAGE_SIZE), $skip: String(page * PAGE_SIZE) })
      if (!Array.isArray(body?.value)) throw new Error('TDX 景點回應格式不正確')
      const all = [...acc, ...body.value]
      return body.value.length < PAGE_SIZE || page + 1 >= MAX_PAGES ? all : collect(page + 1, all)
    }
    return collect(0, [])
  }

  return { getAttractions }
}
