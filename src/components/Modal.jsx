import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

export default function Modal({ title, description, children, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const previouslyFocused = document.activeElement
    const focusable = () => [...dialogRef.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    focusable()[0]?.focus()
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const elements = focusable(); if (!elements.length) return
        const first = elements[0]; const last = elements[elements.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey); previouslyFocused?.focus() }
  }, [onClose])
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby={description ? 'modal-description' : undefined}><button className="icon-button modal__close" onClick={onClose} aria-label="Close dialog"><X /></button><h2 id="modal-title">{title}</h2>{description && <p id="modal-description">{description}</p>}{children}</section></div>
}
