import { localDateKey } from './analytics.js'

export const NOTIFICATION_COOLDOWN_HOURS = 24

export function notificationPriority(type, context = {}) {
  if (type === 'expired' || Number(context.riskScore) >= 75) return 'critical'
  if (type === 'high_risk' || type === 'rescue') return 'high'
  if (['expiry', 'recurring_waste', 'overpurchase'].includes(type)) return 'medium'
  return 'low'
}

export function notificationKey(type, entityId, now = new Date()) {
  return `${type}:${entityId || 'general'}:${localDateKey(now)}`
}

export function buildNotificationCandidates({ atRisk = [], recurring = [], overpurchase = [], wasteComparison, now = new Date() }) {
  const candidates = []
  for (const { item, prediction, days } of atRisk.slice(0, 5)) {
    const type = days != null && days < 0 ? 'expired' : Number(prediction.risk_score) >= 50 ? 'high_risk' : 'expiry'
    const title = type === 'expired' ? `${item.food.name} is past its estimate` : `${item.food.name} needs attention`
    const message = type === 'expired' ? `Review this item before deciding what to do.` : `${item.food.name} has a ${Math.round(prediction.risk_score)} Waste Risk Score and should be used soon.`
    candidates.push({ inventory_item_id: item.id, type, title, message, priority: notificationPriority(type, { riskScore: prediction.risk_score }), action_path: type === 'expired' ? `/inventory/${item.id}` : `/inventory/${item.id}?rescue=1#rescue`, dedupe_key: notificationKey(type, item.id, now) })
  }
  for (const food of recurring.slice(0, 3)) candidates.push({ inventory_item_id: null, type: 'recurring_waste', title: `Recurring waste: ${food.name}`, message: `${food.name} was wasted across ${food.purchaseCount} separate purchases.`, priority: 'medium', action_path: '/analytics', dedupe_key: notificationKey('recurring_waste', food.foodId, now) })
  for (const food of overpurchase.slice(0, 3)) candidates.push({ inventory_item_id: null, type: 'overpurchase', title: `Review how much ${food.name} you buy`, message: `Recent purchases have been larger than the amount recorded as consumed.`, priority: 'medium', action_path: '/analytics', dedupe_key: notificationKey('overpurchase', food.foodId, now) })
  if (wasteComparison?.direction === 'down' && wasteComparison.percent >= 10) candidates.push({ inventory_item_id: null, type: 'improvement', title: 'Your food waste is improving', message: `Recorded waste is ${wasteComparison.percent}% lower than the previous period.`, priority: 'low', action_path: '/analytics', dedupe_key: notificationKey('improvement', 'waste', now) })
  return candidates
}

export function isWithinCooldown(createdAt, now = new Date()) {
  return now - new Date(createdAt) < NOTIFICATION_COOLDOWN_HOURS * 3_600_000
}

export function applyReadState(notifications, id = null) {
  return notifications.map((entry) => id == null || entry.id === id ? { ...entry, is_read: true } : entry)
}
