import test from 'node:test'
import assert from 'node:assert/strict'
import { authorizeInventory, cacheIsFresh, canRescueItem, parseGeminiResponse, splitIngredients, validateRecipeResponse } from '../../supabase/functions/_shared/recipeValidation.js'

const recipe = { title: 'Tomato Rescue Pasta', description: 'A practical meal using ripe tomatoes before they go unused.', rescue_reason: 'Uses a substantial portion of the at-risk tomatoes.', servings: 2, prep_minutes: 10, cook_minutes: 20, difficulty: 'Easy', ingredients: [{ name: 'Tomatoes', quantity: '500 g', source: 'inventory' }, { name: 'Pasta', quantity: '200 g', source: 'additional' }], instructions: ['Chop and cook the tomatoes.', 'Combine with cooked pasta.'], waste_reduction: 'Uses approximately 500 g of at-risk tomatoes.' }
const valid = { insight: 'Using the tomatoes in a cooked meal today can reduce the likely surplus.', recipes: [recipe, { ...recipe, title: 'Tomato Soup' }, { ...recipe, title: 'Tomato Tray Bake' }] }

test('accepts a valid three-recipe generation payload', () => assert.equal(validateRecipeResponse(valid).valid, true))
test('rejects malformed and empty recipe responses safely', () => {
  assert.equal(validateRecipeResponse(null).valid, false)
  assert.throws(() => parseGeminiResponse({ candidates: [{ content: { parts: [{ text: '{bad' }] } }] }), /malformed JSON/)
  assert.throws(() => parseGeminiResponse({ candidates: [] }), /empty response/)
})
test('rejects a response that does not contain three recipes', () => assert.equal(validateRecipeResponse({ ...valid, recipes: [recipe] }).valid, false))
test('maps inventory and additional ingredients separately', () => {
  const groups = splitIngredients(recipe)
  assert.equal(groups.inventory[0].name, 'Tomatoes')
  assert.equal(groups.additional[0].name, 'Pasta')
})
test('enforces authenticated inventory ownership', () => {
  assert.equal(authorizeInventory(null, { user_id: 'user-a' }).allowed, false)
  assert.equal(authorizeInventory('user-a', { user_id: 'user-b' }).allowed, false)
  assert.equal(authorizeInventory('user-a', { user_id: 'user-a' }).allowed, true)
})
test('rejects expired and inactive items', () => {
  assert.equal(canRescueItem({ status: 'active', quantity_remaining: 10 }, -1).allowed, false)
  assert.equal(canRescueItem({ status: 'wasted', quantity_remaining: 10 }, 2).allowed, false)
  assert.equal(canRescueItem({ status: 'active', quantity_remaining: 10 }, 2).allowed, true)
})
test('recognizes fresh and stale cache entries', () => {
  const now = new Date('2026-10-05T12:00:00Z')
  assert.equal(cacheIsFresh('2026-10-05T01:00:00Z', now), true)
  assert.equal(cacheIsFresh('2026-10-03T01:00:00Z', now), false)
})
test('parses a valid structured Gemini response', () => {
  const parsed = parseGeminiResponse({ candidates: [{ content: { parts: [{ text: JSON.stringify(valid) }] } }] })
  assert.equal(parsed.recipes.length, 3)
})
