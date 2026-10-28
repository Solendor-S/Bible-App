// Data from the Android app (Patristica src/screens/SchismsPanel.tsx), extracted verbatim.

export type SchismStatus = 'Ongoing' | 'Healed' | 'Partially Healed'

export interface Schism {
  yearNum: number
  year: string
  name: string
  parties: string
  cause: string
  outcome: string
  status: SchismStatus
  notes?: string
}

export const BADGE_COLOR: Record<SchismStatus, { bg: string; text: string }> = {
  Ongoing:            { bg: 'rgba(196,90,90,0.18)',   text: '#c45a5a' },
  'Partially Healed': { bg: 'rgba(196,136,90,0.18)', text: '#c4885a' },
  Healed:             { bg: 'rgba(107,160,107,0.18)', text: '#6ba06b' },
}

export const SCHISMS: Schism[] = [
  {
    yearNum: 251,
    year: '251',
    name: 'Novatian Schism',
    parties: 'Novatianists vs. the catholic church',
    cause: 'Novatian, a Roman presbyter, was consecrated as a rival bishop of Rome after disagreeing that Christians who lapsed under persecution (the lapsi) could ever be readmitted to the church, even after repentance. His position is known as Novatianism.',
    outcome: 'Novatianist congregations persisted independently for over a century, maintaining strict discipline. Eventually absorbed or died out by the 5th–6th century.',
    status: 'Healed',
    notes: 'Shares the same root cause as Donatism; both movements denied absolution to the lapsed and demanded a pure church.',
  },
  {
    yearNum: 306,
    year: 'c. 306–415',
    name: 'Meletian Schism',
    parties: 'Meletius of Lycopolis vs. Peter of Alexandria',
    cause: 'Meletius of Lycopolis began ordaining clergy in other bishops\' dioceses during the Diocletianic persecution without authorisation. When Peter of Alexandria returned from hiding, he refused to accept Meletius\'s uncanonical ordinations.',
    outcome: 'Meletius was condemned at the Council of Alexandria (306). His followers, the "Church of the Martyrs," continued independently in Egypt for over a century before eventually dying out.',
    status: 'Healed',
  },
  {
    yearNum: 311,
    year: '311–411',
    name: 'Donatist Schism',
    parties: 'Donatists vs. the catholic church in North Africa',
    cause: 'Donatus and his followers refused to recognise Caecilian as bishop of Carthage because he had been consecrated by Felix of Aptunga, allegedly a traditor (one who surrendered scriptures under Diocletian\'s persecution). They demanded re-ordination and re-baptism from morally pure clergy, a position known as Donatism.',
    outcome: 'Condemned at the Council of Arles (314) and repeatedly by the Council of Carthage thereafter. Augustine of Hippo argued extensively against it. Suppressed by imperial decree but lingered until the Islamic conquest of North Africa effectively ended it.',
    status: 'Healed',
    notes: 'Augustine\'s anti-Donatist writings produced the definitive theology of the church and sacraments: validity rests on Christ, not the minister\'s moral state.',
  },
  {
    yearNum: 484,
    year: '484–519',
    name: 'Acacian Schism',
    parties: 'Rome vs. Constantinople',
    cause: 'Emperor Zeno issued the Henotikon (482), a compromise formula drafted by Patriarch Acacius of Constantinople that deliberately avoided the Chalcedonian Definition to placate Eutychianism sympathisers. Pope Felix III excommunicated Acacius in 484 for supporting it without papal consent.',
    outcome: 'The schism lasted 35 years and was healed in 519 under Emperor Justin I, who accepted the Council of Chalcedon and the Tome of Leo in full. The Henotikon was repudiated.',
    status: 'Healed',
  },
  {
    yearNum: 863,
    year: '863–867 / 877–880',
    name: 'Photian Schism',
    parties: 'Pope Nicholas I vs. Patriarch Photius of Constantinople',
    cause: 'Emperor Michael III appointed the layman Photius as Patriarch of Constantinople over the canonically elected Ignatius. Pope Nicholas I refused to recognise Photius, who retaliated by condemning the Filioque addition to the Niceno-Constantinopolitan Creed and challenging Roman jurisdiction in Bulgaria.',
    outcome: 'Photius was deposed, then restored. A council in 879–880 rehabilitated him and condemned any addition to the Niceno-Constantinopolitan Creed. The disputes over jurisdiction and the Filioque remained unresolved and foreshadowed the Great Schism.',
    status: 'Healed',
    notes: 'The Filioque ("and the Son") — the Western insertion into the Niceno-Constantinopolitan Creed regarding the procession of the Holy Spirit — first became a major point of contention here.',
  },
  {
    yearNum: 1054,
    year: '1054',
    name: 'East-West Schism (Great Schism)',
    parties: 'Roman Catholic Church vs. Eastern Orthodox Church',
    cause: 'Centuries of tensions culminated when Cardinal Humbert placed a bull of excommunication on the altar of Hagia Sophia against Patriarch Michael Cerularius, who excommunicated the papal legates in return. Key disputes: papal primacy, the Filioque addition to the Niceno-Constantinopolitan Creed, use of unleavened bread, clerical celibacy, and jurisdiction over newly Christianised nations.',
    outcome: 'The mutual excommunications were symbolically lifted in 1964 by Pope Paul VI and Patriarch Athenagoras I, but full communion has not been restored. The two churches remain separate.',
    status: 'Partially Healed',
    notes: 'The most consequential schism in Christian history, dividing the church into its two largest ancient traditions.',
  },
  {
    yearNum: 1378,
    year: '1378–1417',
    name: 'Western Schism (Papal Schism)',
    parties: 'Competing claimants to the papacy — Roman line, Avignon line, and briefly a Pisan line',
    cause: 'After Gregory XI returned the papacy from Avignon to Rome, the cardinals elected Urban VI, then declared the election invalid and elected a rival, Clement VII, who returned to Avignon. For nearly 40 years, Western Christianity was split between two — and briefly three — claimants each claiming to be the true pope.',
    outcome: 'Resolved by the Council of Constance (1414–1418), which deposed or accepted the resignation of all claimants and elected Martin V as sole pope. Severely damaged papal prestige and fuelled conciliarism.',
    status: 'Healed',
    notes: 'Not a doctrinal schism — all parties agreed on theology. A purely institutional and political crisis.',
  },
  {
    yearNum: 1517,
    year: '1517–present',
    name: 'Protestant Reformation',
    parties: 'Lutheran, Reformed, Anglican, and other Protestant movements vs. the Roman Catholic Church',
    cause: 'Martin Luther\'s Ninety-Five Theses (1517) ignited a crisis over indulgences, papal authority, and salvation. Core disputes: justification by faith alone (sola fide), Scripture as sole authority (sola scriptura), the nature of the sacraments, and papal primacy. Zwingli and Calvin developed Reformed traditions; Henry VIII broke from Rome to form the Church of England.',
    outcome: 'Produced hundreds of Protestant denominations. The Council of Trent (1545–1563) defined Catholic doctrine in response. The fracture remains, though the 1999 Joint Declaration on Justification between Catholics and Lutherans reduced tensions on a key point.',
    status: 'Ongoing',
    notes: 'The most theologically diverse schism, spawning traditions from Lutheranism and Calvinism to Anabaptism, Methodism, and Pentecostalism.',
  },
  {
    yearNum: 1534,
    year: '1534–present',
    name: 'Anglican Schism',
    parties: 'Church of England vs. the Roman Catholic Church',
    cause: 'Henry VIII\'s Act of Supremacy (1534) declared the English monarch Supreme Head of the Church of England, severing it from Rome. The immediate cause was Pope Clement VII\'s refusal to annul Henry\'s marriage to Catherine of Aragon. Theological Protestantism was later introduced under Edward VI and consolidated under Elizabeth I.',
    outcome: 'The Church of England and the worldwide Anglican Communion remain separate from Rome. Ecumenical dialogues (ARCIC) have produced agreed statements on doctrine, but full communion has not been restored.',
    status: 'Ongoing',
    notes: 'Anglicanism considers itself a "middle way" (via media) between Roman Catholicism and continental Protestantism.',
  },
  {
    yearNum: 1870,
    year: '1870–present',
    name: 'Old Catholic Schism',
    parties: 'Old Catholic Church vs. the Roman Catholic Church',
    cause: 'The First Vatican Council (1870) defined papal infallibility and universal papal jurisdiction. German, Swiss, and Austrian theologians who rejected these definitions formed the Old Catholic Church, arguing the definitions were historically unwarranted and exceeded the bounds set by earlier councils like the Council of Constance.',
    outcome: 'The Old Catholic Church entered into full communion with the Church of England in 1931 (Bonn Agreement). Remains in impaired or no communion with Rome.',
    status: 'Ongoing',
    notes: 'Old Catholics ordain women to the priesthood, which has complicated ecumenical relations with both Rome and Orthodoxy.',
  },
]

// ── Cross-reference link patterns ─────────────────────────
// Longest-first within each group so substrings don't match before the full name

export const CREED_LINK_PATTERNS = [
  'Niceno-Constantinopolitan Creed',
  'Chalcedonian Definition',
  "Apostles' Creed",
  'Athanasian Creed',
  'Nicene Creed',
]

export const HERESY_LINK_PATTERNS = [
  'Semi-Pelagianism',
  'Macedonianism',
  'Monothelitism',
  'Eutychianism',
  'Nestorianism',
  'Novatianism',
  'Iconoclasm',
  'Arianism',
  'Donatism',
]

export const COUNCIL_LINK_PATTERNS = [
  'First Council of Constantinople',
  'Third Council of Constantinople',
  'Second Council of Constantinople',
  'Fourth Council of Constantinople',
  'Second Council of Nicaea',
  'First Council of Nicaea',
  'Second Council of Orange',
  'Council of Chalcedon',
  'Council of Alexandria',
  'Council of Carthage',
  'Council of Ephesus',
  'Council of Antioch',
  'Council of Arles',
  'Council of Hippo',
]

export const _linkRe = new RegExp(
  `(${[...CREED_LINK_PATTERNS, ...HERESY_LINK_PATTERNS, ...COUNCIL_LINK_PATTERNS]
    .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})`,
  'g',
)
