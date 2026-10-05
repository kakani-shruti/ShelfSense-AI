import { AlertTriangle, ArrowRight, PackageOpen, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import RiskBadge from '../components/RiskBadge'
import StateMessage from '../components/StateMessage'
import { fetchInventory } from '../services/inventory'
import { ensurePredictions } from '../services/predictions'
import { calculateEstimatedExpiry, daysUntil } from '../utils/inventory'
import { fetchAnalytics } from '../services/analytics'
import { generateNotifications } from '../services/notifications'
import { currentAtRisk, formatQuantityTotals } from '../utils/analytics'
import { useAuth } from '../context/AuthContext'

function greeting(date = new Date()) {
  const hour = date.getHours()
  return hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.'
}

function useGreeting() {
  const [message, setMessage] = useState(() => greeting())
  useEffect(() => {
    const update = () => setMessage(greeting())
    update()
    const interval = window.setInterval(update, 60_000)
    return () => window.clearInterval(interval)
  }, [])
  return message
}

export default function DashboardPage() {
  const { user } = useAuth()
  const greetingMessage = useGreeting()
  const [items, setItems] = useState([]); const [predictions, setPredictions] = useState(new Map()); const [loading, setLoading] = useState(true); const [error, setError] = useState(false)
  const [predictionError, setPredictionError] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const load = useCallback(async () => { setLoading(true); setError(false); setPredictionError(false); const [inventoryResult, analyticsResult] = await Promise.all([fetchInventory(), fetchAnalytics(30)]); if (inventoryResult.error) { console.error('Dashboard inventory load failed', inventoryResult.error); setError(true); setLoading(false); return } const active = (inventoryResult.data || []).filter((item) => item.status === 'active' && Number(item.quantity_remaining) > 0); setItems(active); if (!analyticsResult.error) setAnalytics(analyticsResult.data); const predictionResult = await ensurePredictions(active); if (predictionResult.error) { console.error('Dashboard prediction load failed', predictionResult.error); setPredictionError(true) } else { setPredictions(predictionResult.data); if (!analyticsResult.error) { const notificationResult = await generateNotifications({ atRisk: currentAtRisk(active, predictionResult.data), recurring: analyticsResult.data.recurring, overpurchase: analyticsResult.data.overpurchase, wasteComparison: analyticsResult.data.wasteComparison }, user.id); if (notificationResult.error) console.error('Notification generation failed', notificationResult.error) } } setLoading(false) }, [user.id])
  useEffect(() => { load() }, [load])
  const priority = useMemo(() => items.map((item) => ({ item, prediction: predictions.get(item.id) })).filter((entry) => entry.prediction).sort((a, b) => Number(b.prediction.risk_score) - Number(a.prediction.risk_score)).slice(0, 5), [items, predictions])
  const attention = [...predictions.values()].filter((prediction) => Number(prediction.risk_score) >= 50).length
  return <section className="page dashboard-page"><div className="dashboard-heading"><div><p className="eyebrow">Today’s kitchen</p><h1>{greetingMessage}</h1><p className="lede">See what needs attention before good food becomes waste.</p></div><Link className="button" to="/add-food">Add food</Link></div>
    {loading ? <LoadingState /> : error ? <StateMessage icon={AlertTriangle} variant="error" title="We couldn’t prepare your dashboard" message="Your inventory is safe. Please try loading the latest risk estimates again." action={<button onClick={load}>Retry</button>} /> : items.length === 0 ? <div className="inventory-empty"><span className="empty-icon"><PackageOpen /></span><h2>Start building your food inventory.</h2><p>Add food to begin receiving explainable waste-risk estimates.</p><Link className="button" to="/add-food">Add your first item</Link></div> : <>
      <div className="dashboard-summary"><div className="dashboard-summary__lead"><span><PackageOpen /></span><strong>{items.length}</strong><small>Active items</small></div><div><strong>{predictionError ? '—' : attention}</strong><small>At risk</small></div><div><strong>{analytics?.performance.score == null ? '—' : `${analytics.performance.score} / 100`}</strong><small>Waste performance</small></div><div><strong>{analytics ? formatQuantityTotals(analytics.wasteTotals) : '—'}</strong><small>Food wasted · 30 days</small></div></div>
      {predictionError && <div className="notice notice--warning">Waste-risk scores are temporarily unavailable. Your inventory and analytics remain available; apply the latest database migration, then retry.</div>}
      {analytics && <section className="dashboard-intelligence"><div><p className="eyebrow">30-day behavior</p><h2>{analytics.performance.score == null ? 'Building your baseline' : `${analytics.performance.score} / 100 · ${analytics.performance.label}`}</h2><p>Food Waste Performance is based on your logged waste rate, trend, and recurring patterns.</p></div><div><small>Recorded waste</small><strong>{formatQuantityTotals(analytics.wasteTotals)}</strong><span>{analytics.wasteComparison.label}</span></div><div><small>Recurring patterns</small><strong>{analytics.recurring.length}</strong><Link to="/analytics">View waste intelligence <ArrowRight size={14} /></Link></div></section>}
      {!predictionError && <><div className="dashboard-section-heading"><div><p className="eyebrow">Prioritized by estimated risk</p><h2>Needs attention</h2></div><Link to="/inventory">View inventory <ArrowRight size={15} /></Link></div>
      <div className="priority-grid">{priority.map(({ item, prediction }, index) => { const days = daysUntil(calculateEstimatedExpiry(item)); return <Link to={index === 0 && days >= 0 ? `/inventory/${item.id}?rescue=1#rescue` : `/inventory/${item.id}`} className={`priority-card ${index === 0 ? 'priority-card--primary' : ''}`} key={item.id}><div className="priority-card__top"><span className="food-initial">{item.food.name.charAt(0)}</span><RiskBadge prediction={prediction} /></div><h3>{item.food.name}</h3><p>{Number(item.quantity_remaining).toLocaleString()} {item.unit} remaining · {days == null ? 'Expiry unavailable' : days < 0 ? `${Math.abs(days)}d past estimate` : days === 0 ? 'Estimated expiry today' : `${days}d remaining`}</p><div className="priority-reason"><Sparkles size={15} /><span>{prediction.explanation.find((reason) => !reason.includes('days remain')) || prediction.explanation[0]}</span></div>{index === 0 && days >= 0 && <span className="priority-ai-cta"><Sparkles size={14} />Rescue with AI</span>}</Link> })}</div></>}
      <p className="model-footnote">Waste Risk Scores are application estimates based on shelf life, quantity, and available personal history—not scientifically validated food-safety advice.</p>
    </>}
  </section>
}
