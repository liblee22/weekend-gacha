import { isFavorite, parseFavorites, removeFavorite, toggleFavorite } from './favorites.js'

const STORAGE_KEY = 'weekend-gacha:favorites'

function load() {
  try {
    return parseFavorites(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function save(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // 無痕模式等情況存不了：這次開著的期間還是能用
  }
}

function itemNode(fav, onOpen, onRemove) {
  const li = document.createElement('li')
  li.className = 'fav-item'
  const open = document.createElement('button')
  open.type = 'button'
  open.className = 'fav-open'
  const name = Object.assign(document.createElement('strong'), { textContent: fav.name })
  const city = Object.assign(document.createElement('span'), { textContent: fav.cityLabel })
  open.append(name, city)
  open.addEventListener('click', () => onOpen(fav))
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'fav-remove'
  remove.textContent = '✕'
  remove.setAttribute('aria-label', `從收藏移除 ${fav.name}`)
  remove.addEventListener('click', () => onRemove(fav.id))
  li.append(open, remove)
  return li
}

export function createFavoritesUi({ sectionEl, listEl, countEl, onOpen, onChange }) {
  let favorites = load()

  function commit(next) {
    favorites = next
    save(favorites)
    render()
    onChange()
  }

  function render() {
    sectionEl.hidden = favorites.length === 0
    countEl.textContent = String(favorites.length)
    listEl.replaceChildren(...favorites.map((f) => itemNode(f, onOpen, (id) => commit(removeFavorite(favorites, id)))))
  }

  render()

  return {
    has: (id) => isFavorite(favorites, id),
    toggle: (spot, cityLabel) => commit(toggleFavorite(favorites, spot, cityLabel)),
  }
}
