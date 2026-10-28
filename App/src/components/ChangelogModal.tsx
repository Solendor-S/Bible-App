// Release notes from GitHub. `onlyVersion` = the one-time "What's New" view for the installed release.
import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import type { Release } from '../types'

export function ChangelogModal({ open, onClose, onlyVersion }: { open: boolean; onClose: () => void; onlyVersion?: string }) {
  const [releases, setReleases] = useState<Release[] | null>(null)
  const [current, setCurrent] = useState('')

  useEffect(() => { window.api.getVersion().then(setCurrent) }, [])
  useEffect(() => { if (open && !releases) window.api.getReleases().then(setReleases).catch(() => setReleases([])) }, [open, releases])

  const shown = (releases ?? []).filter(r => !onlyVersion || r.tag.replace(/^v/, '') === onlyVersion)
  return (
    <Modal open={open} onClose={onClose} wide title={onlyVersion ? `What's new in v${onlyVersion}` : 'Changelog'}>
      {current && !onlyVersion && <div className="changelog-installed">Installed: <strong>v{current}</strong></div>}
      {!releases && <div className="panel-loading">Loading releases…</div>}
      {releases && !shown.length && <div className="panel-empty">{onlyVersion ? 'Release notes are not available offline.' : 'Could not load releases. Check your connection.'}</div>}
      {shown.map(r => (
        <div key={r.tag} className="changelog-release">
          <div className="changelog-release-header">
            <span className="changelog-version">{r.name || r.tag}</span>
            <span className="changelog-date">{r.date ? new Date(r.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</span>
          </div>
          {r.body && <pre className="changelog-notes">{r.body.trim()}</pre>}
        </div>
      ))}
    </Modal>
  )
}
