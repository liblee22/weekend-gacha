import { isIP } from 'node:net'
import { networkInterfaces } from 'node:os'

const LOOPBACK = '127.0.0.1'

// 預設只給本機用；HOST=0.0.0.0 才開放區網
export function parseHost(env) {
  const host = (env.HOST ?? '').trim() || LOOPBACK
  if (!isIP(host)) throw new Error(`HOST 要是 IP，例如 ${LOOPBACK}（只給本機）或 0.0.0.0（開放區網）`)
  return host
}

// 擋 DNS rebinding：只接受 localhost 或 IP 直連，網域名稱一律拒絕
export function isAllowedHost(hostHeader) {
  if (typeof hostHeader !== 'string' || hostHeader === '') return false
  let hostname
  try {
    hostname = new URL(`http://${hostHeader}`).hostname
  } catch {
    return false
  }
  const bare = hostname.replace(/^\[|\]$/g, '')
  return bare === 'localhost' || isIP(bare) !== 0
}

export function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((ni) => ni && ni.family === 'IPv4' && !ni.internal)
    .map((ni) => ni.address)
}
