import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { aggregateAnalytics, getDateRanges } from '../utils/analytics'

export async function fetchAnalytics(days = 30) {
  if (!isSupabaseConfigured) return { data: null, error: new Error('Supabase is not configured.') }
  const range = getDateRanges(days)
  const earliest = range.previousStart.toISOString()
  const [inventoryResult, wasteResult, consumptionResult] = await Promise.all([
    supabase.from('inventory_items').select('*, food:foods(*)'),
    supabase.from('waste_logs').select('*').gte('wasted_at', earliest).lte('wasted_at', range.end.toISOString()).order('wasted_at'),
    supabase.from('consumption_logs').select('*').gte('consumed_at', earliest).lte('consumed_at', range.end.toISOString()).order('consumed_at'),
  ])
  const error = inventoryResult.error || wasteResult.error || consumptionResult.error
  if (error) return { data: null, error }
  return { data: { ...aggregateAnalytics({ inventory: inventoryResult.data || [], wasteLogs: wasteResult.data || [], consumptionLogs: consumptionResult.data || [], range }), inventory: inventoryResult.data || [], range }, error: null }
}

