import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { buildNotificationCandidates } from '../utils/notifications'

export async function generateNotifications(context, userId) {
  if (!isSupabaseConfigured) return { data: [], error: new Error('Supabase is not configured.') }
  const candidates = buildNotificationCandidates(context)
  if (!candidates.length) return { data: [], error: null }
  const cutoff = new Date(Date.now() - 24 * 3_600_000).toISOString()
  const { data: existing, error: lookupError } = await supabase.from('notifications').select('dedupe_key, created_at').gte('created_at', cutoff)
  if (lookupError) return { data: [], error: lookupError }
  const recentSubjects = new Set((existing || []).map((entry) => entry.dedupe_key?.split(':').slice(0, -1).join(':')))
  const rows = candidates.filter((entry) => !recentSubjects.has(entry.dedupe_key.split(':').slice(0, -1).join(':'))).map((entry) => ({ ...entry, user_id: userId }))
  if (!rows.length) return { data: [], error: null }
  return supabase.from('notifications').insert(rows).select('*')
}

export async function fetchNotifications() {
  if (!isSupabaseConfigured) return { data: [], error: new Error('Supabase is not configured.') }
  return supabase.from('notifications').select('*, inventory_item:inventory_items(id, food:foods(name))').order('is_read').order('created_at', { ascending: false })
}

export async function markNotificationRead(id) {
  return supabase.from('notifications').update({ is_read: true }).eq('id', id)
}

export async function markAllNotificationsRead() {
  return supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
}
