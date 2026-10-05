export const RECIPE_COUNT = 3
export const CACHE_HOURS = 24

const text = (value, min = 1, max = 1000) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max
const positiveInteger = (value, maximum) => Number.isInteger(value) && value > 0 && value <= maximum

export function validateRecipeResponse(payload) {
  const errors = []
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { valid: false, errors: ['Response must be an object.'] }
  if (!text(payload.insight, 10, 500)) errors.push('A concise insight is required.')
  if (!Array.isArray(payload.recipes) || payload.recipes.length !== RECIPE_COUNT) errors.push(`Exactly ${RECIPE_COUNT} recipes are required.`)
  for (const [index, recipe] of (payload.recipes || []).entries()) {
    const prefix = `Recipe ${index + 1}`
    if (!text(recipe?.title, 3, 120)) errors.push(`${prefix} title is invalid.`)
    if (!text(recipe?.description, 10, 500)) errors.push(`${prefix} description is invalid.`)
    if (!text(recipe?.rescue_reason, 10, 500)) errors.push(`${prefix} rescue reason is invalid.`)
    if (!positiveInteger(recipe?.servings, 20)) errors.push(`${prefix} servings are invalid.`)
    if (!Number.isInteger(recipe?.prep_minutes) || recipe.prep_minutes < 0 || recipe.prep_minutes > 600) errors.push(`${prefix} prep time is invalid.`)
    if (!Number.isInteger(recipe?.cook_minutes) || recipe.cook_minutes < 0 || recipe.cook_minutes > 600) errors.push(`${prefix} cook time is invalid.`)
    if (!['Easy', 'Medium'].includes(recipe?.difficulty)) errors.push(`${prefix} difficulty is invalid.`)
    if (!Array.isArray(recipe?.ingredients) || recipe.ingredients.length < 2 || recipe.ingredients.length > 30) errors.push(`${prefix} ingredients are invalid.`)
    for (const ingredient of recipe?.ingredients || []) {
      if (!text(ingredient?.name, 1, 100) || !text(ingredient?.quantity, 1, 100) || !['inventory', 'additional'].includes(ingredient?.source)) errors.push(`${prefix} has an invalid ingredient.`)
    }
    if (!Array.isArray(recipe?.instructions) || recipe.instructions.length < 2 || recipe.instructions.length > 20 || recipe.instructions.some((step) => !text(step, 3, 500))) errors.push(`${prefix} instructions are invalid.`)
    if (!text(recipe?.waste_reduction, 10, 500)) errors.push(`${prefix} waste reduction is invalid.`)
  }
  return { valid: errors.length === 0, errors }
}

export function parseGeminiResponse(body) {
  const raw = body?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim()
  if (!raw) throw new Error('Gemini returned an empty response.')
  let payload
  try { payload = JSON.parse(raw) } catch { throw new Error('Gemini returned malformed JSON.') }
  const validation = validateRecipeResponse(payload)
  if (!validation.valid) throw new Error(`Gemini response validation failed: ${validation.errors.join(' ')}`)
  return payload
}

export function authorizeInventory(userId, item) {
  if (!userId) return { allowed: false, reason: 'Authentication required.' }
  if (!item) return { allowed: false, reason: 'Inventory item not found.' }
  if (item.user_id !== userId) return { allowed: false, reason: 'Inventory item is not owned by this user.' }
  return { allowed: true }
}

export function canRescueItem(item, remainingDays) {
  if (!item || item.status !== 'active' || Number(item.quantity_remaining) <= 0) return { allowed: false, reason: 'Only active inventory can be rescued.' }
  if (remainingDays != null && remainingDays < 0) return { allowed: false, reason: 'Expired items cannot be used for rescue recipes.' }
  return { allowed: true }
}

export function splitIngredients(recipe) {
  return {
    inventory: recipe.ingredients.filter((ingredient) => ingredient.source === 'inventory'),
    additional: recipe.ingredients.filter((ingredient) => ingredient.source === 'additional'),
  }
}

export function cacheIsFresh(generatedAt, now = new Date()) {
  if (!generatedAt) return false
  return now - new Date(generatedAt) < CACHE_HOURS * 3_600_000
}
