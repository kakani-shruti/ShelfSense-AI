import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { validateRecipeResponse } from '../../supabase/functions/_shared/recipeValidation.js'

const recipeFields = 'id, title, description, ingredients, instructions, prep_time_minutes, cook_time_minutes, difficulty, servings, rescue_reason, waste_reduction, ai_insight, source_inventory_item_ids, generated_by, generated_at, created_at'
const legacyRecipeFields = 'id, title, description, ingredients, instructions, prep_time_minutes, generated_by, created_at'

const missingRecipeColumn = (error) => ['42703', 'PGRST204'].includes(error?.code)
const normalizeLegacyRecipe = (recipe) => ({
  ...recipe,
  cook_time_minutes: null,
  difficulty: null,
  servings: null,
  rescue_reason: null,
  waste_reduction: null,
  ai_insight: null,
  source_inventory_item_ids: [],
  generated_at: recipe.created_at,
})

export async function generateRescueRecipes(inventoryItemId) {
  if (!isSupabaseConfigured) return { data: null, error: new Error('Supabase is not configured.') }
  let timeoutId
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve({ data: null, error: new Error('Recipe generation took too long. Please try again.') }), 55_000)
  })
  const { data, error } = await Promise.race([
    supabase.functions.invoke('generate-rescue-recipe', { body: { inventory_item_id: inventoryItemId } }),
    timeout,
  ])
  clearTimeout(timeoutId)
  if (error) {
    let message = 'AI rescue is temporarily unavailable. Your waste-risk analysis is still working normally.'
    try {
      const payload = await error.context?.clone?.().json()
      if (typeof payload?.error === 'string') message = payload.error
    } catch { /* Keep the safe fallback when the function returns a non-JSON response. */ }
    return { data: null, error: new Error(message, { cause: error }) }
  }
  const payload = { insight: data?.insight, recipes: (data?.recipes || []).map((recipe) => ({ title: recipe.title, description: recipe.description, rescue_reason: recipe.rescue_reason, servings: recipe.servings, prep_minutes: recipe.prep_time_minutes, cook_minutes: recipe.cook_time_minutes, difficulty: recipe.difficulty, ingredients: recipe.ingredients, instructions: recipe.instructions, waste_reduction: recipe.waste_reduction })) }
  const validation = validateRecipeResponse(payload)
  if (!validation.valid) return { data: null, error: new Error('The AI response did not match the expected recipe format.') }
  return { data, error: null }
}

export async function fetchRecipes() {
  if (!isSupabaseConfigured) return { data: [], error: new Error('Supabase is not configured.') }
  const result = await supabase.from('recipes').select(recipeFields).order('generated_at', { ascending: false })
  if (!missingRecipeColumn(result.error)) return result
  const fallback = await supabase.from('recipes').select(legacyRecipeFields).order('created_at', { ascending: false })
  return fallback.error ? result : { data: (fallback.data || []).map(normalizeLegacyRecipe), error: null }
}

export async function fetchRecipesForInventoryItem(id) {
  if (!isSupabaseConfigured) return { data: [], error: new Error('Supabase is not configured.') }
  const result = await supabase.from('recipes').select(recipeFields).contains('source_inventory_item_ids', [id]).order('generated_at', { ascending: false }).limit(3)
  return missingRecipeColumn(result.error) ? { data: [], error: null } : result
}

export async function fetchRecipe(id) {
  if (!isSupabaseConfigured) return { data: null, error: new Error('Supabase is not configured.') }
  const result = await supabase.from('recipes').select(recipeFields).eq('id', id).single()
  if (!missingRecipeColumn(result.error)) return result
  const fallback = await supabase.from('recipes').select(legacyRecipeFields).eq('id', id).single()
  return fallback.error ? result : { data: normalizeLegacyRecipe(fallback.data), error: null }
}
