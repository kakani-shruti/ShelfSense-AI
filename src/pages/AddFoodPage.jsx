import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import InventoryForm from '../components/InventoryForm'
import LoadingState from '../components/LoadingState'
import StateMessage from '../components/StateMessage'
import { useAuth } from '../context/AuthContext'
import { listFoods } from '../services/foods'
import { createInventoryItem } from '../services/inventory'
import { toDateInputValue } from '../utils/inventory'

const defaults = { food_id: '', quantity_purchased: '1', unit: 'g', purchase_date: toDateInputValue(), storage_type: 'refrigerator', purchase_price: '', custom_expiry_date: '', notes: '' }

export default function AddFoodPage() {
  const { user } = useAuth(); const navigate = useNavigate(); const [foods, setFoods] = useState([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  useEffect(() => { listFoods().then(({ data, error: loadError }) => { if (loadError) { console.error('Food master load failed', loadError); setError('We couldn’t load the food list. Please try again.') } else setFoods(data || []); setLoading(false) }) }, [])
  const submit = async (values) => { setBusy(true); setError(''); const { data, error: saveError } = await createInventoryItem(values, user.id); setBusy(false); if (saveError) { console.error('Inventory creation failed', saveError); return setError('We couldn’t add this food. Please check the details and try again.') } navigate(`/inventory/${data.id}`) }
  return <section className="page form-page"><Link className="back-link" to="/inventory"><ArrowLeft size={16} />Back to inventory</Link><div className="page-heading"><div><p className="eyebrow">New inventory item</p><h1>Add Food</h1><p className="lede">Record this purchase as a separate inventory item.</p></div></div>{loading ? <LoadingState rows={3} /> : error && foods.length === 0 ? <StateMessage icon={AlertTriangle} variant="error" title="Food list unavailable" message={error} /> : <div className="form-card">{error && <div className="notice notice--error">{error}</div>}<InventoryForm foods={foods} initialValues={defaults} onSubmit={submit} busy={busy} /></div>}</section>
}
