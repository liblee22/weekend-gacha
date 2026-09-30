export const RECENT_LIMIT = 10

// 從清單隨機抽一個，盡量避開最近抽過的；全部都抽過就不設限
export function pickSpot(spots, recentIds = [], rng = Math.random) {
  if (!Array.isArray(spots) || spots.length === 0) return null
  const fresh = spots.filter((s) => !recentIds.includes(s.id))
  const pool = fresh.length > 0 ? fresh : spots
  return pool[Math.floor(rng() * pool.length)]
}

export function rememberPick(recentIds, id) {
  return [id, ...recentIds.filter((x) => x !== id)].slice(0, RECENT_LIMIT)
}

export function mapEmbedUrl({ lat, lon }) {
  const d = 0.008
  const bbox = [lon - d, lat - d, lon + d, lat + d].map((n) => n.toFixed(5)).join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`
}

export function navigationUrl({ lat, lon }) {
  const params = new URLSearchParams({ api: '1', destination: `${lat},${lon}` })
  return `https://www.google.com/maps/dir/?${params}`
}
