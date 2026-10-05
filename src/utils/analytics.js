import { calculateEstimatedExpiry, daysUntil } from './inventory.js'

export const ANALYTICS_RANGES = Object.freeze({ 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days' })
export const RECURRING_WASTE_PURCHASES = 2
export const OVERPURCHASE_MIN_PURCHASES = 3

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))

export function localDateKey(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function getDateRanges(days, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const start = new Date(end); start.setDate(start.getDate() - days + 1); start.setHours(0, 0, 0, 0)
  const previousEnd = new Date(start.getTime() - 1)
  const previousStart = new Date(previousEnd); previousStart.setDate(previousStart.getDate() - days + 1); previousStart.setHours(0, 0, 0, 0)
  return { days, start, end, previousStart, previousEnd }
}

export function normalizeQuantity(quantity, unit) {
  const value = Number(quantity || 0)
  if (unit === 'kg') return { family: 'mass', value: value * 1000, unit: 'g' }
  if (unit === 'g') return { family: 'mass', value, unit: 'g' }
  if (unit === 'L') return { family: 'volume', value: value * 1000, unit: 'ml' }
  if (unit === 'ml') return { family: 'volume', value, unit: 'ml' }
  return { family: unit || 'units', value, unit: unit || 'units' }
}

export function quantityTotals(logs, quantityField, inventoryById) {
  return logs.reduce((totals, log) => {
    const item = inventoryById.get(log.inventory_item_id)
    const normalized = normalizeQuantity(log[quantityField], item?.unit)
    totals[normalized.unit] = (totals[normalized.unit] || 0) + normalized.value
    return totals
  }, {})
}

export function totalNormalized(logs, quantityField, inventoryById) {
  return logs.reduce((sum, log) => {
    const item = inventoryById.get(log.inventory_item_id)
    return sum + normalizeQuantity(log[quantityField], item?.unit).value
  }, 0)
}

export function comparison(current, previous) {
  if (!previous) return { percent: null, direction: current > 0 ? 'new' : 'none', label: current > 0 ? 'New' : 'No previous data' }
  const percent = Math.round(Math.abs((current - previous) / previous) * 100)
  return { percent, direction: current > previous ? 'up' : current < previous ? 'down' : 'same', label: current === previous ? 'No change' : `${percent}% ${current > previous ? 'higher' : 'lower'} than previous period` }
}

function inRange(value, start, end) { const date = new Date(value); return date >= start && date <= end }

export function aggregateAnalytics({ inventory, wasteLogs, consumptionLogs, range }) {
  const inventoryById = new Map(inventory.map((item) => [item.id, item]))
  const currentWaste = wasteLogs.filter((log) => inRange(log.wasted_at, range.start, range.end))
  const previousWaste = wasteLogs.filter((log) => inRange(log.wasted_at, range.previousStart, range.previousEnd))
  const currentConsumption = consumptionLogs.filter((log) => inRange(log.consumed_at, range.start, range.end))
  const previousConsumption = consumptionLogs.filter((log) => inRange(log.consumed_at, range.previousStart, range.previousEnd))
  const wasteAmount = totalNormalized(currentWaste, 'quantity_wasted', inventoryById)
  const consumedAmount = totalNormalized(currentConsumption, 'quantity_consumed', inventoryById)
  const previousWasteAmount = totalNormalized(previousWaste, 'quantity_wasted', inventoryById)
  const previousConsumedAmount = totalNormalized(previousConsumption, 'quantity_consumed', inventoryById)
  const denominator = wasteAmount + consumedAmount
  const previousDenominator = previousWasteAmount + previousConsumedAmount
  const wasteRate = denominator ? wasteAmount / denominator * 100 : null
  const previousWasteRate = previousDenominator ? previousWasteAmount / previousDenominator * 100 : null
  const wasteValue = currentWaste.reduce((sum, log) => sum + Number(log.estimated_value || 0), 0)
  const affectedItems = new Set(currentWaste.map((log) => log.inventory_item_id)).size
  const byCategory = new Map(); const byFood = new Map()
  for (const log of currentWaste) {
    const item = inventoryById.get(log.inventory_item_id); const food = item?.food
    const amount = normalizeQuantity(log.quantity_wasted, item?.unit).value
    const category = food?.category || 'Other'; byCategory.set(category, (byCategory.get(category) || 0) + amount)
    const key = item?.food_id || log.inventory_item_id; const entry = byFood.get(key) || { foodId: key, name: food?.name || 'Unknown food', amount: 0, events: 0, purchases: new Set(), unit: normalizeQuantity(log.quantity_wasted, item?.unit).unit }
    entry.amount += amount; entry.events += 1; entry.purchases.add(log.inventory_item_id); byFood.set(key, entry)
  }
  const categoryTotal = [...byCategory.values()].reduce((sum, value) => sum + value, 0)
  const categories = [...byCategory.entries()].map(([name, amount]) => ({ name, amount, percent: categoryTotal ? amount / categoryTotal * 100 : 0 })).sort((a, b) => b.amount - a.amount)
  const topFoods = [...byFood.values()].map((entry) => ({ ...entry, purchaseCount: entry.purchases.size, recurring: entry.purchases.size >= RECURRING_WASTE_PURCHASES })).sort((a, b) => b.amount - a.amount).slice(0, 5)
  const recurring = topFoods.filter((food) => food.recurring)
  const overpurchase = detectOverpurchase(inventory, wasteLogs, consumptionLogs)
  const activityEvents = currentWaste.length + currentConsumption.length
  const performance = calculatePerformance({ wasteRate, previousWasteRate, recurringCount: recurring.length, activityEvents })
  return { currentWaste, currentConsumption, wasteTotals: quantityTotals(currentWaste, 'quantity_wasted', inventoryById), consumptionTotals: quantityTotals(currentConsumption, 'quantity_consumed', inventoryById), wasteAmount, consumedAmount, wasteRate, wasteValue, wasteEvents: currentWaste.length, affectedItems, wasteComparison: comparison(wasteAmount, previousWasteAmount), consumptionComparison: comparison(consumedAmount, previousConsumedAmount), categories, topFoods, recurring, overpurchase, performance, trend: buildTrend(currentWaste, currentConsumption, inventoryById, range) }
}

export function buildTrend(wasteLogs, consumptionLogs, inventoryById, range) {
  const weekly = range.days === 90
  const bucketCount = weekly ? 13 : range.days
  const buckets = Array.from({ length: bucketCount }, (_, index) => { const start = new Date(range.start); start.setDate(start.getDate() + index * (weekly ? 7 : 1)); const end = new Date(start); end.setDate(end.getDate() + (weekly ? 6 : 0)); end.setHours(23, 59, 59, 999); return { key: localDateKey(start), label: weekly ? `Week ${index + 1}` : start.toLocaleDateString('en', { month: 'short', day: 'numeric' }), start, end, wasted: 0, consumed: 0 } })
  for (const log of wasteLogs) { const bucket = buckets.find((entry) => inRange(log.wasted_at, entry.start, entry.end)); if (bucket) bucket.wasted += normalizeQuantity(log.quantity_wasted, inventoryById.get(log.inventory_item_id)?.unit).value }
  for (const log of consumptionLogs) { const bucket = buckets.find((entry) => inRange(log.consumed_at, entry.start, entry.end)); if (bucket) bucket.consumed += normalizeQuantity(log.quantity_consumed, inventoryById.get(log.inventory_item_id)?.unit).value }
  return buckets
}

export function detectOverpurchase(inventory, wasteLogs, consumptionLogs) {
  const groups = new Map()
  for (const item of inventory) { const key = `${item.food_id}:${item.unit}`; const group = groups.get(key) || { foodId: item.food_id, name: item.food?.name || 'Unknown food', purchases: [], purchased: 0, consumed: 0, wasted: 0 }; group.purchases.push(item.id); group.purchased += Number(item.quantity_purchased || 0); groups.set(key, group) }
  for (const group of groups.values()) { const ids = new Set(group.purchases); group.consumed = consumptionLogs.filter((log) => ids.has(log.inventory_item_id)).reduce((sum, log) => sum + Number(log.quantity_consumed || 0), 0); group.wasted = wasteLogs.filter((log) => ids.has(log.inventory_item_id)).reduce((sum, log) => sum + Number(log.quantity_wasted || 0), 0) }
  return [...groups.values()].filter((group) => group.purchases.length >= OVERPURCHASE_MIN_PURCHASES && group.purchased > 0 && group.consumed / group.purchased < 0.65 && group.wasted / group.purchased >= 0.15).map((group) => ({ ...group, purchaseCount: group.purchases.length }))
}

export function calculatePerformance({ wasteRate, previousWasteRate, recurringCount, activityEvents }) {
  if (wasteRate == null || activityEvents < 3) return { score: null, label: 'Building your baseline' }
  const trendBonus = previousWasteRate == null ? 0 : clamp(previousWasteRate - wasteRate, -10, 10)
  const score = Math.round(clamp(100 - wasteRate + trendBonus - recurringCount * 5))
  return { score, label: score >= 80 ? 'Excellent' : score >= 65 ? 'Improving' : score >= 45 ? 'Needs attention' : 'Priority area' }
}

export function formatQuantityTotals(totals) {
  const parts = Object.entries(totals).filter(([, value]) => value > 0).map(([unit, value]) => unit === 'g' && value >= 1000 ? `${(value / 1000).toFixed(1)} kg` : unit === 'ml' && value >= 1000 ? `${(value / 1000).toFixed(1)} L` : `${Number(value.toFixed(1)).toLocaleString()} ${unit}`)
  return parts.length ? parts.join(' + ') : 'No data yet'
}

export function currentAtRisk(inventory, predictions) {
  return inventory.filter((item) => item.status === 'active' && Number(predictions.get(item.id)?.risk_score || 0) >= 50).map((item) => ({ item, prediction: predictions.get(item.id), expiry: calculateEstimatedExpiry(item), days: daysUntil(calculateEstimatedExpiry(item)) }))
}
