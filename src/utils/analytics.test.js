import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateAnalytics, calculatePerformance, comparison, detectOverpurchase, getDateRanges, localDateKey } from './analytics.js'

const food = { id: 'food-a', name: 'Tomato', category: 'Vegetables' }
const inventory = [
  { id: 'i1', food_id: 'food-a', food, unit: 'g', quantity_purchased: 1000, status: 'wasted' },
  { id: 'i2', food_id: 'food-a', food, unit: 'g', quantity_purchased: 1000, status: 'wasted' },
  { id: 'i3', food_id: 'food-a', food, unit: 'g', quantity_purchased: 1000, status: 'active' },
]
const range = getDateRanges(7, new Date(2026, 9, 5, 12))
const wasteLogs = [
  { inventory_item_id: 'i1', quantity_wasted: 200, estimated_value: 20, wasted_at: '2026-10-04T10:00:00Z' },
  { inventory_item_id: 'i2', quantity_wasted: 300, estimated_value: 30, wasted_at: '2026-10-05T10:00:00Z' },
  { inventory_item_id: 'i3', quantity_wasted: 100, estimated_value: 10, wasted_at: '2026-09-27T10:00:00Z' },
]
const consumptionLogs = [
  { inventory_item_id: 'i1', quantity_consumed: 500, consumed_at: '2026-10-03T10:00:00Z' },
  { inventory_item_id: 'i2', quantity_consumed: 500, consumed_at: '2026-10-04T10:00:00Z' },
  { inventory_item_id: 'i3', quantity_consumed: 50, consumed_at: '2026-09-27T10:00:00Z' },
]

test('builds exact 7, 30, and 90 day local ranges across month boundaries', () => {
  assert.equal(localDateKey(getDateRanges(7, new Date(2026, 2, 2, 12)).start), '2026-02-24')
  assert.equal(Math.round((getDateRanges(30, new Date(2026, 9, 5)).end - getDateRanges(30, new Date(2026, 9, 5)).start + 1) / 86_400_000), 30)
  assert.equal(getDateRanges(90, new Date(2026, 9, 5)).days, 90)
})

test('calculates waste, consumption, rate, value, and event totals', () => {
  const result = aggregateAnalytics({ inventory, wasteLogs, consumptionLogs, range })
  assert.equal(result.wasteTotals.g, 500)
  assert.equal(result.consumptionTotals.g, 1000)
  assert.equal(result.wasteRate.toFixed(1), '33.3')
  assert.equal(result.wasteValue, 50)
  assert.equal(result.wasteEvents, 2)
})

test('calculates category and top-food rankings with recurring waste', () => {
  const result = aggregateAnalytics({ inventory, wasteLogs, consumptionLogs, range })
  assert.equal(result.categories[0].name, 'Vegetables')
  assert.equal(result.categories[0].percent, 100)
  assert.equal(result.topFoods[0].name, 'Tomato')
  assert.equal(result.topFoods[0].recurring, true)
})

test('period comparison handles zero previous values without misleading percentages', () => {
  assert.equal(comparison(10, 0).label, 'New')
  assert.equal(comparison(0, 0).label, 'No previous data')
  assert.equal(comparison(8, 10).direction, 'down')
})

test('over-purchase requires three purchases and measurable low consumption plus waste', () => {
  assert.equal(detectOverpurchase(inventory, wasteLogs, consumptionLogs).length, 1)
  assert.equal(detectOverpurchase(inventory.slice(0, 1), wasteLogs, consumptionLogs).length, 0)
})

test('performance score remains unavailable with insufficient history', () => {
  assert.equal(calculatePerformance({ wasteRate: null, previousWasteRate: null, recurringCount: 0, activityEvents: 0 }).score, null)
  assert.equal(calculatePerformance({ wasteRate: 20, previousWasteRate: 30, recurringCount: 0, activityEvents: 6 }).score, 90)
})

test('zero-waste and zero-consumption data remain safe', () => {
  const result = aggregateAnalytics({ inventory, wasteLogs: [], consumptionLogs: [], range })
  assert.equal(result.wasteRate, null)
  assert.equal(result.performance.score, null)
})

