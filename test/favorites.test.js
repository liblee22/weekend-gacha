import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FAVORITES_LIMIT, addFavorite, isFavorite, parseFavorites, removeFavorite, toggleFavorite,
} from '../public/favorites.js'

const spot = (id) => ({
  id, name: `景點${id}`, summary: '', address: '', openTime: '', ticket: '', phone: '', website: '',
  picture: null, position: { lat: 25, lon: 121.5 }, classes: ['遊憩'], distanceKm: 3,
})

test('add puts newest first, dedupes, drops distance, keeps input intact', () => {
  const before = [{ ...spot('a'), cityLabel: '臺北市' }]
  const after = addFavorite(before, spot('b'), '新北市')
  assert.deepEqual(after.map((f) => f.id), ['b', 'a'])
  assert.equal(after[0].cityLabel, '新北市')
  assert.equal('distanceKm' in after[0], false)
  assert.equal(before.length, 1)
  assert.deepEqual(addFavorite(after, spot('a'), '臺北市').map((f) => f.id), ['a', 'b'])
})

test('limit, remove, toggle, isFavorite', () => {
  const many = Array.from({ length: FAVORITES_LIMIT + 5 }, (_, i) => spot(String(i)))
    .reduce((list, s) => addFavorite(list, s, 'x'), [])
  assert.equal(many.length, FAVORITES_LIMIT)
  const one = toggleFavorite([], spot('a'), 'x')
  assert.equal(isFavorite(one, 'a'), true)
  assert.equal(isFavorite(toggleFavorite(one, spot('a'), 'x'), 'a'), false)
  assert.deepEqual(removeFavorite(one, 'zzz'), one)
})

test('parseFavorites rejects junk and neutralises unsafe urls', () => {
  assert.deepEqual(parseFavorites('not json'), [])
  assert.deepEqual(parseFavorites('{"a":1}'), [])
  const stored = JSON.stringify([
    { id: 'ok', name: 'A', position: { lat: 25, lon: 121 }, website: 'javascript:alert(1)',
      picture: { url: 'data:x', caption: 'c' }, classes: ['遊憩', 5], cityLabel: '臺北市', extra: '<b>' },
    { id: 'no-pos', name: 'B' },
    null,
  ])
  const [fav, ...rest] = parseFavorites(stored)
  assert.equal(rest.length, 0)
  assert.equal(fav.website, '')
  assert.equal(fav.picture, null)
  assert.deepEqual(fav.classes, ['遊憩'])
  assert.equal('extra' in fav, false)
  const good = parseFavorites(JSON.stringify([{ ...spot('g'), website: 'https://a.tw', picture: { url: 'https://p' } }]))
  assert.equal(good[0].website, 'https://a.tw')
  assert.deepEqual(good[0].picture, { url: 'https://p', caption: '' })
})
