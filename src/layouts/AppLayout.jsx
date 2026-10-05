import { Bell, Leaf, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { routes } from '../routes/routes'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function AppLayout() {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="brand"><span className="brand__mark"><Leaf size={19} /></span><span>ShelfSense <b>AI</b></span></div>
        <button className="icon-button sidebar__close" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        <nav aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {routes.filter((route) => !route.secondary).map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
          <p className="nav-label nav-label--secondary">Account</p>
          {routes.filter((route) => route.secondary).map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}
        </nav>
        <div className="sidebar__account"><div><small>Signed in as</small><span>{user?.email}</span></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => supabase.auth.signOut()}><LogOut size={17} /></button></div>
      </aside>
      {open && <button className="scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <span className="workspace-label">Food intelligence workspace</span>
          <div className="topbar-actions"><NavLink to="/notifications" className="icon-button topbar-bell" aria-label="Open notifications"><Bell size={19} /></NavLink><NavLink to="/settings" className="avatar" aria-label="Open account settings">{user?.email?.slice(0, 2).toUpperCase()}</NavLink></div>
        </header>
        <main id="main-content" className="content"><Outlet /></main>
      </div>
    </div>
  )
}
