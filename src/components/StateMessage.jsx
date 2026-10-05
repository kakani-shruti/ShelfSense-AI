export default function StateMessage({ icon: Icon, title, message, variant = 'empty', action }) {
  return <div className={`state-message state-message--${variant}`} role={variant === 'error' ? 'alert' : 'status'}><span className="state-message__icon"><Icon size={20} /></span><div><h3>{title}</h3><p>{message}</p>{action && <div className="state-message__action">{action}</div>}</div></div>
}
