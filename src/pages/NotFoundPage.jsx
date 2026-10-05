import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return <section className="page"><div className="empty-state"><p className="eyebrow">404 · Lost shelf</p><h1>That page doesn’t exist.</h1><p>The link may be outdated, but your inventory is still right where you left it.</p><Link className="button" to="/dashboard">Back to Dashboard</Link></div></section>
}
