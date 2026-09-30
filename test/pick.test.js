import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RECENT_LIMIT, mapEmbedUrl, navigationUrl, pickSpot, rememberPick } from '../public/pick.js'

const spots = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

test('pickSpot handles empty input', () => {
  assert.equal(pickSpot([]), null)
  assert.equal(pickSpot(undefined), null)
})

test('pickSpot avoids recent ids', () => {
  assert.equal(pickSpot(spots, ['a', 'b'], () => 0).id, 'c')
})

test('pickSpot falls back to full list when everything is recent', () => {
  assert.equal(pickSpot(spots, ['a', 'b', 'c'], () => 0.99).id, 'c')
})

test('rememberPick dedupes, keeps newest first, caps length, does not mutate', () => {
  const before = ['x', 'a']
  assert.deepEqual(rememberPick(before, 'a'), ['a', 'x'])
  assert.deepEqual(before, ['x', 'a'])
  const long = Array.from({ length: RECENT_LIMIT }, (_, i) => String(i))
  assert.equal(rememberPick(long, 'new').length, RECENT_LIMIT)
})

test('map urls', () => {
  assert.match(mapEmbedUrl({ lat: 25, lon: 121.5 }), /bbox=121\.49200,24\.99200,121\.50800,25\.00800.*marker=25,121\.5/)
  assert.equal(navigationUrl({ lat: 25, lon: 121.5 }), 'https://www.google.com/maps/dir/?api=1&destination=25%2C121.5')
})
