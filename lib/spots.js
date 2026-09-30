// 景點類型代碼（觀光資料標準 V2.1 AttractionClassEnum）
export const ATTRACTION_CLASSES = Object.freeze({
  1: '文化', 2: '生態', 3: '文化資產', 4: '宗教廟宇', 5: '藝術', 6: '商圈商店', 7: '國家公園',
  8: '國家風景區', 9: '休閒農業', 10: '溫泉', 11: '自然風景', 12: '遊憩', 13: '體育健身',
  14: '觀光工廠', 15: '都會公園', 16: '森林遊樂區', 17: '平地森林園區', 18: '國家自然公園',
  19: '公園綠地', 20: '觀光遊樂業', 21: '原住民文化', 22: '客家文化', 23: '交通場站',
})

export { CATEGORY_GROUPS, matchesCategory } from '../public/categories.js'

// 營運狀態：0 永久停止、3 暫時停止營運
const CLOSED_STATUSES = Object.freeze([0, 3])
const SUMMARY_MAX = 120
// 台灣本島 + 離島（金門、馬祖、澎湖、蘭嶼）大致範圍
const LAT_RANGE = [21.5, 26.5]
const LON_RANGE = [118.0, 122.5]

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function httpUrl(value) {
  const url = clean(value)
  return /^https?:\/\//.test(url) ? url : ''
}

function summarize(text) {
  const flat = text.replace(/\s+/g, ' ')
  return flat.length > SUMMARY_MAX ? `${flat.slice(0, SUMMARY_MAX)}…` : flat
}

function toPosition(lat, lon) {
  const inRange = lat >= LAT_RANGE[0] && lat <= LAT_RANGE[1] && lon >= LON_RANGE[0] && lon <= LON_RANGE[1]
  return inRange ? { lat, lon } : null
}

// 網頁在 https 上，http 照片會被 Safari 擋掉：先升級成 https（對方不支援就由 onerror 隱藏）
function toPicture(images) {
  const image = Array.isArray(images) ? images.find((img) => httpUrl(img?.URL)) : undefined
  return image ? { url: httpUrl(image.URL).replace(/^http:\/\//, 'https://'), caption: clean(image.Name) } : null
}

function toAddress(postal) {
  return [postal?.City, postal?.Town, postal?.StreetAddress].map(clean).join('')
}

function toTicket(raw) {
  if (raw?.IsAccessibleForFree === 1) return '免費'
  return clean(raw?.FeeInfo)
}

function toClassCodes(classes) {
  return Array.isArray(classes) ? classes.filter((c) => Number.isInteger(c)) : []
}

export function normalizeSpot(raw) {
  const classCodes = toClassCodes(raw?.AttractionClasses)
  return {
    id: clean(raw?.AttractionID),
    name: clean(raw?.AttractionName),
    summary: summarize(clean(raw?.Description)),
    address: toAddress(raw?.PostalAddress),
    openTime: clean(raw?.ServiceTimeInfo),
    ticket: toTicket(raw),
    phone: clean(raw?.Telephones?.[0]?.Tel),
    website: httpUrl(raw?.WebsiteUrl),
    picture: toPicture(raw?.Images),
    position: toPosition(Number(raw?.PositionLat), Number(raw?.PositionLon)),
    classCodes,
    classes: classCodes.map((c) => ATTRACTION_CLASSES[c]).filter(Boolean),
    closed: CLOSED_STATUSES.includes(raw?.ServiceStatus),
  }
}

export function isUsable(spot) {
  return Boolean(spot.id && spot.name && spot.position && !spot.closed)
}

export function prepareSpots(rawList) {
  if (!Array.isArray(rawList)) throw new Error('TDX 回傳格式不是陣列')
  return rawList.map(normalizeSpot).filter(isUsable)
}
