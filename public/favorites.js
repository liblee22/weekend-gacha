export const FAVORITES_LIMIT = 50

// 只留重新顯示卡片需要的欄位；距離跟出發點有關，不存
function snapshot(spot, cityLabel) {
  const { distanceKm: _omit, ...rest } = spot
  return { ...rest, cityLabel }
}

export function isFavorite(list, id) {
  return list.some((f) => f.id === id)
}

export function addFavorite(list, spot, cityLabel) {
  const others = list.filter((f) => f.id !== spot.id)
  return [snapshot(spot, cityLabel), ...others].slice(0, FAVORITES_LIMIT)
}

export function removeFavorite(list, id) {
  return list.filter((f) => f.id !== id)
}

export function toggleFavorite(list, spot, cityLabel) {
  return isFavorite(list, spot.id) ? removeFavorite(list, spot.id) : addFavorite(list, spot, cityLabel)
}

const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//.test(value)
const text = (value) => (typeof value === 'string' ? value : '')

// localStorage 的內容可能被改壞或來自舊版本：逐欄重建，網址只收 http(s)（避免 javascript: 進 href）
function sanitize(f) {
  return {
    id: f.id,
    name: f.name,
    summary: text(f.summary),
    address: text(f.address),
    openTime: text(f.openTime),
    ticket: text(f.ticket),
    phone: text(f.phone),
    website: isHttpUrl(f.website) ? f.website : '',
    picture: isHttpUrl(f.picture?.url) ? { url: f.picture.url, caption: text(f.picture.caption) } : null,
    position: { lat: f.position.lat, lon: f.position.lon },
    classes: Array.isArray(f.classes) ? f.classes.filter((c) => typeof c === 'string') : [],
    cityLabel: text(f.cityLabel),
  }
}

export function parseFavorites(json) {
  try {
    const data = JSON.parse(json)
    if (!Array.isArray(data)) return []
    return data
      .filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string'
        && Number.isFinite(f.position?.lat) && Number.isFinite(f.position?.lon))
      .slice(0, FAVORITES_LIMIT)
      .map(sanitize)
  } catch {
    return []
  }
}
