import { BarChart3, Bell, BookOpen, Boxes, LayoutDashboard, Plus, Settings } from 'lucide-react'

export const routes = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/inventory', label: 'Inventory', icon: Boxes },
  { path: '/add-food', label: 'Add Food', icon: Plus },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/recipes', label: 'Recipes', icon: BookOpen },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/settings', label: 'Settings', icon: Settings, secondary: true },
]
