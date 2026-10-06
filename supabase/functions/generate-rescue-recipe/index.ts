import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authorizeInventory, cacheIsFresh, canRescueItem, parseGeminiResponse, validateRecipeResponse } from '../_shared/recipeValidation.js'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const shelfField: Record<string, string> = { room_temperature: 'room_temperature_shelf_life_days', refrigerator: 'refrigerated_shelf_life_days', freezer: 'frozen_shelf_life_days' }

function estimatedExpiry(item: Record<string, any>) {
  if (item.custom_expiry_date) return item.custom_expiry_date
  const days = item.food?.[shelfField[item.storage_type]]
  if (days == null) return null
  const date = new Date(`${item.purchase_date}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + Number(days))
  return date.toISOString().slice(0, 10)
}

function daysRemaining(date: string | null) {
  if (!date) return null
  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  return Math.ceil((new Date(`${date}T00:00:00Z`).getTime() - today.getTime()) / 86_400_000)
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const ingredientSchema = { type: 'object', properties: { name: { type: 'string' }, quantity: { type: 'string' }, source: { type: 'string', enum: ['inventory', 'additional'] } }, required: ['name', 'quantity', 'source'] }
const recipeSchema = { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, rescue_reason: { type: 'string' }, servings: { type: 'integer' }, prep_minutes: { type: 'integer' }, cook_minutes: { type: 'integer' }, difficulty: { type: 'string', enum: ['Easy', 'Medium'] }, ingredients: { type: 'array', items: ingredientSchema }, instructions: { type: 'array', items: { type: 'string' } }, waste_reduction: { type: 'string' } }, required: ['title', 'description', 'rescue_reason', 'servings', 'prep_minutes', 'cook_minutes', 'difficulty', 'ingredients', 'instructions', 'waste_reduction'] }
const responseSchema = { type: 'object', properties: { insight: { type: 'string' }, recipes: { type: 'array', minItems: 3, maxItems: 3, items: recipeSchema } }, required: ['insight', 'recipes'] }

class GeminiRequestError extends Error {
  status: number
  code: string | null
  retryAfterSeconds: number | null
  constructor(status: number, detail: string, retryAfter: string | null = null) {
    super(`Gemini request failed with status ${status}: ${detail.slice(0, 500)}`)
    this.name = 'GeminiRequestError'
    this.status = status
    const retrySeconds = Number(retryAfter)
    this.retryAfterSeconds = Number.isFinite(retrySeconds) && retrySeconds > 0 ? retrySeconds : null
    try { this.code = JSON.parse(detail)?.error?.status || null } catch { this.code = null }
  }
}

const transientGeminiStatus = (status: number) => status === 408 || status === 429 || status >= 500
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function buildPrompt(primary: Record<string, any>, prediction: Record<string, any>, inventory: Record<string, any>[]) {
  const expiry = estimatedExpiry(primary)
  const available = inventory.filter((item) => item.id !== primary.id).slice(0, 20).map((item) => ({ name: item.food?.name, quantity: item.quantity_remaining, unit: item.unit, estimated_expiry: estimatedExpiry(item) }))
  let reasons: string[] = []
  try { reasons = JSON.parse(prediction?.explanation || '[]') } catch { reasons = prediction?.explanation ? [prediction.explanation] : [] }
  return `You are ShelfSense AI's food-rescue assistant. Generate exactly three meaningfully different practical recipes: a quick rescue, an everyday meal, and a creative option.

Rules:
- Prioritize the at-risk food and use a meaningful portion where practical.
- Prefer foods listed in available inventory and label those ingredients source "inventory".
- Never claim an unlisted ingredient is available; label it source "additional".
- Minimize additional purchases. Keep recipes realistic for an ordinary home cook.
- Do not calculate or alter the supplied risk score.
- Do not claim food is safe. Shelf-life dates are application estimates, not safety guarantees.
- No medical or unsupported food-safety claims. Return structured JSON only.

At-risk food: ${JSON.stringify({ name: primary.food?.name, category: primary.food?.category, quantity: primary.quantity_remaining, unit: primary.unit, storage: primary.storage_type, estimated_expiry: expiry, days_remaining: daysRemaining(expiry), risk_score: prediction?.risk_score, risk_level: prediction?.risk_level, risk_reasons: reasons })}
Available inventory: ${JSON.stringify(available)}`
}

function normalizeModelName(value: string) {
  const name = value.replace(/^models\//, '')
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) throw new Error('Gemini returned an invalid model name.')
  return name
}

async function discoverGeminiModels(apiKey: string, excludedModel: string) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {
    signal: AbortSignal.timeout(10_000),
    headers: { 'x-goog-api-key': apiKey },
  })
  if (!response.ok) throw new GeminiRequestError(response.status, await response.text())
  const payload = await response.json()
  const excluded = normalizeModelName(excludedModel)
  const candidates = (payload.models || [])
    .filter((model: Record<string, any>) => model.supportedGenerationMethods?.includes('generateContent'))
    .map((model: Record<string, any>) => normalizeModelName(String(model.name || '')))
    .filter((name: string) => name !== excluded && name.startsWith('gemini-') && !/(embedding|imagen|veo|aqa|live|tts|image)/i.test(name))
    .sort((a: string, b: string) => {
      const score = (name: string) => {
        let value = /-flash$/i.test(name) ? 500 : /flash/i.test(name) ? 400 : /pro/i.test(name) ? 200 : 0
        if (/latest/i.test(name)) value += 100
        if (/(preview|experimental|exp)/i.test(name)) value -= 150
        if (/lite/i.test(name)) value -= 25
        return value
      }
      return score(b) - score(a) || b.localeCompare(a, undefined, { numeric: true })
    })
  if (!candidates.length) throw new GeminiRequestError(404, 'No available Gemini model supports generateContent.')
  return candidates
}

async function callGemini(apiKey: string, model: string, prompt: string, repair = false, structured = true) {
  const generationConfig: Record<string, unknown> = { responseMimeType: 'application/json', temperature: repair ? 0.35 : 0.65, maxOutputTokens: 4096 }
  if (structured) generationConfig.responseSchema = responseSchema
  const requestBody = JSON.stringify({ systemInstruction: { parts: [{ text: 'Follow the food-rescue rules exactly. Never output markdown.' }] }, contents: [{ role: 'user', parts: [{ text: repair ? `${prompt}\nThe previous response was incomplete or invalid. Return one complete JSON object containing exactly three valid recipes.` : prompt }] }], generationConfig })
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${normalizeModelName(model)}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(25_000), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: requestBody,
    })
    if (response.ok) return response.json()
    const error = new GeminiRequestError(response.status, await response.text(), response.headers.get('retry-after'))
    lastError = error
    if (attempt === 1 || !transientGeminiStatus(error.status)) throw error
    const seconds = error.retryAfterSeconds ?? (error.status === 429 ? 8 : 2)
    await delay(Math.min(seconds, 12) * 1000)
  }
  throw lastError || new Error('Gemini request failed without a response.')
}

async function generateValidRecipes(apiKey: string, model: string, prompt: string) {
  try {
    // JSON mode is more portable across Gemini models than responseSchema.
    // The payload is still strictly checked by validateRecipeResponse below.
    return parseGeminiResponse(await callGemini(apiKey, model, prompt, false, false))
  } catch (firstError) {
    if (firstError instanceof DOMException && firstError.name === 'TimeoutError') throw firstError
    if (firstError instanceof GeminiRequestError) throw firstError
    console.warn('Recipe response validation failed; retrying with a stricter prompt.', firstError instanceof Error ? firstError.message : 'Unknown validation error')
    return parseGeminiResponse(await callGemini(apiKey, model, prompt, true, false))
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!supabaseUrl || !anonKey) return json({ error: 'Function configuration is incomplete.' }, 500)
    if (!geminiKey) return json({ error: 'AI rescue is not configured.' }, 503)
    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
    const { data: userData, error: userError } = await client.auth.getUser(authHeader.slice(7))
    if (userError || !userData.user) return json({ error: 'Authentication required.' }, 401)
    let body: Record<string, unknown>
    try { body = await request.json() } catch { return json({ error: 'Invalid JSON payload.' }, 400) }
    if (typeof body.inventory_item_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.inventory_item_id)) return json({ error: 'A valid inventory item ID is required.' }, 400)
    const [{ data: primary, error: primaryError }, { data: inventory, error: inventoryError }, { data: prediction, error: predictionError }] = await Promise.all([
      client.from('inventory_items').select('*, food:foods(*)').eq('id', body.inventory_item_id).maybeSingle(),
      client.from('inventory_items').select('*, food:foods(*)').eq('status', 'active').gt('quantity_remaining', 0),
      client.from('predictions').select('*').eq('inventory_item_id', body.inventory_item_id).maybeSingle(),
    ])
    if (primaryError || inventoryError || predictionError) {
      console.error('Recipe context query failed.', primaryError || inventoryError || predictionError)
      return json({ error: 'Recipe context is unavailable. Apply the latest database migration and try again.' }, 500)
    }
    const authorization = authorizeInventory(userData.user.id, primary)
    if (!authorization.allowed) return json({ error: authorization.reason }, primary ? 403 : 404)
    if (!primary.food) return json({ error: 'Inventory context is unavailable.' }, 422)
    const expiry = estimatedExpiry(primary); const remaining = daysRemaining(expiry)
    const rescueCheck = canRescueItem(primary, remaining)
    if (!rescueCheck.allowed) return json({ error: rescueCheck.reason }, 422)
    const signatureInput = [primary.id, primary.updated_at, prediction?.predicted_at, ...(inventory || []).map((item) => `${item.id}:${item.updated_at}`).sort()].join('|')
    const signature = await sha256(signatureInput)
    const { data: cached } = await client.from('recipes').select('*').eq('context_signature', signature).eq('generated_by', 'gemini').order('generated_at', { ascending: false }).limit(3)
    if (cached?.length === 3 && cacheIsFresh(cached[0].generated_at)) return json({ recipes: cached, insight: cached[0].ai_insight, cached: true })
    const prompt = buildPrompt(primary, prediction, inventory || [])
    const preferredModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash-lite'
    let generated
    let generationError: unknown
    const attemptedModels = new Set<string>()
    const tryModel = async (model: string) => {
      attemptedModels.add(normalizeModelName(model))
      console.info(`Trying Gemini model: ${normalizeModelName(model)}`)
      return generateValidRecipes(geminiKey, model, prompt)
    }
    const stableModels = [preferredModel, 'gemini-2.5-flash-lite', 'gemini-2.5-flash']
    let candidates = [...new Set(stableModels.map(normalizeModelName))]
    let addedDiscoveredModel = false
    for (let index = 0; index < candidates.length; index += 1) {
      const model = candidates[index]
      try {
        generated = await tryModel(model)
        generationError = null
        break
      } catch (modelError) {
        generationError = modelError
        if (!(modelError instanceof GeminiRequestError) || !(modelError.status === 404 || transientGeminiStatus(modelError.status))) throw modelError
        if (index === candidates.length - 1 && !addedDiscoveredModel) {
          addedDiscoveredModel = true
          const discovered = await discoverGeminiModels(geminiKey, preferredModel)
          candidates = [...candidates, ...discovered.filter((name: string) => !attemptedModels.has(name)).slice(0, 1)]
        }
      }
    }
    if (!generated) throw generationError || new Error('Gemini generation failed without a response.')
    const validation = validateRecipeResponse(generated)
    if (!validation.valid) return json({ error: 'AI returned an invalid recipe response.' }, 502)
    const generationId = crypto.randomUUID()
    const rows = generated.recipes.map((recipe: Record<string, any>) => ({ user_id: userData.user.id, title: recipe.title, description: recipe.description, ingredients: recipe.ingredients, instructions: recipe.instructions, prep_time_minutes: recipe.prep_minutes, cook_time_minutes: recipe.cook_minutes, difficulty: recipe.difficulty, servings: recipe.servings, rescue_reason: recipe.rescue_reason, waste_reduction: recipe.waste_reduction, ai_insight: generated.insight, source_inventory_item_ids: [primary.id], context_signature: signature, generation_id: generationId, generated_by: 'gemini' }))
    const { data: saved, error: saveError } = await client.from('recipes').insert(rows).select('*')
    if (saveError) {
      console.error('Generated recipe save failed.', saveError)
      return json({ error: 'Recipes were generated but could not be saved. Apply database migration 009 and try again.' }, 500)
    }
    return json({ recipes: saved, insight: generated.insight, cached: false })
  } catch (error) {
    console.error('Recipe generation failed:', error instanceof Error ? error.message : 'Unknown error')
    if (error instanceof DOMException && error.name === 'TimeoutError') return json({ error: 'AI rescue timed out. Please try again.' }, 504)
    if (error instanceof GeminiRequestError) {
      if (error.status === 401 || error.status === 403 || error.code === 'PERMISSION_DENIED') return json({ error: 'Gemini rejected the configured API key or API access. Verify GEMINI_API_KEY and that the Gemini API is enabled for its Google project.' }, 502)
      if (error.status === 400 && error.code === 'FAILED_PRECONDITION') return json({ error: 'Gemini requires billing for requests from this region. Enable billing for the API key’s Google project and try again.' }, 502)
      if (error.status === 400) return json({ error: 'Gemini rejected the recipe request. Verify the configured API key and model, then try again.' }, 502)
      if (error.status === 404) return json({ error: 'No text-generation model is available to this Gemini API project. Enable the Gemini API for the key’s project and try again.' }, 502)
      if (error.status === 429) return json({ error: 'Gemini rate limit or quota was reached. Wait briefly or check the API project quota, then try again.' }, 429)
      console.error('Gemini API failure.', error.message)
      return json({ error: `Gemini is unavailable (upstream status ${error.status}). Please try again shortly.` }, 502)
    }
    return json({ error: 'AI rescue is temporarily unavailable. Your waste-risk analysis is still working normally.' }, 500)
  }
})
