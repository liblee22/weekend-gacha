import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_FAILURES, buildData } from '../lib/build-data.js'

const rawSpot = (id) => ({ AttractionID: id, AttractionName: `景點${id}`, AttractionClasses: [19], PositionLat: 25, PositionLon: 121.5, ServiceStatus: 1 })
const cities = [{ code: 'Taipei', name: '臺北市' }, { code: 'Keelung', name: '基隆市' }]

function harness(byName) {
  const written = new Map()
  const logs = []
  return {
    written,
    logs,
    args: {
      tdx: { getAttractions: async (name) => byName(name) },
      writeJson: async (file, data) => { written.set(file, data) },
      log: (line) => logs.push(line),
      now: () => new Date('2026-09-30T00:00:00Z'),
    },
  }
}

test('writes one file per city plus an index, without internal fields', async () => {
  const h = harness(() => [rawSpot('a'), rawSpot('b')])
  const result = await buildData({ ...h.args, cities })
  assert.deepEqual([...h.written.keys()], ['Taipei.json', 'Keelung.json', 'cities.json'])
  const taipei = h.written.get('Taipei.json')
  assert.equal(taipei.generatedAt, '2026-09-30T00:00:00.000Z')
  assert.equal(taipei.spots.length, 2)
  assert.equal('closed' in taipei.spots[0], false)
  assert.deepEqual(h.written.get('cities.json').cities, [
    { code: 'Taipei', name: '臺北市', count: 2 },
    { code: 'Keelung', name: '基隆市', count: 2 },
  ])
  assert.deepEqual(result.failed, [])
})

test('failed or empty cities are skipped from the index', async () => {
  const h = harness((name) => {
    if (name === '基隆市') throw new Error('HTTP 500')
    return [rawSpot('a')]
  })
  const result = await buildData({ ...h.args, cities })
  assert.deepEqual(result.failed, ['基隆市'])
  assert.equal(h.written.has('Keelung.json'), false)
  assert.deepEqual(h.written.get('cities.json').cities.map((c) => c.code), ['Taipei'])
  assert.ok(h.logs.some((l) => l.includes('HTTP 500')))
  const empty = harness(() => [])
  assert.deepEqual((await buildData({ ...empty.args, cities: cities.slice(0, 1) })).failed, ['臺北市'])
})

test('too many failures aborts before writing the index', async () => {
  const many = Array.from({ length: MAX_FAILURES + 1 }, (_, i) => ({ code: `C${i}`, name: `城${i}` }))
  const h = harness(() => { throw new Error('down') })
  await assert.rejects(buildData({ ...h.args, cities: many }), /不發布/)
  assert.equal(h.written.has('cities.json'), false)
})

test('failed city falls back to previously published data', async () => {
  const old = { city: 'Keelung', generatedAt: '2026-09-23T00:00:00.000Z', spots: [{ id: 'old' }] }
  const h = harness((name) => {
    if (name === '基隆市') throw new Error('429')
    return [rawSpot('a')]
  })
  const result = await buildData({ ...h.args, cities, previous: async (code) => (code === 'Keelung' ? old : null) })
  assert.deepEqual(result.failed, [])
  assert.deepEqual(h.written.get('Keelung.json'), old)
  assert.deepEqual(h.written.get('cities.json').cities.map((c) => [c.code, c.count]), [['Taipei', 1], ['Keelung', 1]])
  assert.ok(h.logs.some((l) => l.startsWith('↺ 基隆市')))
})

test('bad or mismatched previous data is ignored', async () => {
  const h = harness(() => { throw new Error('down') })
  for (const previous of [async () => ({ city: 'Other', spots: [{}] }), async () => ({ city: 'Taipei', spots: [] }), async () => { throw new Error('404') }]) {
    const result = await buildData({ ...h.args, cities: cities.slice(0, 1), previous })
    assert.deepEqual(result.failed, ['臺北市'])
  }
})
