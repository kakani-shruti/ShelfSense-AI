import { calculateEstimatedExpiry, daysUntil } from './inventory.js'

export const RISK_WEIGHTS = Object.freeze({
  expiry_pressure: 0.30,
  quantity_surplus: 0.30,
  consumption_pattern: 0.20,
  historical_waste: 0.15,
  purchase_quantity: 0.05,
})

export const PREDICTION_CONFIG = Object.freeze({
  historyWindowDays: 30,
  minimumConsumptionEvents: 2,
  minimumHistoricalPurchases: 3,
  staleAfterHours: 6,
})

const clamp = (value, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value))
const round = (value, digits = 0) => Number(value.toFixed(digits))

function expiryPressure(days) {
  if (days == null) return 35
  if (days <= 0) return 100
  if (days === 1) return 85
  if (days <= 3) return 65
  if (days <= 7) return 30
  if (days <= 14) return 12
  return 5
}

function riskLevel(score) {
  if (score < 25) return 'low'
  if (score < 50) return 'medium'
  if (score < 75) return 'high'
  return 'critical'
}

function recommendation(level) {
  return {
    low: 'You have enough time to consume this normally.',
    medium: 'Consider planning this food into your next meal.',
    high: 'Try to use this food within the next 1–2 days.',
    critical: 'Use this food as soon as possible to reduce the chance of waste.',
  }[level]
}

export function buildFoodHistory(item, allInventory, consumptionLogs, wasteLogs, now = new Date()) {
  const cutoff = new Date(now.getTime() - PREDICTION_CONFIG.historyWindowDays * 86_400_000)
  const matchingInventory = allInventory.filter((entry) => entry.food_id === item.food_id && entry.unit === item.unit && entry.id !== item.id)
  const matchingIds = new Set(matchingInventory.map((entry) => entry.id))
  const recentConsumption = consumptionLogs.filter((log) => matchingIds.has(log.inventory_item_id) && new Date(log.consumed_at) >= cutoff)
  const consumptionQuantity = recentConsumption.reduce((sum, log) => sum + Number(log.quantity_consumed), 0)
  const consumptionRate = recentConsumption.length >= PREDICTION_CONFIG.minimumConsumptionEvents
    ? consumptionQuantity / PREDICTION_CONFIG.historyWindowDays
    : null
  const purchasedQuantity = matchingInventory.reduce((sum, entry) => sum + Number(entry.quantity_purchased), 0)
  const wastedQuantity = wasteLogs.filter((log) => matchingIds.has(log.inventory_item_id)).reduce((sum, log) => sum + Number(log.quantity_wasted), 0)
  return {
    consumptionEventCount: recentConsumption.length,
    consumptionRate,
    purchaseCount: matchingInventory.length,
    averagePurchaseQuantity: matchingInventory.length ? purchasedQuantity / matchingInventory.length : null,
    wasteRate: matchingInventory.length >= PREDICTION_CONFIG.minimumHistoricalPurchases && purchasedQuantity > 0 ? clamp(wastedQuantity / purchasedQuantity, 0, 1) : null,
  }
}

export function calculateWasteRisk(item, history = {}, now = new Date()) {
  if (item.status !== 'active' || Number(item.quantity_remaining) <= 0) return null
  const expiry = calculateEstimatedExpiry(item)
  const remainingDays = daysUntil(expiry, now)
  const remaining = Number(item.quantity_remaining)
  const purchased = Number(item.quantity_purchased)
  const fallbackDays = Math.max(1, daysUntil(calculateEstimatedExpiry({ ...item, purchase_date: item.purchase_date }), new Date(`${item.purchase_date}T12:00:00`)) ?? 7)
  const hasPersonalConsumption = history.consumptionRate != null && history.consumptionRate > 0
  const dailyRate = hasPersonalConsumption ? history.consumptionRate : purchased / fallbackDays
  const consumableDays = remainingDays == null ? 7 : Math.max(0, remainingDays)
  const expectedConsumption = dailyRate * consumableDays
  const surplus = Math.max(0, remaining - expectedConsumption)
  const surplusFactor = remaining > 0 ? clamp((surplus / remaining) * 100) : 0
  const requiredDailyRate = remaining / Math.max(1, consumableDays)
  const consumptionFactor = hasPersonalConsumption ? clamp((1 - dailyRate / requiredDailyRate) * 100) : 45
  const wasteFactor = history.wasteRate == null ? 10 : clamp(history.wasteRate * 100)
  const purchaseRatio = history.averagePurchaseQuantity ? purchased / history.averagePurchaseQuantity : null
  const purchaseFactor = purchaseRatio == null ? 25 : clamp((purchaseRatio - 0.75) * 65)
  const factors = {
    expiry_pressure: expiryPressure(remainingDays),
    quantity_surplus: round(surplusFactor),
    consumption_pattern: round(consumptionFactor),
    historical_waste: round(wasteFactor),
    purchase_quantity: round(purchaseFactor),
  }
  const score = clamp(round(Object.entries(RISK_WEIGHTS).reduce((sum, [key, weight]) => sum + factors[key] * weight, 0)))
  const level = riskLevel(score)
  const reasons = []
  if (remainingDays == null) reasons.push('No shelf-life estimate is available, so expiry pressure is estimated conservatively')
  else if (remainingDays < 0) reasons.push(`The estimated expiry passed ${Math.abs(remainingDays)} ${Math.abs(remainingDays) === 1 ? 'day' : 'days'} ago`)
  else if (remainingDays <= 3) reasons.push(`${remainingDays === 0 ? 'The estimated expiry is today' : `Only ${remainingDays} ${remainingDays === 1 ? 'day remains' : 'days remain'} before estimated expiry`}`)
  else reasons.push(`${remainingDays} days remain before estimated expiry`)
  if (surplusFactor >= 50) reasons.push(`${round(surplus, 1)} ${item.unit} may remain at the current consumption rate`)
  else if (surplusFactor > 10) reasons.push('Some quantity may remain by the estimated expiry')
  else reasons.push('The remaining quantity appears manageable before estimated expiry')
  if (hasPersonalConsumption) reasons.push(`Your recent consumption rate is about ${round(dailyRate, 1)} ${item.unit} per day`)
  else reasons.push('Limited personal consumption history is available, so shelf life and quantity carry more influence')
  if (history.wasteRate != null && history.wasteRate >= 0.2) reasons.push(`Past purchases of this food show a ${round(history.wasteRate * 100)}% waste rate`)
  if (purchaseRatio != null && purchaseRatio > 1.25) reasons.push('This purchase is larger than your usual purchase of this food')
  return {
    inventory_item_id: item.id,
    risk_score: score,
    risk_level: level,
    predicted_at: now.toISOString(),
    explanation: reasons,
    contributing_factors: { ...factors, remaining_days: remainingDays, estimated_daily_consumption: round(dailyRate, 2), expected_surplus: round(surplus, 2), uses_personal_consumption: hasPersonalConsumption },
    recommendation: recommendation(level),
  }
}

export function predictionIsStale(prediction, item, now = new Date()) {
  if (!prediction) return true
  const predictedAt = new Date(prediction.predicted_at)
  return now - predictedAt > PREDICTION_CONFIG.staleAfterHours * 3_600_000 || new Date(item.updated_at) > predictedAt
}

export function riskLabel(level) {
  return level === 'medium' ? 'Moderate Risk' : `${level.charAt(0).toUpperCase()}${level.slice(1)} Risk`
}
