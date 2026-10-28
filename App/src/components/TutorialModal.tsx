// First-launch tour — the Android TutorialModal's welcome + five slides, rewritten for desktop.
import { useState } from 'react'
import { Modal } from './Modal'

const SLIDES = [
  { icon: '📖', title: 'Reading', body: 'Type any passage in the bar at the top ("John 3:16; Romans 8:28", "Didache 1"), or open Books to browse the canon, Apocrypha and early church texts. ‹ › at the end of a chapter moves on; Ctrl + / Ctrl − resize the text.' },
  { icon: '🖱️', title: 'Verse Actions', body: 'Click a verse to select it — the study panel follows. Right-click for copy/share, notes, bookmarks, parallels and five highlight colours. Click a word in a selected verse for its concordance, or a Strong\'s tag for its definition.' },
  { icon: '🔍', title: 'Search', body: 'Ctrl+F searches the whole Bible by words, exact phrase, Greek or Hebrew script, or Strong\'s number (G26, H430) — with typo correction, book scopes and a per-book breakdown. The Commentary tab searches every Church Father.' },
  { icon: '🎓', title: 'Study Tools', body: 'The right panel holds the Church Fathers, Cross-Refs, Greek/Hebrew Words, Aquinas, Doctrine, Historical sources, Church History, Topics and Maps. Drag the tabs to reorder them; ∥ adds a parallel translation and ⧉ a split view.' },
  { icon: '🗂️', title: 'Library & History', body: 'The Library tab keeps your reading plans, bookmarks, highlights, notes (in notebooks) and every chapter you have read. Settings (⚙) has themes, fonts, reading modes and the ESV.' },
]

export function TutorialModal({ open, onFinish, onDecline }: { open: boolean; onFinish: () => void; onDecline: () => void }) {
  const [step, setStep] = useState(-1)
  if (!open) return null
  if (step < 0) {
    return (
      <Modal open onClose={onDecline} title="Welcome to Bible Study">
        <p>Scripture with the Church Fathers, original languages and the history of the early church. Would you like a quick tour?</p>
        <div className="dlg-actions">
          <button className="btn" onClick={onDecline}>Not now</button>
          <button className="btn btn--primary" onClick={() => setStep(0)}>Show me around</button>
        </div>
      </Modal>
    )
  }
  const s = SLIDES[step]
  const last = step === SLIDES.length - 1
  return (
    <Modal open onClose={onDecline} title={`${step + 1} / ${SLIDES.length}`}>
      <div className="tutorial-slide">
        <div className="tutorial-icon">{s.icon}</div>
        <h3>{s.title}</h3>
        <p>{s.body}</p>
      </div>
      <div className="tutorial-dots">{SLIDES.map((_, i) => <span key={i} className={i === step ? 'on' : ''} />)}</div>
      <div className="dlg-actions">
        {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
        <button className="btn btn--primary" onClick={() => last ? (setStep(-1), onFinish()) : setStep(step + 1)}>{last ? 'Get started' : 'Next'}</button>
      </div>
    </Modal>
  )
}
