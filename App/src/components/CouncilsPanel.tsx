import React, { useState } from 'react'

type CouncilType = 'Ecumenical' | 'Regional' | 'Local' | 'Disputed'

interface Council {
  yearNum: number
  year: string
  name: string
  location: string
  type: CouncilType
  decree: string
  notes?: string
}

const BADGE_CLASS: Record<CouncilType, string> = {
  Ecumenical: 'historical-category-badge--ancient_author',
  Regional: 'historical-category-badge--archaeology',
  Local: 'historical-category-badge--manuscript',
  Disputed: 'historical-category-badge--inscription',
}

const COUNCILS: Council[] = [
  {
    yearNum: 49, year: 'c. 49', name: 'Council of Jerusalem', location: 'Jerusalem',
    type: 'Local',
    decree: 'Gentile inclusion without circumcision; ruled that Mosaic law is not binding on Gentile believers.',
    notes: 'Acts 15. First recorded church council.',
  },
  {
    yearNum: 155, year: 'c. 155', name: 'Council of Rome (Easter)', location: 'Rome',
    type: 'Local',
    decree: 'First recorded Easter date dispute between Anicetus of Rome and Polycarp of Smyrna; ended in mutual tolerance.',
  },
  {
    yearNum: 251, year: '251', name: 'Council of Carthage', location: 'Carthage',
    type: 'Regional',
    decree: 'Readmission of lapsed Christians under conditions of penance; opposed the rigorism of the Novatian schism.',
  },
  {
    yearNum: 268, year: '268', name: 'Council of Antioch', location: 'Antioch',
    type: 'Regional',
    decree: 'Condemned Paul of Samosata for adoptionist Christology and deposed him as bishop of Antioch.',
  },
  {
    yearNum: 306, year: '306', name: 'Council of Elvira', location: 'Elvira, Spain',
    type: 'Local',
    decree: 'Issued 81 disciplinary canons on clergy celibacy, morality, and relations with pagans; earliest surviving full canon list.',
  },
  {
    yearNum: 314, year: '314', name: 'Council of Arles', location: 'Arles, Gaul',
    type: 'Regional',
    decree: 'Condemned Donatism; affirmed the validity of sacraments administered by unworthy ministers.',
  },
  {
    yearNum: 325, year: '325', name: 'First Council of Nicaea', location: 'Nicaea, Bithynia',
    type: 'Ecumenical',
    decree: 'Condemned Arianism; defined Christ as homoousios (consubstantial) with the Father; produced the original Nicene Creed.',
    notes: '1st Ecumenical Council. ~300 bishops attended, convened by Emperor Constantine.',
  },
  {
    yearNum: 341, year: '341', name: 'Council of Antioch', location: 'Antioch',
    type: 'Regional',
    decree: 'Issued 25 canons on episcopal authority and church order; theological stance influenced by semi-Arian parties.',
  },
  {
    yearNum: 343, year: '343', name: 'Council of Serdica', location: 'Serdica (Sofia)',
    type: 'Regional',
    decree: 'Reaffirmed Nicaea; established right of appeal to the bishop of Rome; attempted East-West reconciliation.',
  },
  {
    yearNum: 363, year: 'c. 363', name: 'Council of Laodicea', location: 'Laodicea, Phrygia',
    type: 'Regional',
    decree: 'Listed canonical scriptures; banned private assemblies and Judaizing practices; issued 60 disciplinary canons.',
  },
  {
    yearNum: 381, year: '381', name: 'First Council of Constantinople', location: 'Constantinople',
    type: 'Ecumenical',
    decree: 'Condemned Macedonianism; affirmed full divinity of the Holy Spirit; expanded the Nicene Creed to its present form.',
    notes: '2nd Ecumenical Council. Convened by Emperor Theodosius I.',
  },
  {
    yearNum: 393, year: '393', name: 'Council of Hippo', location: 'Hippo, North Africa',
    type: 'Regional',
    decree: 'Ratified the 27-book New Testament canon; Augustine of Hippo was present.',
  },
  {
    yearNum: 397, year: '397', name: 'Council of Carthage', location: 'Carthage',
    type: 'Regional',
    decree: 'Confirmed the biblical canon established at Hippo; regulated clerical discipline and liturgical practice.',
  },
  {
    yearNum: 431, year: '431', name: 'Council of Ephesus', location: 'Ephesus',
    type: 'Ecumenical',
    decree: 'Condemned Nestorianism; affirmed Mary as Theotokos (God-bearer); rejected any division of Christ into two persons.',
    notes: '3rd Ecumenical Council. Presided over by Cyril of Alexandria.',
  },
  {
    yearNum: 451, year: '451', name: 'Council of Chalcedon', location: 'Chalcedon, Bithynia',
    type: 'Ecumenical',
    decree: 'Defined Christ as one person in two natures, divine and human, without confusion or separation; condemned Eutychianism.',
    notes: '4th Ecumenical Council. ~520 bishops. The Oriental Orthodox churches rejected this definition.',
  },
  {
    yearNum: 529, year: '529', name: 'Second Council of Orange', location: 'Orange, Gaul',
    type: 'Regional',
    decree: 'Condemned Semi-Pelagianism; affirmed that grace is necessary for the beginning of faith and all salvific acts.',
  },
  {
    yearNum: 553, year: '553', name: 'Second Council of Constantinople', location: 'Constantinople',
    type: 'Ecumenical',
    decree: 'Condemned the Three Chapters (writings of Theodore of Mopsuestia, Theodoret, and Ibas of Edessa) to reconcile Monophysites.',
    notes: '5th Ecumenical Council. Convened by Emperor Justinian I.',
  },
  {
    yearNum: 589, year: '589', name: 'Third Council of Toledo', location: 'Toledo, Spain',
    type: 'Regional',
    decree: 'Visigothic king Reccared converted from Arianism to Catholicism; the Filioque ("and the Son") first added to the Creed in the West.',
  },
  {
    yearNum: 680, year: '680–681', name: 'Third Council of Constantinople', location: 'Constantinople',
    type: 'Ecumenical',
    decree: 'Condemned Monothelitism; affirmed two wills in Christ (divine and human), acting without contradiction.',
    notes: '6th Ecumenical Council. Also condemned Pope Honorius I posthumously.',
  },
  {
    yearNum: 787, year: '787', name: 'Second Council of Nicaea', location: 'Nicaea, Bithynia',
    type: 'Ecumenical',
    decree: 'Condemned Iconoclasm; affirmed that veneration (proskynesis) of icons is lawful and distinct from the worship (latreia) due to God alone.',
    notes: '7th Ecumenical Council. Last council recognized by both Eastern and Western Christianity.',
  },
  {
    yearNum: 794, year: '794', name: 'Council of Frankfurt', location: 'Frankfurt',
    type: 'Regional',
    decree: 'Frankish church, under Charlemagne, rejected the icon decrees of Nicaea II; complicated East-West relations.',
  },
  {
    yearNum: 869, year: '869–870', name: 'Fourth Council of Constantinople', location: 'Constantinople',
    type: 'Disputed',
    decree: 'Deposed Patriarch Photius and condemned the Photian Schism. Recognized as the 8th Ecumenical Council by Rome; rejected as invalid by Eastern Orthodoxy.',
  },
  {
    yearNum: 879, year: '879–880', name: 'Council of Constantinople (Photian)', location: 'Constantinople',
    type: 'Disputed',
    decree: 'Restored Photius as patriarch; condemned any addition to the Nicene Creed (targeting the Filioque). Recognized as the 8th Ecumenical Council by Eastern Orthodoxy.',
  },
]

export function CouncilsPanel() {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q
    ? COUNCILS.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.decree.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q) ||
        c.year.toLowerCase().includes(q) ||
        (c.notes?.toLowerCase().includes(q) ?? false)
      )
    : COUNCILS

  return (
    <div className="panel-body">
      <input
        className="commentary-father-search"
        placeholder="Filter councils…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        spellCheck={false}
      />
      {filtered.length === 0 && (
        <div className="panel-empty">No councils match "{query}".</div>
      )}
      {filtered.map(council => (
        <div key={council.yearNum + council.name} className="historical-entry">
          <div className="historical-header">
            <div className="historical-title-row">
              <span className="historical-title">{council.name}</span>
            </div>
            <div className="historical-meta-row">
              <span className={`historical-category-badge ${BADGE_CLASS[council.type]}`}>
                {council.type}
              </span>
              <span className="historical-date">{council.year} AD</span>
              <span className="historical-location">{council.location}</span>
            </div>
          </div>
          {council.notes && (
            <div className="historical-significance">
              <span className="historical-significance-label">Context</span>
              <p className="historical-significance-text">{council.notes}</p>
            </div>
          )}
          <p className="historical-description">{council.decree}</p>
        </div>
      ))}
    </div>
  )
}
