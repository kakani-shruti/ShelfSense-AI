import { riskLabel } from '../utils/prediction'

export default function RiskBadge({ prediction, compact = false }) {
  if (!prediction) return <span className="risk-badge risk-badge--pending">Risk pending</span>
  return <span className={`risk-badge risk-badge--${prediction.risk_level}`} aria-label={`Waste risk ${Math.round(Number(prediction.risk_score))} out of 100, ${riskLabel(prediction.risk_level)}`}><strong>{Math.round(Number(prediction.risk_score))}</strong><span>{compact ? '/ 100' : `/ 100 · ${riskLabel(prediction.risk_level)}`}</span></span>
}
