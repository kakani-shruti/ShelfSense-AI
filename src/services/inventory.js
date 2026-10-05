import { isSupabaseConfigured, supabase } from '../lib/supabase'

const inventorySelect = `
  id, user_id, food_id, quantity_purchased, quantity_remaining, unit,
  purchase_date, storage_type, custom_expiry_date, purchase_price, status,
  notes, created_at, updated_at,
  food:foods(*)
`

function unconfigured() {
  return { data: null, error: new Error('Supabase is not configured.') }
}

export async function fetchInventory() {
  if (!isSupabaseConfigured) return unconfigured()
  return supabase.from('inventory_items').select(inventorySelect).order('purchase_date', { ascending: false })
}

export async function fetchInventoryItem(id) {
  if (!isSupabaseConfigured) return unconfigured()
  return supabase.from('inventory_items').select(inventorySelect).eq('id', id).single()
}

export async function createInventoryItem(values, userId) {
  if (!isSupabaseConfigured) return unconfigured()
  const quantity = Number(values.quantity_purchased)
  return supabase.from('inventory_items').insert({
    user_id: userId,
    food_id: values.food_id,
    quantity_purchased: quantity,
    quantity_remaining: quantity,
    unit: values.unit,
    purchase_date: values.purchase_date,
    storage_type: values.storage_type,
    purchase_price: values.purchase_price === '' ? null : Number(values.purchase_price),
    custom_expiry_date: values.custom_expiry_date || null,
    notes: values.notes.trim() || null,
  }).select('id').single()
}

export async function updateInventoryItem(id, values) {
  if (!isSupabaseConfigured) return unconfigured()
  const quantityRemaining = Number(values.quantity_remaining)
  const quantityPurchased = Math.max(Number(values.quantity_purchased), quantityRemaining)
  return supabase.from('inventory_items').update({
    quantity_purchased: quantityPurchased,
    quantity_remaining: quantityRemaining,
    unit: values.unit,
    purchase_date: values.purchase_date,
    storage_type: values.storage_type,
    purchase_price: values.purchase_price === '' ? null : Number(values.purchase_price),
    custom_expiry_date: values.custom_expiry_date || null,
    notes: values.notes.trim() || null,
    status: quantityRemaining === 0 ? 'consumed' : 'active',
  }).eq('id', id).select(inventorySelect).single()
}

export async function deleteInventoryItem(id) {
  if (!isSupabaseConfigured) return unconfigured()
  return supabase.from('inventory_items').delete().eq('id', id)
}

export async function recordConsumption(inventoryItemId, quantity, notes) {
  if (!isSupabaseConfigured) return unconfigured()
  return supabase.rpc('record_consumption', {
    p_inventory_item_id: inventoryItemId,
    p_quantity: Number(quantity),
    p_notes: notes.trim() || null,
  })
}

export async function recordWaste(inventoryItemId, quantity, reason, notes) {
  if (!isSupabaseConfigured) return unconfigured()
  return supabase.rpc('record_waste', {
    p_inventory_item_id: inventoryItemId,
    p_quantity: Number(quantity),
    p_reason: reason,
    p_notes: notes.trim() || null,
  })
}

