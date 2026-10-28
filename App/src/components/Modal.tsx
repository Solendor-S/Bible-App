import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

/** Calls `close` on a mousedown outside `ref` while `active`. */
export function useOutsideClick(ref: RefObject<HTMLElement | null>, active: boolean, close: () => void) {
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (!active) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current()
    }
    // Deferred so the click that opened the popup doesn't immediately close it
    const id = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', onDown) }
  }, [ref, active])
}

/** Centered dialog with overlay; Escape or overlay click closes. */
export function Modal({ open, onClose, title, children, wide, className = '' }: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  wide?: boolean
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="dlg-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`dlg${wide ? ' dlg--wide' : ''} ${className}`} role="dialog" aria-modal="true">
        {title !== undefined && (
          <div className="dlg-header">
            <div className="dlg-title">{title}</div>
            <button className="dlg-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        )}
        <div className="dlg-body">{children}</div>
      </div>
    </div>
  )
}

/** Small on/off switch used across settings and toggles. */
export function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button className="toggle-row" onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="toggle-info">
        <span className="toggle-label">{label}</span>
        {desc && <span className="toggle-desc">{desc}</span>}
      </span>
      <span className={`toggle${on ? ' toggle--on' : ''}`}><span className="toggle-thumb" /></span>
    </button>
  )
}

/** Segmented chip row. */
export function Chips<T extends string>({ value, options, onChange, small }: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  small?: boolean
}) {
  return (
    <div className={`chips${small ? ' chips--small' : ''}`}>
      {options.map(o => (
        <button key={o.value} className={`chip${o.value === value ? ' chip--active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
