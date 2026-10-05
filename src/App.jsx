import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import NotFoundPage from './pages/NotFoundPage'
import ProtectedRoute from './components/ProtectedRoute'

const AuthPage = lazy(() => import('./pages/AuthPage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const AddFoodPage = lazy(() => import('./pages/AddFoodPage'))
const InventoryDetailPage = lazy(() => import('./pages/InventoryDetailPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const RecipesPage = lazy(() => import('./pages/RecipesPage'))
const RecipeDetailPage = lazy(() => import('./pages/RecipeDetailPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

export default function App() {
  return (
    <Suspense fallback={<div className="route-loading">Loading…</div>}><Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/inventory/:id" element={<InventoryDetailPage />} />
        <Route path="/add-food" element={<AddFoodPage />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/recipes/:id" element={<RecipeDetailPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes></Suspense>
  )
}
