import { test } from 'node:test'
import assert from 'node:assert/strict'
import { distanceKm, formatDistance, withinDistance } from '../public/geo.js'

const taipei101 = { lat: 25.0340, lon: 121.5645 }
const taipeiMain = { lat: 25.0478, lon: 121.5170 }
const kaohsiung = { lat: 22.6273, lon: 120.3014 }

test('distanceKm is roughly right', () => {
  assert.equal(distanceKm(taipei101, taipei101), 0)
  const d = distanceKm(taipei101, taipeiMain)
  assert.ok(d > 4.5 && d < 5.5, `101 to Taipei Main ≈ 5 km, got ${d}`)
  const far = distanceKm(taipei101, kaohsiung)
  assert.ok(far > 290 && far < 310, `Taipei to Kaohsiung ≈ 300 km, got ${far}`)
})

test('withinDistance annotates, filters and does not mutate', () => {
  const spots = [{ id: 'near', position: taipeiMain }, { id: 'far', position: kaohsiung }]
  const within = withinDistance(spots, taipei101, 10)
  assert.deepEqual(within.map((s) => s.id), ['near'])
  assert.ok(within[0].distanceKm > 4)
  assert.equal(spots[0].distanceKm, undefined)
  assert.equal(withinDistance(spots, taipei101, 0).length, 2)
  assert.equal(withinDistance(spots, null, 10), spots)
})

test('formatDistance', () => {
  assert.equal(formatDistance(0.4), '不到 1 公里')
  assert.equal(formatDistance(4.96), '約 5.0 公里')
  assert.equal(formatDistance(23.4), '約 23 公里')
  assert.equal(formatDistance(NaN), '')
})
