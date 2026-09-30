// 本機預覽：先 npm run build:data 產生 public/data，再 npm start
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './lib/app.js'
import { lanAddresses, parseHost } from './lib/config.js'

const port = Number(process.env.PORT ?? 5173)
const publicDir = fileURLToPath(new URL('./public', import.meta.url))

function announce(host) {
  console.info(`週末景點扭蛋機（本機預覽）→ http://localhost:${port}`)
  if (host === '0.0.0.0' || host === '::') {
    lanAddresses().forEach((ip) => console.info(`  同一個 Wi-Fi → http://${ip}:${port}（http 下 iPhone 不給定位）`))
  }
  if (!existsSync(join(publicDir, 'data', 'cities.json'))) {
    console.warn('⚠ 還沒有景點資料：先執行 npm run build:data')
  }
}

try {
  const host = parseHost(process.env)
  createServer(createApp({ publicDir }))
    .on('error', (error) => {
      console.error(error.code === 'EADDRINUSE' ? `Port ${port} 已被佔用，請在 .env 設定其他 PORT` : error.message)
      process.exit(1)
    })
    .listen(port, host, () => announce(host))
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
