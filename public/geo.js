const EARTH_RADIUS_KM = 6371

export const DISTANCE_OPTIONS = Object.freeze([
  Object.freeze({ value: 0, label: '不限' }),
  Object.freeze({ value: 10, label: '10 公里內' }),
  Object.freeze({ value: 20, label: '20 公里內' }),
  Object.freeze({ value: 40, label: '40 公里內' }),
])

const toRad = (deg) => (deg * Math.PI) / 180

// 直線距離（haversine），不是車程
export function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

// 每個景點加上 distanceKm；maxKm 為 0 表示不限
export function withinDistance(spots, origin, maxKm) {
  if (!origin) return spots
  const measured = spots.map((s) => ({ ...s, distanceKm: distanceKm(origin, s.position) }))
  return maxKm > 0 ? measured.filter((s) => s.distanceKm <= maxKm) : measured
}

export function formatDistance(km) {
  if (!Number.isFinite(km)) return ''
  return km < 1 ? '不到 1 公里' : `約 ${km < 10 ? km.toFixed(1) : Math.round(km)} 公里`
}
