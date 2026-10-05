import { isSupabaseConfigured, supabase } from '../lib/supabase'

export async function listFoods() {
  if (!isSupabaseConfigured) return { data: [], error: new Error('Supabase is not configured.') }
  return supabase.from('foods').select('*').order('category').order('name')
}
