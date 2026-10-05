import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateEstimatedExpiry, getFreshnessStatus, validateInventory } from './inventory.js'

const tomato = { room_temperature_shelf_life_days: 7, refrigerated_shelf_life_days: 10, frozen_shelf_life_days: 180 }
const item = { status: 'active', purchase_date: '2026-10-01', storage_type: 'refrigerator', custom_expiry_date: null, food: tomato }

test('estimates expiry from purchase date and selected storage shelf life', () => {
  assert.equal(calculateEstimatedExpiry(item), '2026-10-11')
})

test('custom expiry takes precedence over shelf-life estimate', () => {
  assert.equal(calculateEstimatedExpiry({ ...item, custom_expiry_date: '2026-10-08' }), '2026-10-08')
})

test('classifies fresh, expiring-soon, and expired items deterministically', () => {
  assert.equal(getFreshnessStatus(item, new Date(2026, 9, 5)).key, 'fresh')
  assert.equal(getFreshnessStatus(item, new Date(2026, 9, 8)).key, 'expiring')
  assert.equal(getFreshnessStatus(item, new Date(2026, 9, 12)).key, 'expired')
})

test('freshness helpers remain safe when used as array callbacks', () => {
  const states = [item].map(getFreshnessStatus)
  assert.equal(states.length, 1)
  assert.ok(['fresh', 'expiring', 'expired'].includes(states[0].key))
})

test('validates required fields and invalid numeric values', () => {
  const errors = validateInventory({ food_id: '', quantity_purchased: '0', unit: '', purchase_date: '', storage_type: '', purchase_price: '-1' })
  assert.deepEqual(Object.keys(errors).sort(), ['food_id', 'purchase_date', 'purchase_price', 'quantity_purchased', 'storage_type', 'unit'])
})
