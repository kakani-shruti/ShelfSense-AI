import { ArrowUpRight, Clock3, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function RecipeCard({ recipe }) {
  const total = Number(recipe.prep_time_minutes || 0) + Number(recipe.cook_time_minutes || 0)
  const inventoryIngredients = (recipe.ingredients || []).filter((ingredient) => ingredient.source === 'inventory')
  return <article className="recipe-card"><div className="recipe-card__meta"><span>{recipe.difficulty || 'Easy'}</span><span><Clock3 size={13} />{total} min</span><span><Users size={13} />{recipe.servings}</span></div><h3>{recipe.title}</h3><p>{recipe.description}</p><div className="recipe-card__ingredients"><small>Uses from inventory</small><span>{inventoryIngredients.map((ingredient) => ingredient.name).slice(0, 4).join(' · ') || 'At-risk ingredient'}</span></div><div className="recipe-card__reason">{recipe.rescue_reason}</div><Link to={`/recipes/${recipe.id}`}>View recipe <ArrowUpRight size={14} /></Link></article>
}

