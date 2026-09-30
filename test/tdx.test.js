import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTdxClient } from '../lib/tdx.js'

function fakeFetch(responses) {
  const queue = [...responses]
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url: String(url), init })
    const next = queue.shift()
    return { ok: next.status < 400, status: next.status, json: async () => next.body }
  }
  return { impl, calls }
}

const tokenOk = { status: 200, body: { access_token: 'tok', expires_in: 86400 } }
const page = (items) => ({ status: 200, body: { value: items } })
const client = (impl, extra = {}) => createTdxClient({ clientId: 'id', clientSecret: 's', fetchImpl: impl, minIntervalMs: 0, sleep: async () => {}, ...extra })
const apiCalls = (calls) => calls.filter((c) => !c.url.includes('/token'))

test('requires credentials', () => {
  assert.throws(() => createTdxClient({ clientId: '', clientSecret: 'x' }), /TDX_CLIENT_ID/)
})

test('queries Attraction with city filter and unwraps value', async () => {
  const { impl, calls } = fakeFetch([tokenOk, page([1, 2])])
  assert.deepEqual(await client(impl).getAttractions('臺北市'), [1, 2])
  const url = new URL(calls[1].url)
  assert.equal(url.pathname, '/api/tourism/service/odata/V2/Tourism/Attraction')
  assert.equal(url.searchParams.get('$filter'), "PostalAddress/City eq '臺北市'")
  assert.equal(url.searchParams.get('$top'), '500')
  assert.equal(url.searchParams.get('$skip'), '0')
  assert.equal(calls[1].init.headers.Authorization, 'Bearer tok')
})

test('escapes quotes in city name', async () => {
  const { impl, calls } = fakeFetch([tokenOk, page([])])
  await client(impl).getAttractions("a'b")
  assert.equal(new URL(calls[1].url).searchParams.get('$filter'), "PostalAddress/City eq 'a''b'")
})

test('paginates until a short page', async () => {
  const full = Array.from({ length: 500 }, (_, i) => i)
  const { impl, calls } = fakeFetch([tokenOk, page(full), page(full), page([1, 2, 3])])
  assert.equal((await client(impl).getAttractions('臺北市')).length, 1003)
  assert.deepEqual(apiCalls(calls).map((c) => new URL(c.url).searchParams.get('$skip')), ['0', '500', '1000'])
})

test('stops at page cap', async () => {
  const full = Array.from({ length: 500 }, (_, i) => i)
  const { impl, calls } = fakeFetch([tokenOk, ...Array.from({ length: 12 }, () => page(full))])
  assert.equal((await client(impl).getAttractions('臺北市')).length, 5000)
  assert.equal(apiCalls(calls).length, 10)
})

test('rejects unexpected response shape', async () => {
  const { impl } = fakeFetch([tokenOk, { status: 200, body: [1] }])
  await assert.rejects(client(impl).getAttractions('臺北市'), /格式/)
})

test('fetches token once and reuses it', async () => {
  const { impl, calls } = fakeFetch([tokenOk, page([1]), page([2])])
  const c = client(impl)
  assert.deepEqual(await c.getAttractions('臺北市'), [1])
  assert.deepEqual(await c.getAttractions('臺北市'), [2])
  assert.equal(calls.length, 3)
})

test('refreshes expired token', async () => {
  let t = 0
  const { impl, calls } = fakeFetch([
    { status: 200, body: { access_token: 'a', expires_in: 120 } },
    page([]),
    tokenOk,
    page([]),
  ])
  const c = client(impl, { now: () => t })
  await c.getAttractions('臺北市')
  t = 61_000
  await c.getAttractions('臺北市')
  assert.equal(calls.filter((x) => x.url.includes('/token')).length, 2)
})

test('surfaces token and API errors', async () => {
  await assert.rejects(client(fakeFetch([{ status: 401, body: {} }]).impl).getAttractions('臺北市'), /401/)
  const blocked = Array.from({ length: 5 }, () => ({ status: 429, body: {} }))
  await assert.rejects(client(fakeFetch([tokenOk, ...blocked]).impl).getAttractions('臺北市'), /429/)
  await assert.rejects(client(fakeFetch([tokenOk, { status: 404, body: {} }]).impl).getAttractions('臺北市'), /404/)
})

test('concurrent calls share one token request', async () => {
  const { impl, calls } = fakeFetch([tokenOk, page([]), page([])])
  const c = client(impl)
  await Promise.all([c.getAttractions('臺北市'), c.getAttractions('基隆市')])
  assert.equal(calls.filter((x) => x.url.includes('/token')).length, 1)
})

test('401 from API refreshes token and retries once', async () => {
  const { impl, calls } = fakeFetch([tokenOk, { status: 401, body: {} }, tokenOk, page(['ok'])])
  assert.deepEqual(await client(impl).getAttractions('臺北市'), ['ok'])
  assert.equal(calls.filter((x) => x.url.includes('/token')).length, 2)
})

test('missing expires_in falls back to default lifetime', async () => {
  const { impl, calls } = fakeFetch([{ status: 200, body: { access_token: 't' } }, page([]), page([])])
  const c = client(impl, { now: () => 0 })
  await c.getAttractions('臺北市')
  await c.getAttractions('臺北市')
  assert.equal(calls.length, 3)
})

test('failed token request is retried next time', async () => {
  const { impl } = fakeFetch([{ status: 500, body: {} }, tokenOk, page([7])])
  const c = client(impl)
  await assert.rejects(c.getAttractions('臺北市'))
  assert.deepEqual(await c.getAttractions('臺北市'), [7])
})

test('requests carry a timeout signal', async () => {
  const { impl, calls } = fakeFetch([tokenOk, page([])])
  await client(impl).getAttractions('臺北市')
  assert.ok(calls.every((c) => c.init.signal instanceof AbortSignal))
})

test('429 waits for Retry-After then succeeds', async () => {
  const slept = []
  const limited = { status: 429, body: {}, headers: { get: (k) => (k === 'retry-after' ? '8' : null) } }
  const queue = [tokenOk, limited, page(['ok'])]
  const impl = async () => {
    const next = queue.shift()
    return { ok: next.status < 400, status: next.status, headers: next.headers, json: async () => next.body }
  }
  const c = client(impl, { sleep: async (ms) => { slept.push(ms) } })
  assert.deepEqual(await c.getAttractions('臺北市'), ['ok'])
  assert.deepEqual(slept, [9000])
})

test('requests are spaced by minIntervalMs', async () => {
  let t = 0
  const slept = []
  const { impl } = fakeFetch([tokenOk, page([]), page([])])
  const c = client(impl, {
    now: () => t,
    minIntervalMs: 12_500,
    sleep: async (ms) => { slept.push(ms); t += ms },
  })
  await Promise.all([c.getAttractions('臺北市'), c.getAttractions('基隆市')])
  assert.deepEqual(slept, [12_500])
})

test('huge Retry-After is capped', async () => {
  const slept = []
  const limited = { status: 429, body: {}, headers: { get: () => '99999' } }
  const queue = [tokenOk, limited, page([])]
  const impl = async () => {
    const next = queue.shift()
    return { ok: next.status < 400, status: next.status, headers: next.headers, json: async () => next.body }
  }
  await client(impl, { sleep: async (ms) => { slept.push(ms) } }).getAttractions('臺北市')
  assert.deepEqual(slept, [121_000])
})
