import React, { useEffect, useState } from 'react'

interface Release {
  tag: string
  name: string
  date: string
  body: string
}

interface Props {
  open: boolean
  onClose: () => void
}

export function ChangelogModal({ open, onClose }: Props) {
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [currentVersion, setCurrentVersion] = useState<string>('')

  useEffect(() => {
    window.bibleApi.getVersion().then(setCurrentVersion)
  }, [])

  useEffect(() => {
    if (!open || releases.length > 0) return
    setLoading(true)
    setError(false)
    window.bibleApi.getReleases()
      .then(r => { setReleases(r); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal changelog-modal">
        <div className="changelog-header">
          <span className="changelog-title">Changelog</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="changelog-body">
          {currentVersion && (
            <div className="changelog-installed">
              Installed: <strong>v{currentVersion}</strong>
            </div>
          )}
          {loading && <div className="modal-status">Loading releases...</div>}
          {error && <div className="modal-status">Could not load releases. Check your connection.</div>}
          {!loading && !error && releases.length === 0 && (
            <div className="modal-status">No releases found.</div>
          )}
          {releases.map(r => (
            <div key={r.tag} className="changelog-release">
              <div className="changelog-release-header">
                <span className="changelog-version">{r.name || r.tag}</span>
                <span className="changelog-date">{r.date ? new Date(r.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</span>
              </div>
              {r.body && <pre className="changelog-notes">{r.body.trim()}</pre>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
