import { Navigate, useLocation } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (!isSupabaseConfigured) return <Navigate to="/auth" replace />
  if (loading) return <div className="route-loading"><LoaderCircle className="spin" /><span>Preparing your workspace…</span></div>
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />
  return children
}
