// 用法：npm run build:data（本機讀 .env；GitHub Actions 讀 Secrets）
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildData } from '../lib/build-data.js'
import { CITIES } from '../lib/cities.js'
import { createTdxClient } from '../lib/tdx.js'

const outDir = fileURLToPath(new URL('../public/data', import.meta.url))

// PREVIOUS_DATA_URL（GitHub Actions 設定）：線上版的 data 目錄，某縣市抓失敗時沿用
function previousFrom(baseUrl) {
  if (!baseUrl) return undefined
  return async (code) => {
    const res = await fetch(`${baseUrl}/${encodeURIComponent(code)}.json`, { signal: AbortSignal.timeout(15_000) })
    return res.ok ? res.json() : null
  }
}

async function main() {
  const tdx = createTdxClient({ clientId: process.env.TDX_CLIENT_ID, clientSecret: process.env.TDX_CLIENT_SECRET })
  await mkdir(outDir, { recursive: true })
  const writeJson = (name, data) => writeFile(join(outDir, name), JSON.stringify(data))
  const previous = previousFrom(process.env.PREVIOUS_DATA_URL)
  const result = await buildData({ tdx, cities: CITIES, writeJson, previous, log: (line) => console.info(line) })
  const total = result.cities.reduce((sum, c) => sum + c.count, 0)
  console.info(`完成：${result.cities.length} 個縣市、${total} 個景點${result.failed.length ? `；失敗：${result.failed.join('、')}` : ''}`)
}

main().catch((error) => {
  console.error(`建置失敗：${error.message}`)
  process.exit(1)
})
