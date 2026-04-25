import React, { useState, useEffect, useRef } from 'react'
import type { BibleVerse } from '../types'

interface Props {
  book: string
  chapter: number
  allVerses: BibleVerse[]
  initialVerse: number
  anchorRect: DOMRect
  onClose: () => void
}

export function CopyRangePopover({ book, chapter, allVerses, initialVerse, anchorRect, onClose }: Props) {
  const [start, setStart] = useState(initialVerse)
  const [end, setEnd] = useState(initialVerse)
  const [copied, setCopied] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const startSliderRef = useRef<HTMLInputElement>(null)
  const endSliderRef = useRef<HTMLInputElement>(null)

  const min = allVerses[0]?.verse ?? 1
  const max = allVerses[allVerses.length - 1]?.verse ?? 1

  // Position: below the verse row, left-aligned with it
  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 6,
    left: Math.min(anchorRect.left, window.innerWidth - 320),
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay so the right-click that opened this doesn't immediately close it
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  function handleStartChange(v: number) {
    setStart(v)
    if (v > end) setEnd(v)
  }

  function handleEndChange(v: number) {
    setEnd(v)
    if (v < start) setStart(v)
  }

  // Non-passive wheel listeners so preventDefault() actually stops page scroll
  useEffect(() => {
    const startEl = startSliderRef.current
    const endEl = endSliderRef.current
    if (!startEl || !endEl) return

    function onStartWheel(e: WheelEvent) {
      e.preventDefault()
      setStart(s => {
        const next = Math.min(max, Math.max(min, s + (e.deltaY > 0 ? 1 : -1)))
        setEnd(en => next > en ? next : en)
        return next
      })
    }

    function onEndWheel(e: WheelEvent) {
      e.preventDefault()
      setEnd(en => {
        const next = Math.min(max, Math.max(min, en + (e.deltaY > 0 ? 1 : -1)))
        setStart(s => next < s ? next : s)
        return next
      })
    }

    startEl.addEventListener('wheel', onStartWheel, { passive: false })
    endEl.addEventListener('wheel', onEndWheel, { passive: false })
    return () => {
      startEl.removeEventListener('wheel', onStartWheel)
      endEl.removeEventListener('wheel', onEndWheel)
    }
  }, [min, max])

  function buildCopyText(): string {
    const ref = start === end ? `${book} ${chapter}:${start}` : `${book} ${chapter}:${start}-${end}`
    const header = `${ref} (KJV)`
    const lines = allVerses
      .filter(v => v.verse >= start && v.verse <= end)
      .map(v => `${v.verse} ${v.text}`)
    return [header, ...lines].join('\n')
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildCopyText()).then(() => {
      setCopied(true)
      setTimeout(onClose, 600)
    })
  }

  const rangeLabel = start === end ? `v. ${start}` : `vv. ${start} – ${end}`

  return (
    <div ref={popoverRef} className="copy-popover" style={style}>
      <div className="copy-popover-title">Copy Range</div>

      <div className="copy-slider-group">
        <label className="copy-slider-label">From</label>
        <input
          type="range"
          className="copy-slider"
          min={min}
          max={max}
          value={start}
          ref={startSliderRef}
          onChange={e => handleStartChange(Number(e.target.value))}
        />
        <span className="copy-slider-num">{start}</span>
      </div>

      <div className="copy-slider-group">
        <label className="copy-slider-label">To</label>
        <input
          type="range"
          className="copy-slider"
          min={min}
          max={max}
          value={end}
          ref={endSliderRef}
          onChange={e => handleEndChange(Number(e.target.value))}
        />
        <span className="copy-slider-num">{end}</span>
      </div>

      <div className="copy-range-label">{rangeLabel}</div>

      <div className="copy-popover-actions">
        <button className="copy-btn-primary" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button className="copy-btn-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
