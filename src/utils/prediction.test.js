import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFoodHistory, calculateWasteRisk } from './prediction.js'

const food = { room_temperature_shelf_life_days: 14, refrigerated_shelf_life_days: 10, frozen_shelf_life_days: 90 }
const base = { id: 'item-a', food_id: 'food-a', food, unit: 'g', status: 'active', purchase_date: '2026-10-01', storage_type: 'room_temperature', custom_expiry_date: null, quantity_purchased: 500, quantity_remaining: 400, updated_at: '2026-10-01T00:00:00Z' }
const now = new Date(2026, 9, 5)

test('fresh food with manageable quantity produces low risk', () => {
  const result = calculateWasteRisk({ ...base, quantity_remaining: 200 }, { consumptionRate: 50, wasteRate: 0, averagePurchaseQuantity: 500 }, now)
  assert.equal(result.risk_level, 'low')
})

test('near expiry increases risk compared with fresh food', () => {
  const fresh = calculateWasteRisk(base, { consumptionRate: 30 }, now)
  const near = calculateWasteRisk({ ...base, custom_expiry_date: '2026-10-06' }, { consumptionRate: 30 }, now)
  assert.ok(near.risk_score > fresh.risk_score)
})

test('large expected surplus produces high risk', () => {
  const result = calculateWasteRisk({ ...base, custom_expiry_date: '2026-10-07', quantity_purchased: 2000, quantity_remaining: 1800 }, { consumptionRate: 40, averagePurchaseQuantity: 500 }, now)
  assert.ok(result.risk_score >= 50)
  assert.ok(result.contributing_factors.quantity_surplus >= 90)
})

test('repeated historical waste increases risk', () => {
  const withoutWaste = calculateWasteRisk(base, { consumptionRate: 30, wasteRate: 0 }, now)
  const withWaste = calculateWasteRisk(base, { consumptionRate: 30, wasteRate: 0.8 }, now)
  assert.ok(withWaste.risk_score > withoutWaste.risk_score)
})

test('no history uses fallback and discloses limited personalization', () => {
  const result = calculateWasteRisk(base, {}, now)
  assert.equal(result.contributing_factors.uses_personal_consumption, false)
  assert.ok(result.explanation.some((reason) => reason.includes('Limited personal consumption history')))
})

test('fully consumed, wasted, and zero-quantity items have no active risk', () => {
  assert.equal(calculateWasteRisk({ ...base, status: 'consumed' }, {}, now), null)
  assert.equal(calculateWasteRisk({ ...base, status: 'wasted' }, {}, now), null)
  assert.equal(calculateWasteRisk({ ...base, quantity_remaining: 0 }, {}, now), null)
})

test('multiple purchases retain history and prediction identity by inventory item', () => {
  const other = { ...base, id: 'item-b', quantity_purchased: 300 }
  const history = buildFoodHistory(base, [base, other], [{ inventory_item_id: 'item-b', quantity_consumed: 70, consumed_at: '2026-10-02T00:00:00Z' }, { inventory_item_id: 'item-b', quantity_consumed: 70, consumed_at: '2026-10-03T00:00:00Z' }], [], now)
  const result = calculateWasteRisk(base, history, now)
  assert.equal(result.inventory_item_id, 'item-a')
  assert.equal(history.purchaseCount, 1)
})

test('scores remain inside zero-to-one-hundred boundaries for extremes', () => {
  const extreme = calculateWasteRisk({ ...base, custom_expiry_date: '2020-01-01', quantity_purchased: 1_000_000, quantity_remaining: 1_000_000 }, { consumptionRate: 0.0001, wasteRate: 10, averagePurchaseQuantity: 1 }, now)
  assert.ok(extreme.risk_score >= 0 && extreme.risk_score <= 100)
})

test('missing expiry and zero historical purchase quantity do not crash', () => {
  const result = calculateWasteRisk({ ...base, food: {}, custom_expiry_date: null }, { consumptionRate: 0, wasteRate: null, averagePurchaseQuantity: null }, now)
  assert.ok(Number.isFinite(result.risk_score))
})
