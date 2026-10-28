import React, { useEffect, useState } from 'react'
import { validateEsvKey, EsvError, ESV_COPYRIGHT, ESV_SIGNUP_URL } from '../lib/esv'
import { normalizeEsvKey, setEsvKey, useEsvKey } from '../lib/esvKey'

const ACCOUNT_URL = 'https://www.esv.org/create-account/'

const STEPS: { title: string; body: string; link?: { label: string; url: string } }[] = [
  {
    title: 'Create a free ESV.org account',
    body: 'Crossway gives the ESV text away for personal, non-commercial reading — but they ask each reader to sign up so usage stays tied to a person, not to an app. It takes about a minute and costs nothing.',
    link: { label: 'Open esv.org sign-up', url: ACCOUNT_URL },
  },
  {
    title: 'Create an API application',
    body: 'Once signed in, open the API page and click "Create an API application". Give it any name you like — "Bible App" works. Crossway will show you an access key: a long string of letters and numbers.',
    link: { label: 'Open the ESV API page', url: ESV_SIGNUP_URL },
  },
  {
    title: 'Copy the key and paste it below',
    body: 'Copy the key from the ESV page, then paste it in here. Bible App stores it only on this computer and sends it only to Crossway.',
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function EsvSetupModal({ open, onClose }: Props) {
  const esvKey = useEsvKey()
  const [draft, setDraft] = useState(esvKey)
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return
    setDraft(esvKey)
    setStatus(esvKey ? 'ok' : 'idle')
    setMessage(esvKey ? 'A key is saved on this computer.' : '')
  }, [open, esvKey])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null

  async function handleSave() {
    const key = draft.trim()
    if (!key) {
      setEsvKey('')
      setStatus('idle')
      setMessage('Key removed.')
      return
    }
    setStatus('testing')
    setMessage('')
    try {
      // setEsvKey normalises a pasted "Authorization: Token …" line; test the same value.
      await validateEsvKey(normalizeEsvKey(key))
      setEsvKey(key)
      setStatus('ok')
      setMessage('Key works. The ESV is ready to read.')
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof EsvError ? e.message : 'Could not verify that key.')
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal esv-modal">
        <div className="changelog-header">
          <span className="changelog-title">Set up the ESV</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="esv-modal-body">
          <p className="esv-intro">
            The ESV is copyrighted, so unlike the other translations it can't be bundled into
            Bible App. Crossway lets you read it through their own service using a free personal
            key. Three steps, done once.
          </p>

          {STEPS.map((step, i) => (
            <div key={step.title} className="esv-step">
              <div className="esv-step-head">
                <span className="esv-step-num">{i + 1}</span>
                <span className="esv-step-title">{step.title}</span>
              </div>
              <p className="esv-step-body">{step.body}</p>
              {step.link && (
                <button
                  className="esv-link-btn"
                  onClick={() => window.bibleApi.openExternal(step.link!.url)}
                >
                  {step.link.label} ↗
                </button>
              )}
            </div>
          ))}

          <input
            className="esv-key-input"
            type="text"
            value={draft}
            spellCheck={false}
            autoComplete="off"
            placeholder="Paste your ESV API key"
            onChange={e => { setDraft(e.target.value); setStatus('idle'); setMessage('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          />

          <button
            className="esv-save-btn"
            disabled={status === 'testing'}
            onClick={handleSave}
          >
            {status === 'testing' ? 'Testing…' : draft.trim() ? 'Save & test key' : 'Remove key'}
          </button>

          {message && (
            <div className={`esv-status esv-status--${status}`}>{message}</div>
          )}

          <p className="esv-fineprint">{ESV_COPYRIGHT}</p>
          <p className="esv-fineprint">
            Crossway limits each key to 5,000 chapters a day — far more than normal reading. The
            ESV needs an internet connection; every other translation in Bible App works offline.
          </p>
        </div>
      </div>
    </div>
  )
}
