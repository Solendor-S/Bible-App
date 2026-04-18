import { useState, useEffect, useRef } from 'react'

type UpdateInfo = {
  current: string
  latest: string | null
  tag: string | null
  notes: string
  url: string
  hasUpdate: boolean
  installFound: boolean
  error?: string
}

type Status = 'idle' | 'checking' | 'ready' | 'updating' | 'done' | 'error'

export default function App() {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [log, setLog] = useState<{ text: string; type: string }[]>([])
  const [updateError, setUpdateError] = useState<string | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  useEffect(() => {
    window.updaterApi.onProgress((data) => {
      setLog((prev) => [...prev, { text: data.line, type: data.type }])
    })
    return () => window.updaterApi.removeProgressListeners()
  }, [])

  async function checkForUpdates() {
    setStatus('checking')
    setInfo(null)
    setLog([])
    setUpdateError(null)
    const result = await window.updaterApi.getInfo()
    setInfo(result)
    setStatus(result.error ? 'error' : 'ready')
  }

  async function applyUpdate() {
    setStatus('updating')
    setLog([])
    setUpdateError(null)
    const result = await window.updaterApi.apply()
    if (result.success) {
      setStatus('done')
      const updated = await window.updaterApi.getInfo()
      setInfo(updated)
    } else {
      setUpdateError(result.error ?? 'Unknown error')
      setStatus('error')
    }
  }

  const versionBadge = () => {
    if (!info) return null
    if (status === 'done') {
      return <span className="badge badge-success">Updated to v{info.current}</span>
    }
    if (info.error) {
      return <span className="badge badge-error">Check failed</span>
    }
    if (info.hasUpdate) {
      return <span className="badge badge-update">Update available</span>
    }
    return <span className="badge badge-ok">Up to date</span>
  }

  return (
    <div className="updater-root">
      <div className="updater-header">
        <span className="updater-cross">✝</span>
        <div>
          <div className="updater-title">Bible App Updater</div>
          <div className="updater-subtitle">Keep your study tools current</div>
        </div>
      </div>

      <div className="updater-body">
        {/* Version info */}
        <div className="version-grid">
          <div className="version-row">
            <span className="version-label">Installed version</span>
            <span className="version-value">
              {info ? `v${info.current}` : '—'}
            </span>
          </div>
          <div className="version-row">
            <span className="version-label">Latest release</span>
            <span className="version-value">
              {status === 'checking'
                ? 'Checking...'
                : info?.latest
                ? `v${info.latest}`
                : '—'}
            </span>
          </div>
          <div className="version-row">
            <span className="version-label">Status</span>
            <span>{versionBadge() ?? <span className="version-value">—</span>}</span>
          </div>
        </div>

        {/* Release notes */}
        {info?.hasUpdate && info.notes && status !== 'updating' && status !== 'done' && (
          <div className="release-notes">
            <div className="release-notes-header">Release notes — {info.tag}</div>
            <div className="release-notes-body">{info.notes}</div>
          </div>
        )}

        {/* Log output */}
        {log.length > 0 && (
          <div className="log-box">
            {log.map((entry, i) => (
              <span key={i} className={`log-line log-${entry.type}`}>
                {entry.text}
              </span>
            ))}
            <div ref={logEndRef} />
          </div>
        )}

        {/* Error message */}
        {(info?.error || updateError) && (
          <div className="error-box">
            {info?.error || updateError}
          </div>
        )}

        {/* Install not found warning */}
        {info && !info.installFound && (
          <div className="error-box">
            App not found at ~/BibleApp. Run setup.bat first.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="updater-actions">
        {status !== 'updating' && (
          <button
            className="btn btn-secondary"
            onClick={checkForUpdates}
            disabled={status === 'checking'}
          >
            {status === 'checking' ? 'Checking...' : 'Check for Updates'}
          </button>
        )}

        {info?.hasUpdate && info.installFound && status === 'ready' && (
          <button className="btn btn-primary" onClick={applyUpdate}>
            Update Now
          </button>
        )}

        {status === 'updating' && (
          <button className="btn btn-primary" disabled>
            Updating...
          </button>
        )}

        {status === 'done' && (
          <button className="btn btn-success" disabled>
            Done — Restart the app to apply changes
          </button>
        )}
      </div>
    </div>
  )
}

declare global {
  interface Window {
    updaterApi: {
      getInfo: () => Promise<UpdateInfo>
      apply: () => Promise<{ success: boolean; error?: string }>
      onProgress: (cb: (data: { line: string; type: string }) => void) => void
      removeProgressListeners: () => void
    }
  }
}
