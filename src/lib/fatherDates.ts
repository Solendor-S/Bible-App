// Maps Church Father names to their approximate lifespan or floruit dates.
// Used to display specific dates instead of generic era labels in the commentary panel.

const FATHER_DATES: Record<string, string> = {
  // Apostolic & Sub-Apostolic (1st–2nd c.)
  'Clement of Rome':              'fl. c. 88–99',
  'Ignatius of Antioch':          'c. 35–108',
  'Polycarp of Smyrna':           'c. 69–155',
  'Papias of Hierapolis':         'c. 60–130',
  'Justin Martyr':                'c. 100–165',
  'Tatian':                       'c. 120–180',
  'Tatian the Assyrian':          'c. 120–180',
  'Athenagoras of Athen':         'fl. c. 177',
  'Minucius Felix':               'fl. c. 200–240',
  'Melito of Sardis':             'fl. c. 170',

  // 2nd–3rd c.
  'Irenaeus of Lyons':            'c. 130–202',
  'Clement Of Alexandria':        'c. 150–215',
  'Tertullian':                   'c. 155–220',
  'Tertullian of Carthage':       'c. 155–220',
  'Hippolytus of Rome':           'c. 170–235',
  'Origen of Alexandria':         'c. 184–253',
  'Pseudo-Origen':                'c. 3rd–4th c.',
  'Origen':                       'c. 184–253',
  'Cyprian of Carthage':          'c. 200–258',
  'Cyprian':                      'c. 200–258',
  'Dionysius of Alexandria':      'c. 190–264',
  'Julius Africanus':             'c. 160–240',
  'Gregory the Wonderworker':     'c. 213–270',
  'Methodius of Olympus':         'c. 260–311',
  'Arnobius of Sicca':            'fl. c. 295–310',
  'Victorinus of Pettau':         'd. c. 304',

  // 4th c.
  'Eusebius of Caesarea':         'c. 260–339',
  'Alexander of Alexandria':      'c. 250–328',
  'Athanasius of Alexandria':     'c. 296–373',
  'Athanasius the Apostolic':     'c. 296–373',
  'Hilary of Poitiers':           'c. 310–367',
  'Hil':                          'c. 310–367',
  'Cyril of Jerusalem':           'c. 315–386',
  'Basil of Caesarea':            'c. 330–379',
  'Basil the Great':              'c. 330–379',
  'Ephrem The Syrian':            'c. 306–373',
  'Gregory of Nyssa':             'c. 335–394',
  'Ambrose of Milan':             'c. 340–397',
  'John Chrysostom':              'c. 349–407',
  'Diodorus of Tarsus':           'c. 330–390',
  'Amphilochius of Iconium':      'c. 340–403',
  'Epiphanius of Cyprus':         'c. 315–403',
  'Chromatius of Aquileia':       'c. 340–407',
  'Evagrius Ponticus':            '345–399',
  'Palladius of Antioch':         'c. 363–430',
  'Philastrius of Brescia':       'd. c. 397',
  'Maximus of Turin':             'fl. c. 380–420',
  'Nemesius of Emesa':            'fl. c. 390',
  'Paulinus of Nola':             '354–431',
  'Rufinus of Aquileia':          'c. 345–411',
  'Sulpicius Severus':            'c. 363–425',
  'Faustinus of Lyon':            'fl. 4th c.',
  'Gaudentius of Rimini':         'fl. c. 387–406',
  'Lucifer of Cagliari':          'd. 370',
  'Callistus I of Rome':          'd. 222',
  'Macarius the Great':           'c. 300–391',

  // 4th–5th c.
  'Jerome of Stridon':            'c. 347–420',
  'Jerome':                       'c. 347–420',
  'Augustine of Hippo':           '354–430',
  'Pacian of Barcelona':          'c. 310–391',
  'Paulinus of Milan':            'fl. c. 395–422',
  'Pelagius':                     'c. 354–420',
  'John Cassian':                 'c. 360–435',
  'Cassian':                      'c. 360–435',
  'Vincent of Lérins':            'd. c. 445',
  'Prosper of Aquitaine':         'c. 390–455',
  'Gaius Marius Victorinus':      'c. 280–365',
  'Ambrosiaster':                 'fl. c. 366–384',
  'Eusebius of Emesa':            'c. 300–359',
  'Didymus the Blind':            'c. 313–398',
  'Severian of Gabala':           'fl. c. 380–408',
  'Severianus':                   'fl. c. 380–408',
  'Nicetas of Remesiana':         'c. 335–414',

  // 5th c.
  'Cyril of Alexandria':          'c. 376–444',
  'Leo the Great':                'c. 400–461',
  'Peter Chrysologus':            'c. 380–450',
  'Theodoret of Cyrrhus':         'c. 393–458',
  'Titus of Bostra':              'fl. c. 370',
  'Titus':                        'fl. c. 370',
  'Julian of Eclanum':            'c. 386–455',
  'Quodvultdeus':                 'd. c. 454',
  'Euthymius Zigabenus':          'c. 1050–1118',
  'Faustus of Riez':              'c. 400–490',
  'Salvian the Presbyter':        'c. 400–480',
  'Gelasius of Rome':             'd. 496',
  'Gennadius of Constantinople':  'd. 471',
  'Hesychius of Jerusalem':       'fl. c. 412–450',
  'Diadochos of Photiki':         'fl. c. 451–458',
  'Fulgentius of Ruspe':          'c. 462–527',
  'Caesarius of Arles':           'c. 470–542',

  // 5th–6th c.
  'Procopius of Gaza':            'c. 465–528',
  'Eugippius':                    'c. 455–535',
  'Cassiodorus Senator':          'c. 485–585',
  'Olympiodorus of Alexandria':   'fl. c. 500–565',
  'Oecumenius':                   'fl. c. 6th c.',
  'Primasius of Hadrumetum':      'd. c. 560',
  'Apringius of Beja':            'fl. c. 531–548',
  'Verecundus of Junca':          'd. 552',
  'Facundus of Hermiane':         'fl. c. 546–571',

  // 6th–7th c.
  'Gregory the Great':            'c. 540–604',
  'Gregory The Dialogist':        'c. 540–604',
  'Leander of Seville':           'c. 534–601',
  'Isodore of Seville':           'c. 560–636',
  'Sophronius of Jerusalem':      'c. 560–638',
  'Fructuosus of Braga':          'c. 600–665',
  'Adamnán of Iona':              'c. 627–704',
  'Julian of Toledo':             'c. 642–690',
  'Martin of Braga':              'c. 520–580',
  'Dorotheos of Gaza':            'c. 505–565',

  // 7th–8th c.
  'Venerable Bede':               '672–735',
  'Bede':                         '672–735',
  'John of Damascus':             'c. 675–749',
  'Alcuin of York':               'c. 735–804',

  // 8th–9th c.
  'Rabanus Maurus':               'c. 780–856',
  'Haimo of Auxerre':             'fl. c. 840–865',
  'Remigius of Auxerre':          'c. 841–908',
  'Remigius of Rheims':           'c. 437–533',
  'Haymo':                        'fl. c. 9th c.',
  'Paschasius':                   'c. 790–865',
  'Thietland of Einsiedeln':      'fl. c. 965',

  // 10th–11th c.
  'Symeon the New Theologian':    '949–1022',
  'Theophylact of Ohrid':         'c. 1050–1107',
  'Theophylact of Ochrid':        'c. 1050–1107',
  'Anselm of Canterbury':         '1033–1109',
  'Anselm of Laon':               'c. 1050–1117',
  'Oecumenius (medieval)':        'fl. c. 6th c.',
  'Isaac of Syria':               'd. c. 700',
  'Maximus the Confessor':        'c. 580–662',

  // 11th–13th c. (Post-Medieval)
  'Bernard of Clairvaux':         '1090–1153',
  'Richard of Saint Victor':      'd. 1173',
  'Hugh of Saint-Cher':           'c. 1190–1263',
  'Thomas Aquinas':               '1225–1274',
  'Nicholas of Gorran':           'c. 1232–1295',
  'Nicholas of Lyra':             'c. 1270–1349',
  'Peter Olivi':                  '1248–1298',
  'Petrus Alphonsi':              'c. 1062–1110',

  // 14th–17th c.
  'Erasmus of Rotterdam':         '1466–1536',
  'John of the Cross':            '1542–1591',
  'Cornelius a Lapide':           '1567–1637',
  'Haymo of Faversham':           'd. 1244',
  'Marcellin Champagnat':         '1789–1840',

  // 17th–19th c.
  'Richard Challoner':            '1691–1781',
  'George Leo Haydock':           '1774–1849',
  'Glossa Ordinaria':             'c. 12th c.',
  'Interlinear Gloss':            'c. 12th c.',

  // Byzantine
  'Gregory Palamas':              '1296–1359',
  'Gregory the Theologian':       'c. 329–390',
  'Jacob Bar-Salibi':             'd. 1171',
}

/**
 * Returns the earliest year associated with a father for sorting purposes.
 * Falls back to a rough century midpoint from the era label.
 */
export function getFatherSortYear(fatherName: string, fallbackEra: string): number {
  const dateStr = FATHER_DATES[fatherName] || FATHER_DATES[fatherName.split(',')[0].trim()]
  if (dateStr) {
    const m = dateStr.match(/\d{2,4}/)
    if (m) return parseInt(m[0])
  }
  const eraYears: Record<string, number> = {
    '2nd–3rd c.': 175, '3rd c.': 250, '4th c.': 350, '4th–5th c.': 400,
    '5th c.': 450, '6th–7th c.': 575, '7th–8th c.': 710, '8th c.': 750,
    '9th c.': 850, '11th–12th c.': 1080, 'Early Church': 400,
    'Medieval': 900, 'Byzantine': 900, 'Post-Medieval': 1400,
  }
  return eraYears[fallbackEra] ?? 500
}

/**
 * Returns a specific date string for a Church Father, falling back to the
 * era label from the DB if no specific dates are known.
 */
export function getFatherDates(fatherName: string, fallbackEra: string): string {
  // Direct match
  if (FATHER_DATES[fatherName]) return FATHER_DATES[fatherName]

  // Partial match — strip trailing citation info (e.g. "Cyprian, Tr. vii")
  const baseName = fatherName.split(',')[0].trim()
  if (FATHER_DATES[baseName]) return FATHER_DATES[baseName]

  // Normalize era label → readable century format
  const eraMap: Record<string, string> = {
    '2nd–3rd c.':   '2nd–3rd century',
    '3rd c.':       '3rd century',
    '4th c.':       '4th century',
    '4th–5th c.':   '4th–5th century',
    '5th c.':       '5th century',
    '6th–7th c.':   '6th–7th century',
    '7th–8th c.':   '7th–8th century',
    '8th c.':       '8th century',
    '9th c.':       '9th century',
    '11th–12th c.': '11th–12th century',
    'Early Church': 'Early Church',
    'Medieval':     'Medieval',
    'Byzantine':    'Byzantine',
    'Post-Medieval':'Post-Medieval',
  }

  return eraMap[fallbackEra] || fallbackEra
}
