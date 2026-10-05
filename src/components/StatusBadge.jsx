export default function StatusBadge({ status }) {
  return <span className={`badge badge--${status.tone}`}><span />{status.label}</span>
}
