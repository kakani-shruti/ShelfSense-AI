export default function LoadingState({ rows = 4 }) {
  return <div className="skeleton-list" aria-label="Loading inventory">{Array.from({ length: rows }, (_, index) => <div className="skeleton-row" key={index}><span /><span /><span /><span /></div>)}</div>
}
