import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../lib/app.js'

async function withServer(fn) {
  const publicDir = await mkdtemp(join(tmpdir(), 'gacha-'))
  await writeFile(join(publicDir, 'index.html'), '<h1>hi</h1>')
  await writeFile(join(publicDir, 'manifest.webmanifest'), '{}')
  await mkdir(join(publicDir, 'data'))
  await writeFile(join(publicDir, 'data', 'cities.json'), '{"cities":[]}')
  const server = createServer(createApp({ publicDir }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    await fn(base)
  } finally {
    server.close()
  }
}

function rawGet(base, path, host) {
  const { hostname, port } = new URL(base)
  return new Promise((resolve, reject) => {
    request({ hostname, port, path, headers: { host } }, (res) => {
      res.resume()
      res.on('end', () => resolve(res.statusCode))
    }).on('error', reject).end()
  })
}

test('serves static files with correct types', async () => {
  await withServer(async (base) => {
    assert.equal(await (await fetch(`${base}/`)).text(), '<h1>hi</h1>')
    const data = await fetch(`${base}/data/cities.json`)
    assert.match(data.headers.get('content-type'), /application\/json/)
    assert.match((await fetch(`${base}/manifest.webmanifest`)).headers.get('content-type'), /manifest\+json/)
    assert.equal((await fetch(`${base}/missing.js`)).status, 404)
  })
})

test('blocks traversal, non-GET and foreign Host headers', async () => {
  await withServer(async (base) => {
    assert.notEqual((await fetch(`${base}/..%2f..%2fpackage.json`)).status, 200)
    assert.equal(await rawGet(base, '/../package.json', '127.0.0.1'), 404)
    assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405)
    assert.equal(await rawGet(base, '/', 'evil.example'), 421)
    assert.equal(await rawGet(base, '/', '192.168.1.5:5173'), 200)
  })
})
