import { CalendarDays, ChevronRight, MapPin, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { calculateEstimatedExpiry, formatDate, formatStorage, getFreshnessStatus } from '../utils/inventory'
import StatusBadge from './StatusBadge'
import RiskBadge from './RiskBadge'

export default function InventoryItem({ item, prediction }) {
  const expiry = calculateEstimatedExpiry(item)
  const status = getFreshnessStatus(item)
  const highRisk = Number(prediction?.risk_score || 0) >= 50 && status.key !== 'expired'
  return (
    <article className="inventory-row">
      <Link className="row-cover" to={`/inventory/${item.id}`} aria-label={`View ${item.food.name}`} />
      <div className="food-identity"><span className="food-initial">{item.food.name.charAt(0)}</span><div><strong>{item.food.name}</strong><small>{item.food.category}</small></div></div>
      <div className="quantity"><strong>{Number(item.quantity_remaining).toLocaleString()} {item.unit}</strong><small>remaining</small></div>
      <div className="row-fact"><CalendarDays size={15} /><span><small>Purchased</small>{formatDate(item.purchase_date)}</span></div>
      <div className="row-fact"><CalendarDays size={15} /><span><small>Est. expiry</small>{formatDate(expiry)}</span></div>
      <div className="row-fact storage"><MapPin size={15} /><span><small>Storage</small>{formatStorage(item.storage_type)}</span></div>
      <StatusBadge status={status} />
      <RiskBadge prediction={prediction} compact />
      {highRisk && <Link className="row-ai-action" to={`/inventory/${item.id}?rescue=1#rescue`}><Sparkles size={13} />Rescue</Link>}
      <ChevronRight className="row-chevron" size={18} />
    </article>
  )
}
