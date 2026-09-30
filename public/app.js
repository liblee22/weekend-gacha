import { createDataSource } from './data-source.js'
import { createFavoritesUi } from './favorites-ui.js'
import { DISTANCE_OPTIONS, distanceKm, formatDistance, withinDistance } from './geo.js'
import { createLocator } from './location.js'
import { mapEmbedUrl, navigationUrl, pickSpot, rememberPick } from './pick.js'

const SPIN_MS = 1500
const CAPSULE_COLORS = ['#ff5a4e', '#ffc93c', '#1fb5a3', '#4d8dff', '#ff8fb8', '#9b6bff']
const PREFS_KEY = 'weekend-gacha:prefs'
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const $ = (id) => document.getElementById(id)
const els = {
  city: $('city'), category: $('category'), distance: $('distance'), originHint: $('origin-hint'),
  machine: $('machine'), capsules: $('capsules'), ticker: $('ticker'), spin: $('spin'), drop: $('drop'),
  status: $('status'), result: $('result'), photo: $('photo'), photoImg: $('photo-img'), name: $('spot-name'),
  tags: $('spot-tags'), summary: $('spot-summary'), facts: $('spot-facts'), map: $('spot-map'),
  nav: $('spot-nav'), web: $('spot-web'), fav: $('fav'), again: $('again'), updated: $('data-updated'),
}

const data = createDataSource()
const locator = createLocator()
let recentIds = []
let busy = false
let shown = null // { spot, cityLabel }
let favorites = null

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) ?? {}
  } catch {
    return {}
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // 無痕模式等情況存不了，沒關係
  }
}

const checkedValue = (group, fallback) => group.querySelector('input:checked')?.value ?? fallback

function setStatus(text, isError = false) {
  els.status.textContent = text
  els.status.classList.toggle('error', isError)
}

function renderCapsules() {
  const nodes = Array.from({ length: 11 }, (_, i) => {
    const el = document.createElement('span')
    el.className = 'capsule'
    const row = Math.floor(i / 4)
    const col = i % 4
    el.style.left = `${8 + col * 21 + (row % 2) * 8}%`
    el.style.top = `${48 + row * 15 - (col % 2) * 6}%`
    el.style.setProperty('--c', CAPSULE_COLORS[i % CAPSULE_COLORS.length])
    el.style.setProperty('--r', `${(i * 47) % 360}deg`)
    el.style.animationDelay = `${(i % 5) * 0.05}s`
    return el
  })
  els.capsules.replaceChildren(...nodes)
}

function renderDistanceChips(saved) {
  const chips = DISTANCE_OPTIONS.map(({ value, label }) => {
    const wrap = document.createElement('label')
    wrap.className = 'chip'
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'distance', value: String(value) })
    input.checked = value === saved
    wrap.append(input, Object.assign(document.createElement('span'), { textContent: label }))
    return wrap
  })
  els.distance.replaceChildren(...chips)
}

function updateOriginHint() {
  const text = locator.peek() ? '📍 從你現在的位置算（直線距離）'
    : locator.supported() ? '選了距離會詢問定位，請按「允許」'
      : '這個網址不能用定位（要 https），距離篩選沒辦法用'
  els.originHint.textContent = text
}

function showUpdated(iso) {
  const date = new Date(iso)
  els.updated.textContent = Number.isNaN(date.getTime()) ? '' : `資料更新：${date.toLocaleDateString('zh-TW')}`
}

async function loadSetup() {
  const { cities, generatedAt } = await data.loadIndex()
  showUpdated(generatedAt)
  const saved = readPrefs()
  const options = cities.map(({ code, name }) => new Option(name, code, false, code === (saved.city ?? 'Taipei')))
  els.city.replaceChildren(...options)
  els.city.disabled = false
  const savedCategory = els.category.querySelector(`input[value="${CSS.escape(saved.category ?? 'all')}"]`)
  if (savedCategory) savedCategory.checked = true
  const savedKm = DISTANCE_OPTIONS.some((o) => o.value === saved.maxKm) ? saved.maxKm : 0
  renderDistanceChips(savedKm)
  updateOriginHint()
}

function runTicker(names) {
  if (names.length === 0) return () => {}
  const timer = setInterval(() => {
    els.ticker.textContent = names[Math.floor(Math.random() * names.length)]
  }, 90)
  return () => clearInterval(timer)
}

function addFact(label, value) {
  if (!value) return []
  const dt = document.createElement('dt')
  dt.textContent = label
  const dd = document.createElement('dd')
  dd.textContent = value
  return [dt, dd]
}

function distanceText(spot) {
  const known = locator.peek()
  const km = spot.distanceKm ?? (known ? distanceKm(known.origin, spot.position) : NaN)
  return Number.isFinite(km) ? `從這裡${formatDistance(km)}（直線）` : ''
}

function syncFavButton() {
  const on = Boolean(shown && favorites?.has(shown.spot.id))
  els.fav.textContent = on ? '★ 已收藏' : '☆ 收藏'
  els.fav.setAttribute('aria-pressed', String(on))
}

function renderSpot(spot, cityLabel) {
  shown = { spot, cityLabel }
  els.photo.classList.toggle('empty', !spot.picture)
  if (spot.picture) {
    els.photoImg.src = spot.picture.url
    els.photoImg.alt = spot.picture.caption || spot.name
  } else {
    els.photoImg.removeAttribute('src')
    els.photoImg.alt = ''
  }
  els.name.textContent = spot.name
  els.tags.replaceChildren(...spot.classes.map((c) => Object.assign(document.createElement('li'), { textContent: c })))
  els.summary.textContent = spot.summary || '這個地方還沒有介紹，去了就知道！'
  els.facts.replaceChildren(
    ...addFact('距離', distanceText(spot)),
    ...addFact('開放', spot.openTime),
    ...addFact('門票', spot.ticket),
    ...addFact('地址', spot.address),
    ...addFact('電話', spot.phone),
  )
  els.map.src = mapEmbedUrl(spot.position)
  els.nav.href = navigationUrl(spot.position)
  els.web.hidden = !spot.website
  els.web.href = spot.website || '#'
  syncFavButton()
  els.result.hidden = false
  els.result.style.animation = 'none'
  void els.result.offsetWidth
  els.result.style.animation = ''
  els.result.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
}

function emptyMessage(maxKm) {
  return maxKm > 0 ? `${maxKm} 公里內沒有符合的景點，放寬距離或換個分類試試看！` : '這個分類在這裡沒有景點，換一個試試看！'
}

async function spin() {
  if (busy) return
  busy = true
  els.spin.disabled = true
  els.drop.classList.remove('dropped')
  setStatus('轉轉轉…')
  const city = els.city.value
  const cityLabel = els.city.selectedOptions[0]?.textContent ?? ''
  const category = checkedValue(els.category, 'all')
  const maxKm = Number(checkedValue(els.distance, '0'))
  savePrefs({ city, category, maxKm })

  els.machine.classList.add('spinning')
  els.ticker.textContent = '…'
  const spinDone = new Promise((r) => setTimeout(r, reducedMotion ? 0 : SPIN_MS))
  const dataPromise = data.spotsFor(city, category)
  const originPromise = maxKm > 0 ? locator.resolve() : Promise.resolve(locator.peek())
  let stopTicker = () => {}
  dataPromise.then((spots) => { stopTicker = runTicker(spots.map((s) => s.name)) }, () => {})

  try {
    const [spots, located] = await Promise.all([dataPromise, originPromise, spinDone])
    updateOriginHint()
    if (maxKm > 0 && !located) {
      setStatus('拿不到位置：到「設定 > 隱私權 > 定位服務」允許 Safari，或把距離改成「不限」', true)
      return
    }
    const pool = withinDistance(spots, located?.origin, maxKm)
    const spot = pickSpot(pool, recentIds)
    if (!spot) {
      setStatus(emptyMessage(maxKm), true)
      return
    }
    recentIds = rememberPick(recentIds, spot.id)
    els.drop.style.setProperty('--drop', CAPSULE_COLORS[Math.floor(Math.random() * CAPSULE_COLORS.length)])
    els.drop.classList.add('dropped')
    setStatus(`從 ${pool.length} 個景點裡抽中了一個！`)
    renderSpot(spot, cityLabel)
  } catch (error) {
    setStatus(error.message, true)
  } finally {
    stopTicker()
    els.machine.classList.remove('spinning')
    els.spin.disabled = false
    busy = false
  }
}

favorites = createFavoritesUi({
  sectionEl: $('favorites'),
  listEl: $('fav-list'),
  countEl: $('fav-count'),
  onOpen: (fav) => {
    if (busy) return // 正在轉：轉完的結果會蓋掉，乾脆先不開
    setStatus(`收藏的景點：${fav.name}`)
    renderSpot(fav, fav.cityLabel)
  },
  onChange: syncFavButton,
})

els.photoImg.addEventListener('error', () => els.photo.classList.add('empty'))
els.spin.addEventListener('click', spin)
els.fav.addEventListener('click', () => {
  if (shown) favorites.toggle(shown.spot, shown.cityLabel)
})
els.again.addEventListener('click', () => {
  els.machine.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
  spin()
})

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // 沒有離線功能也能用
  })
}

renderCapsules()
loadSetup()
  .then(() => {
    els.spin.disabled = false
    setStatus('選好了就按「轉！」')
  })
  .catch((error) => setStatus(error.message, true))
