import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedHost, lanAddresses, parseHost } from '../lib/config.js'

test('parseHost defaults to loopback and requires an IP', () => {
  assert.equal(parseHost({}), '127.0.0.1')
  assert.equal(parseHost({ HOST: '' }), '127.0.0.1', 'blank HOST= in .env means default')
  assert.equal(parseHost({ HOST: ' 0.0.0.0 ' }), '0.0.0.0')
  assert.throws(() => parseHost({ HOST: 'example.com' }), /HOST/)
})

test('isAllowedHost blocks DNS-rebinding style hostnames', () => {
  for (const ok of ['localhost:5173', '127.0.0.1:5173', '192.168.1.20:5173', '[::1]:5173', 'localhost']) {
    assert.equal(isAllowedHost(ok), true, ok)
  }
  for (const bad of ['evil.example:5173', 'localhost.evil.com', '', undefined, 'a b']) {
    assert.equal(isAllowedHost(bad), false, String(bad))
  }
})

test('lanAddresses returns IPv4 strings', () => {
  assert.ok(lanAddresses().every((ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip)))
})
