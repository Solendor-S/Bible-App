// Settings — the Android SettingsScreen options that make sense on desktop. All persist in user.db.
import { useEffect, useState } from 'react'
import { usePref, usePrefs } from '../context/Prefs'
import { TRANSLATIONS } from '../data/translations'
import { Chips, Modal, Toggle } from './Modal'
import { EsvSetupModal } from './EsvSetupModal'
import { useEsvKey } from '../lib/esvKey'

const CREDITS: { title: string; body: string; url?: string }[] = [
  { title: 'Hebrew Old Testament', body: 'TAHOT (Translators Amalgamated Hebrew Old Testament) and the Westminster Leningrad Codex (WLC), via the STEPBible Tyndale datasets (CC BY 4.0).', url: 'https://github.com/STEPBible/STEPBible-Data' },
  { title: 'Greek New Testament', body: 'SBL Greek New Testament (SBLGNT), Translators Amalgamated GNT (TAGNT), and the Textus Receptus (Scrivener 1894).' },
  { title: 'Greek Old Testament (LXX)', body: 'Septuagint text based on Rahlfs with CCAT morphology, and the Apostolic Bible (Poole), both tagged and provided by STEPBible (CC BY 4.0). Thanks to David Instone-Brewer for sharing the dataset.', url: 'https://stepbible.org' },
  { title: "Lexicons & Strong's", body: "Thayer's Greek Lexicon and the Brown-Driver-Briggs Hebrew Lexicon (public domain), with Strong's Concordance numbering." },
  { title: 'Church Fathers', body: 'Commentary from the New Advent Fathers collection, the Historical Christian Faith commentaries and e-Catena; Catena Aurea (Parker/Newman 1841), Summa Theologica (1920 Dominican translation) and Summa Contra Gentiles (Rickaby 1905).' },
  { title: "Nave's Topical Bible", body: "Orville J. Nave's Topical Bible (public domain)." },
]

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="settings-row"><span className="settings-label">{label}</span><div>{children}</div></div>
}

export function SettingsModal({ open, onClose, onOpenChangelog }: { open: boolean; onClose: () => void; onOpenChangelog: () => void }) {
  const { reset } = usePrefs()
  const [theme, setTheme] = usePref('theme')
  const [readingMode, setReadingMode] = usePref('reading_mode')
  const [focusMode, setFocusMode] = usePref('focus_mode')
  const [otCaps, setOtCaps] = usePref('ot_quote_caps')
  const [redLetter, setRedLetter] = usePref('red_letter_on')
  const [crossOrder, setCrossOrder] = usePref('crossref_biblical_order')
  const [fontSize, setFontSize] = usePref('font_size')
  const [lineSpacing, setLineSpacing] = usePref('line_spacing')
  const [fontFamily, setFontFamily] = usePref('font_family')
  const [fontScope, setFontScope] = usePref('font_scope')
  const [startupTrans, setStartupTrans] = usePref('startup_translation')
  const [startupMode, setStartupMode] = usePref('startup_mode')
  const [strongsInSearch, setStrongsInSearch] = usePref('strongs_in_search')
  const [searchOrder, setSearchOrder] = usePref('search_biblical_order')
  const [searchMode, setSearchMode] = usePref('search_mode')
  const esvKey = useEsvKey()
  const [esvOpen, setEsvOpen] = useState(false)
  const [credits, setCredits] = useState(false)
  const [version, setVersion] = useState('')
  useEffect(() => { if (open) window.api.getVersion().then(setVersion) }, [open])

  return (
    <>
      <Modal open={open && !esvOpen && !credits} onClose={onClose} wide title="Settings" className="settings-dlg">
        <div className="settings-section">Appearance</div>
        <Chips value={theme} onChange={setTheme} options={[
          { value: 'dark', label: 'Dark — easy on the eyes at night' },
          { value: 'light', label: 'Light — clean and bright' },
          { value: 'highContrast', label: 'High Contrast — maximum legibility' },
        ]} />

        <div className="settings-section">Reading</div>
        <Toggle on={readingMode} onChange={setReadingMode} label="Reading Mode" desc="Show chapters as flowing prose paragraphs" />
        <Toggle on={focusMode} onChange={setFocusMode} label="Focus Mode" desc="Bold the first half of each word to guide the eye" />
        <Toggle on={otCaps} onChange={setOtCaps} label="OT Quotes in Caps" desc="Old Testament quotations in the New Testament shown in capitals (work in progress)" />
        <Toggle on={redLetter} onChange={setRedLetter} label="Red Letter" desc="Highlight the words of Jesus in red" />
        <Toggle on={crossOrder} onChange={setCrossOrder} label="Cross-Refs in Biblical Order" desc="Sort cross-references by book order instead of relevance" />
        <Row label={`Font size (${fontSize})`}>
          <input type="range" min={12} max={30} value={fontSize} onChange={e => setFontSize(+e.target.value)} />{' '}
          <button className="link-btn" onClick={() => setFontSize(17)}>Reset</button>
        </Row>
        <Row label="Line spacing">
          <Chips small value={lineSpacing} onChange={setLineSpacing} options={[
            { value: 'compact', label: 'Compact' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Relaxed' }, { value: 'spacious', label: 'Spacious' }]} />
        </Row>
        <Row label="Font">
          <Chips small value={fontFamily} onChange={setFontFamily} options={[
            { value: 'serif', label: 'Serif' }, { value: 'default', label: 'Default' }, { value: 'light', label: 'Light' },
            { value: 'condensed', label: 'Condensed' }, { value: 'mono', label: 'Mono' }]} />
        </Row>
        <Row label="Font applies to">
          <Chips small value={fontScope} onChange={setFontScope} options={[{ value: 'verse', label: 'Verse text only' }, { value: 'all', label: 'All text' }]} />
        </Row>
        <Row label="Startup translation">
          <select className="map-select" value={startupTrans} onChange={e => setStartupTrans(e.target.value)}>
            <option value="last">Same as left off</option>
            {TRANSLATIONS.map(t => <option key={t.key} value={t.key}>{t.label} — {t.full}</option>)}
          </select>
        </Row>
        <Row label="Startup position">
          <Chips small value={startupMode} onChange={setStartupMode} options={[{ value: 'resume', label: 'Resume reading' }, { value: 'john1', label: 'John 1' }]} />
        </Row>

        <div className="settings-section">Search</div>
        <Toggle on={strongsInSearch} onChange={setStrongsInSearch} label="Strong's in Search" desc="Make H/G tags in KJV+ results clickable" />
        <Toggle on={searchOrder} onChange={setSearchOrder} label="Biblical Book Order" desc="Sort search results Genesis → Revelation instead of by relevance" />
        <Row label="Search mode">
          <Chips small value={searchMode} onChange={setSearchMode} options={[
            { value: 'exact_words', label: 'Exact words' }, { value: 'fuzzy', label: 'Fuzzy (typo correction)' },
            { value: 'exact_phrase', label: 'Exact phrase' }, { value: 'exact_all_words', label: 'All words' }]} />
        </Row>

        <div className="settings-section">ESV Bible</div>
        <Row label={esvKey ? 'API key set' : 'No API key'}><button className="btn btn--small" onClick={() => setEsvOpen(true)}>{esvKey ? 'Change / remove key' : 'Set up the ESV'}</button></Row>

        <div className="settings-section">Data</div>
        <Row label="Reset all settings"><button className="btn btn--small btn--danger" onClick={() => { if (confirm('Reset theme, reading and search settings to their defaults?')) reset() }}>Reset</button></Row>

        <div className="settings-section">About</div>
        <Row label="Version">{version}</Row>
        <Row label="Email"><button className="link-btn" onClick={() => window.api.openExternal('mailto:solendor.queries@gmail.com')}>solendor.queries@gmail.com</button></Row>
        <Row label="GitHub"><button className="link-btn" onClick={() => window.api.openExternal('https://github.com/Solendor-S')}>github.com/Solendor-S</button></Row>
        <Row label="Changelog"><button className="link-btn" onClick={onOpenChangelog}>View release notes</button></Row>
        <Row label="Credits"><button className="link-btn" onClick={() => setCredits(true)}>Credits &amp; attribution</button></Row>
      </Modal>
      <EsvSetupModal open={open && esvOpen} onClose={() => setEsvOpen(false)} />
      <Modal open={open && credits} onClose={() => setCredits(false)} title="Credits & Attribution">
        {CREDITS.map(c => (
          <div key={c.title} className="info-card">
            <b>{c.title}</b><p>{c.body}</p>
            {c.url && <button className="link-btn" onClick={() => window.api.openExternal(c.url!)}>{c.url}</button>}
          </div>
        ))}
      </Modal>
    </>
  )
}
