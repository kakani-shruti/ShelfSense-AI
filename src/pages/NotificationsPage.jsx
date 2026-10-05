import { Bell, CheckCheck, CircleAlert } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import StateMessage from '../components/StateMessage'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notifications'
import { applyReadState } from '../utils/notifications'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false)
  const load = useCallback(async () => { const result = await fetchNotifications(); if (result.error) { console.error('Notification load failed', result.error); setError(true) } else setNotifications(result.data || []); setLoading(false) }, [])
  useEffect(() => { load() }, [load])
  const unread = notifications.filter((entry) => !entry.is_read).length
  const markOne = async (id) => { const { error: updateError } = await markNotificationRead(id); if (!updateError) setNotifications((current) => applyReadState(current, id)) }
  const markAll = async () => { const { error: updateError } = await markAllNotificationsRead(); if (!updateError) setNotifications((current) => applyReadState(current)) }
  return <section className="page notifications-page"><div className="page-heading"><div><p className="eyebrow">Action center</p><h1>Notifications</h1><p className="lede">Prioritized signals from your inventory and recorded behavior.</p></div>{unread > 0 && <button className="button button--ghost" onClick={markAll}><CheckCheck size={16} />Mark all as read</button>}</div>{loading ? <LoadingState /> : error ? <StateMessage icon={CircleAlert} variant="error" title="Notifications unavailable" message="Please try again shortly." /> : notifications.length === 0 ? <div className="inventory-empty"><span className="empty-icon"><Bell /></span><h2>You’re all caught up.</h2><p>Important inventory and waste-pattern signals will appear here.</p></div> : <div className="notification-list">{notifications.map((notification) => <article key={notification.id} className={`notification-item ${notification.is_read ? '' : 'notification-item--unread'}`}><span className={`priority-mark priority-mark--${notification.priority}`} /><div><div className="notification-title"><strong>{notification.title}</strong><span>{notification.priority}</span></div><p>{notification.message}</p><small>{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.created_at))}</small></div><div className="notification-actions">{notification.action_path && <Link to={notification.action_path} onClick={() => markOne(notification.id)}>{notification.type === 'high_risk' ? 'Rescue with AI' : notification.action_path.includes('analytics') ? 'View analytics' : 'View food'}</Link>}{!notification.is_read && <button onClick={() => markOne(notification.id)}>Mark read</button>}</div></article>)}</div>}</section>
}
