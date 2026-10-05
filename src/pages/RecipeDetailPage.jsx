import { ArrowLeft, ChefHat, Clock3, Lightbulb, ShoppingBasket, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import StateMessage from '../components/StateMessage'
import { fetchRecipe } from '../services/recipes'
import { splitIngredients } from '../../supabase/functions/_shared/recipeValidation.js'

export default function RecipeDetailPage() {
  const { id } = useParams(); const [recipe, setRecipe] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(false)
  useEffect(() => { fetchRecipe(id).then((result) => { if (result.error) { console.error('Recipe load failed', result.error); setError(true) } else setRecipe(result.data); setLoading(false) }) }, [id])
  if (loading) return <section className="page"><LoadingState rows={3} /></section>
  if (error || !recipe) return <section className="page"><StateMessage icon={ChefHat} variant="error" title="Recipe unavailable" message="This recipe may have been removed or could not be loaded." /></section>
  const groups = splitIngredients(recipe)
  return <article className="page recipe-detail"><Link className="back-link" to="/recipes"><ArrowLeft size={16} />Back to recipes</Link><header className="recipe-detail__header"><div><p className="eyebrow">AI rescue recipe</p><h1>{recipe.title}</h1><p>{recipe.description}</p></div><span className="chef-mark"><ChefHat /></span></header><div className="recipe-stats"><span><Clock3 />Prep<strong>{recipe.prep_time_minutes} min</strong></span><span><Clock3 />Cook<strong>{recipe.cook_time_minutes} min</strong></span><span><Users />Serves<strong>{recipe.servings}</strong></span><span><Lightbulb />Difficulty<strong>{recipe.difficulty}</strong></span></div><section className="rescue-callout"><strong>Why this helps</strong><p>{recipe.rescue_reason}</p>{recipe.ai_insight && <blockquote>{recipe.ai_insight}</blockquote>}</section><div className="recipe-detail__body"><section><h2>Ingredients</h2><IngredientGroup icon={ShoppingBasket} title="Available from your inventory" ingredients={groups.inventory} /><IngredientGroup title="You may need" ingredients={groups.additional} /></section><section><h2>Method</h2><ol className="recipe-steps">{recipe.instructions.map((step, index) => <li key={`${index}-${step}`}><span>{index + 1}</span><p>{step}</p></li>)}</ol></section></div><footer className="waste-impact"><SparklesIcon /><div><strong>Waste reduction impact</strong><p>{recipe.waste_reduction}</p></div></footer></article>
}

function IngredientGroup({ icon: Icon, title, ingredients }) { if (!ingredients.length) return null; return <div className="ingredient-group"><h3>{Icon && <Icon size={16} />}{title}</h3><ul>{ingredients.map((ingredient, index) => <li key={`${ingredient.name}-${index}`}><span>{ingredient.name}</span><strong>{ingredient.quantity}</strong></li>)}</ul></div> }
function SparklesIcon() { return <span className="impact-icon"><Lightbulb /></span> }
