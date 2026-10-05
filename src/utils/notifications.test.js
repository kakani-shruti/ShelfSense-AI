import test from 'node:test'
import assert from 'node:assert/strict'
import { applyReadState, buildNotificationCandidates, isWithinCooldown, notificationKey, notificationPriority } from './notifications.js'

const now = new Date(2026, 9, 5, 12)
const item = { id: 'item-a', food: { name: 'Tomato' } }

test('assigns deterministic critical, high, medium, and low priorities', () => {
  assert.equal(notificationPriority('high_risk', { riskScore: 80 }), 'critical')
  assert.equal(notificationPriority('high_risk', { riskScore: 60 }), 'high')
  assert.equal(notificationPriority('recurring_waste'), 'medium')
  assert.equal(notificationPriority('improvement'), 'low')
})

test('generates actionable high-risk, recurring, over-purchase, and improvement notifications', () => {
  const result = buildNotificationCandidates({ atRisk: [{ item, prediction: { risk_score: 82 }, days: 2 }], recurring: [{ foodId: 'food-a', name: 'Tomato', purchaseCount: 3 }], overpurchase: [{ foodId: 'food-b', name: 'Bread' }], wasteComparison: { direction: 'down', percent: 18 }, now })
  assert.equal(result.length, 4)
  assert.equal(result[0].action_path, '/inventory/item-a?rescue=1#rescue')
  assert.equal(result[1].action_path, '/analytics')
})

test('dedupe keys are stable within a local calendar day and change the next day', () => {
  assert.equal(notificationKey('high_risk', 'item-a', now), notificationKey('high_risk', 'item-a', new Date(2026, 9, 5, 23)))
  assert.notEqual(notificationKey('high_risk', 'item-a', now), notificationKey('high_risk', 'item-a', new Date(2026, 9, 6, 1)))
})

test('24-hour cooldown distinguishes recent and stale notifications', () => {
  assert.equal(isWithinCooldown('2026-10-05T01:00:00Z', new Date('2026-10-05T12:00:00Z')), true)
  assert.equal(isWithinCooldown('2026-10-03T01:00:00Z', new Date('2026-10-05T12:00:00Z')), false)
})

test('missing optional patterns produce no fabricated notifications', () => {
  assert.deepEqual(buildNotificationCandidates({ atRisk: [], recurring: [], overpurchase: [], wasteComparison: null, now }), [])
})

test('read-state updates can target one notification or all without refetching', () => {
  const entries = [{ id: 'a', is_read: false }, { id: 'b', is_read: false }]
  assert.deepEqual(applyReadState(entries, 'a').map((entry) => entry.is_read), [true, false])
  assert.deepEqual(applyReadState(entries).map((entry) => entry.is_read), [true, true])
})
