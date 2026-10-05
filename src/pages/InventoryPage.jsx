import { AlertTriangle, CircleDollarSign, Clock3, PackageOpen, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import InventoryItem from '../components/InventoryItem'
import LoadingState from '../components/LoadingState'
import StateMessage from '../components/StateMessage'
import { fetchInventory } from '../services/inventory'
import { calculateEstimatedExpiry, getFreshnessStatus } from '../utils/inventory'
import { ensurePredictions } from '../services/predictions'

const categories = ['All', 'Fruits', 'Vegetables', 'Dairy', 'Meat', 'Seafood', 'Grains', 'Bakery', 'Pantry', 'Beverages', 'Other']

export default function InventoryPage() {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false)
  const [predictions, setPredictions] = useState(new Map())
  const [predictionError, setPredictionError] = useState(false)
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('All'); const [status, setStatus] = useState('all'); const [storage, setStorage] = useState('all'); const [sort, setSort] = useState('expiry')
  const load = useCallback(async () => { setLoading(true); setError(false); setPredictionError(false); const { data, error: loadError } = await fetchInventory(); if (loadError) { console.error('Inventory load failed', loadError); setError(true) } else { const nextItems = data || []; setItems(nextItems); const predictionResult = await ensurePredictions(nextItems); if (predictionResult.error) { console.error('Prediction refresh failed', predictionResult.error); setPredictionError(true) } else setPredictions(predictionResult.data) } setLoading(false) }, [])
  useEffect(() => { load() }, [load])
  const active = useMemo(() => items.filter((item) => item.status === 'active'), [items])
  const summary = useMemo(() => {
    const states = active.map((item) => getFreshnessStatus(item))
    return { total: active.length, expiring: states.filter((entry) => entry.key === 'expiring').length, attention: states.filter((entry) => ['expiring', 'expired'].includes(entry.key)).length, value: active.reduce((sum, item) => sum + (Number(item.purchase_price || 0) * Number(item.quantity_remaining) / Number(item.quantity_purchased)), 0) }
  }, [active])
  const filtered = useMemo(() => active.filter((item) => {
    const freshness = getFreshnessStatus(item).key; const query = search.toLowerCase()
    return (!query || `${item.food.name} ${item.food.category}`.toLowerCase().includes(query)) && (category === 'All' || item.food.category === category) && (status === 'all' || freshness === status) && (storage === 'all' || item.storage_type === storage)
  }).sort((a, b) => {
    if (sort === 'recent') return b.purchase_date.localeCompare(a.purchase_date)
    if (sort === 'high') return Number(b.quantity_remaining) - Number(a.quantity_remaining)
    if (sort === 'low') return Number(a.quantity_remaining) - Number(b.quantity_remaining)
    if (sort === 'name') return a.food.name.localeCompare(b.food.name)
    if (sort === 'risk-high') return Number(predictions.get(b.id)?.risk_score || 0) - Number(predictions.get(a.id)?.risk_score || 0)
    if (sort === 'risk-low') return Number(predictions.get(a.id)?.risk_score || 0) - Number(predictions.get(b.id)?.risk_score || 0)
    return (calculateEstimatedExpiry(a) || '9999').localeCompare(calculateEstimatedExpiry(b) || '9999')
  }), [active, search, category, status, storage, sort, predictions])
  return <section className="page inventory-page">
    <div className="page-heading"><div><p className="eyebrow">Food inventory</p><h1>Food Inventory</h1><p className="lede">Track what you have and stay ahead of food waste.</p></div><Link className="button" to="/add-food"><Plus size={17} />Add Food</Link></div>
    {loading ? <LoadingState /> : error ? <StateMessage icon={AlertTriangle} variant="error" title="We couldn’t load your inventory" message="Check your connection and try again." action={<button onClick={load}>Retry</button>} /> : <>
      <div className="summary-strip"><Summary icon={PackageOpen} label="Active items" value={summary.total} /><Summary icon={Clock3} label="Expiring soon" value={summary.expiring} /><Summary icon={AlertTriangle} label="Needs attention" value={summary.attention} /><Summary icon={CircleDollarSign} label="Estimated value" value={new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(summary.value)} /></div>
      {predictionError && <div className="notice notice--warning">Waste-risk scores are temporarily unavailable. Your inventory is still available, and you can retry after applying the latest database migration.</div>}
      {active.length === 0 ? <div className="inventory-empty"><span className="empty-icon"><PackageOpen /></span><h2>Your food inventory is empty.</h2><p>Add your first item to start tracking freshness and waste risk.</p><Link className="button" to="/add-food"><Plus size={17} />Add Food</Link></div> : <>
        <div className="inventory-toolbar"><label className="toolbar-search"><Search size={17} /><input type="search" aria-label="Search inventory" placeholder="Search food or category" value={search} onChange={(e) => setSearch(e.target.value)} /></label><select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((entry) => <option key={entry}>{entry}</option>)}</select><select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="fresh">Fresh</option><option value="expiring">Expiring soon</option><option value="expired">Expired</option></select><select aria-label="Filter by storage" value={storage} onChange={(e) => setStorage(e.target.value)}><option value="all">All storage</option><option value="room_temperature">Room temperature</option><option value="refrigerator">Refrigerator</option><option value="freezer">Freezer</option></select><select aria-label="Sort inventory" value={sort} onChange={(e) => setSort(e.target.value)}><option value="expiry">Expiry soonest</option><option value="risk-high">Highest waste risk</option><option value="risk-low">Lowest waste risk</option><option value="recent">Recently purchased</option><option value="high">Highest quantity</option><option value="low">Lowest quantity</option><option value="name">Name A–Z</option></select></div>
        <div className="inventory-list-heading"><span>{filtered.length} {filtered.length === 1 ? 'item' : 'items'}</span>{filtered.length !== active.length && <button className="text-button" onClick={() => { setSearch(''); setCategory('All'); setStatus('all'); setStorage('all') }}>Clear filters</button>}</div>
        {filtered.length ? <div className="inventory-list">{filtered.map((item) => <InventoryItem key={item.id} item={item} prediction={predictions.get(item.id)} />)}</div> : <StateMessage icon={Search} title="No matching food" message="Try changing or clearing your search and filters." />}
      </>}
    </>}
  </section>
}

function Summary({ icon: Icon, label, value }) { return <div className="summary-item"><span><Icon size={17} /></span><div><strong>{value}</strong><small>{label}</small></div></div> }
