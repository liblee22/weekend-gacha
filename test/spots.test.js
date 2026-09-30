import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isUsable, matchesCategory, normalizeSpot, prepareSpots } from '../lib/spots.js'

// 形狀取自 TDX 觀光 V2 /Tourism/Attraction 的真實回應
const raw = {
  AttractionID: 'Attraction_379000000A_000002',
  AttractionName: ' 關渡碼頭 ',
  Description: '關渡原名甘豆門',
  PositionLat: 25.120871,
  PositionLon: 121.461979,
  AttractionClasses: [12, 23, 24],
  ServiceTimeInfo: '全天',
  ServiceStatus: 1,
  IsAccessibleForFree: 0,
  FeeInfo: '',
  WebsiteUrl: '',
  PostalAddress: { City: '臺北市', CityCode: '63000', Town: '北投區', StreetAddress: null },
  Telephones: [{ Tel: '(02)27208889', Ext: null }],
  Images: [{ Name: '關渡棧橋碼頭', URL: 'https://www.travel.taipei/a.jpg' }],
}

test('normalizeSpot maps the V2 attraction schema', () => {
  const s = normalizeSpot(raw)
  assert.equal(s.name, '關渡碼頭')
  assert.equal(s.address, '臺北市北投區')
  assert.equal(s.phone, '(02)27208889')
  assert.equal(s.openTime, '全天')
  assert.deepEqual(s.position, { lat: 25.120871, lon: 121.461979 })
  assert.deepEqual(s.picture, { url: 'https://www.travel.taipei/a.jpg', caption: '關渡棧橋碼頭' })
  assert.equal(normalizeSpot({ ...raw, Images: [{ URL: 'http://x.tw/p.jpg' }] }).picture.url, 'https://x.tw/p.jpg')
  assert.deepEqual(s.classCodes, [12, 23, 24])
  assert.deepEqual(s.classes, ['遊憩', '交通場站'])
  assert.equal(isUsable(s), true)
})

test('normalizeSpot ticket: free flag wins, else FeeInfo', () => {
  assert.equal(normalizeSpot({ ...raw, IsAccessibleForFree: 1, FeeInfo: '100元' }).ticket, '免費')
  assert.equal(normalizeSpot({ ...raw, FeeInfo: '全票 100 元' }).ticket, '全票 100 元')
})

test('normalizeSpot truncates long description', () => {
  const s = normalizeSpot({ ...raw, Description: '長'.repeat(300) })
  assert.equal(s.summary.length, 121)
  assert.ok(s.summary.endsWith('…'))
})

test('normalizeSpot rejects bad coordinates, urls and closed spots', () => {
  const s = normalizeSpot({
    ...raw,
    PositionLat: 0,
    PositionLon: null,
    Images: [{ URL: 'javascript:x' }],
    WebsiteUrl: 'ftp://x',
  })
  assert.equal(s.position, null)
  assert.equal(s.picture, null)
  assert.equal(s.website, '')
  assert.equal(isUsable(s), false)
  assert.equal(isUsable(normalizeSpot({ ...raw, ServiceStatus: 0 })), false)
  assert.equal(isUsable(normalizeSpot({ ...raw, ServiceStatus: 3 })), false)
  assert.equal(isUsable(normalizeSpot({ ...raw, ServiceStatus: null })), true)
})

test('normalizeSpot picks first image with a valid url', () => {
  const s = normalizeSpot({ ...raw, Images: [{ URL: '' }, { Name: 'b', URL: 'https://x/b.jpg' }] })
  assert.equal(s.picture.url, 'https://x/b.jpg')
})

test('normalizeSpot survives empty input', () => {
  const s = normalizeSpot(undefined)
  assert.equal(isUsable(s), false)
  assert.deepEqual(s.classCodes, [])
})

test('matchesCategory uses class codes', () => {
  const s = normalizeSpot(raw)
  assert.equal(matchesCategory(s, 'all'), true)
  assert.equal(matchesCategory(s, 'play'), false, '遊憩(12) alone is too broad to count as play')
  assert.equal(matchesCategory(normalizeSpot({ ...raw, AttractionClasses: [14] }), 'play'), true)
  assert.equal(matchesCategory(s, 'nature'), false)
  assert.equal(matchesCategory(normalizeSpot({ ...raw, AttractionClasses: [3] }), 'culture'), true)
  assert.equal(matchesCategory(normalizeSpot({ ...raw, AttractionClasses: [1] }), 'culture'), false, '文化(1) alone is too broad')
  assert.throws(() => matchesCategory(s, 'nope'))
})

test('prepareSpots filters unusable and rejects non-array', () => {
  assert.equal(prepareSpots([raw, { AttractionID: 'x' }]).length, 1)
  assert.throws(() => prepareSpots({}))
})
