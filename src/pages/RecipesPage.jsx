import { AlertTriangle, ChefHat, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '../components/LoadingState'
import RecipeCard from '../components/RecipeCard'
import StateMessage from '../components/StateMessage'
import { fetchRecipes } from '../services/recipes'

export default function RecipesPage() {
  const [recipes, setRecipes] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false)
  const load = useCallback(async () => { setLoading(true); setError(false); const result = await fetchRecipes(); if (result.error) { console.error('Recipe library load failed', result.error); setError(true) } else setRecipes(result.data || []); setLoading(false) }, [])
  useEffect(() => { load() }, [load])
  return <section className="page recipes-page"><div className="page-heading"><div><p className="eyebrow">AI rescue kitchen</p><h1>Rescue Recipes</h1><p className="lede">Practical ideas generated around food that needs your attention.</p></div><span className="ai-label"><Sparkles size={15} />Powered by Gemini</span></div>{loading ? <LoadingState /> : error ? <StateMessage icon={AlertTriangle} variant="error" title="We couldn’t load your recipes" message="Your inventory and risk analysis are still available." action={<button onClick={load}>Retry</button>} /> : recipes.length === 0 ? <div className="inventory-empty"><span className="empty-icon"><ChefHat /></span><h2>Your AI rescue kitchen is ready.</h2><p>Recipes will appear here when you ask ShelfSense to rescue food that needs attention.</p></div> : <div className="recipe-library">{recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}</div>}</section>
}

