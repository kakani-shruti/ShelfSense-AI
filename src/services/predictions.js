import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { buildFoodHistory, calculateWasteRisk, predictionIsStale } from '../utils/prediction'

function normalizePrediction(prediction) {
  if (!prediction) return null
  let explanation = prediction.explanation
  if (typeof explanation === 'string') {
    try { explanation = JSON.parse(explanation) } catch { explanation = explanation ? [explanation] : [] }
  }
  return { ...prediction, explanation: explanation || [] }
}

export async function ensurePredictions(targetItems = null, force = false) {
  if (!isSupabaseConfigured) return { data: new Map(), error: new Error('Supabase is not configured.') }
  const [inventoryResult, consumptionResult, wasteResult, predictionResult, userResult] = await Promise.all([
    supabase.from('inventory_items').select('*, food:foods(*)'),
    supabase.from('consumption_logs').select('*'),
    supabase.from('waste_logs').select('*'),
    supabase.from('predictions').select('*'),
    supabase.auth.getUser(),
  ])
  const error = inventoryResult.error || consumptionResult.error || wasteResult.error || predictionResult.error || userResult.error
  if (error) return { data: new Map(), error }
  const allInventory = inventoryResult.data || []
  const targets = (targetItems || allInventory).filter((item) => item.status === 'active' && Number(item.quantity_remaining) > 0)
  const existing = new Map((predictionResult.data || []).map((entry) => [entry.inventory_item_id, normalizePrediction(entry)]))
  const results = new Map()
  const updates = []
  for (const item of targets) {
    const current = existing.get(item.id)
    if (!force && !predictionIsStale(current, item)) { results.set(item.id, current); continue }
    const history = buildFoodHistory(item, allInventory, consumptionResult.data || [], wasteResult.data || [])
    const calculated = calculateWasteRisk(item, history)
    if (!calculated) continue
    const row = { ...calculated, user_id: userResult.data.user.id, explanation: JSON.stringify(calculated.explanation) }
    updates.push(row)
    results.set(item.id, calculated)
  }
  if (updates.length) {
    const { data, error: upsertError } = await supabase.from('predictions').upsert(updates, { onConflict: 'inventory_item_id' }).select('*')
    if (upsertError) return { data: results, error: upsertError }
    for (const entry of data || []) results.set(entry.inventory_item_id, normalizePrediction(entry))
  }
  const activeIds = new Set(allInventory.filter((item) => item.status === 'active' && Number(item.quantity_remaining) > 0).map((item) => item.id))
  const obsoleteIds = (predictionResult.data || []).filter((entry) => !activeIds.has(entry.inventory_item_id)).map((entry) => entry.inventory_item_id)
  if (obsoleteIds.length) await supabase.from('predictions').delete().in('inventory_item_id', obsoleteIds)
  return { data: results, error: null }
}

export async function fetchPredictionForItem(item, force = false) {
  const result = await ensurePredictions([item], force)
  return { data: result.data.get(item.id) || null, error: result.error }
}
