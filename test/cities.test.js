import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CITIES, isValidCity } from '../lib/cities.js'

test('isValidCity', () => {
  assert.equal(CITIES.length, 22)
  assert.equal(isValidCity('Taipei'), true)
  assert.equal(isValidCity('Taipei/../x'), false)
  assert.equal(isValidCity(null), false)
})
