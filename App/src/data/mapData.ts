export interface MapCity {
  name: string
  lat: number
  lng: number
  description: string
}

export interface MapJourney {
  id: string
  label: string
  color: string
  route: [number, number][]
  cities: MapCity[]
  passages: Array<{ book: string; chapterStart: number; chapterEnd: number }>
}

export const JOURNEYS: MapJourney[] = [
  {
    id: 'paul-1',
    label: "Paul's 1st Journey",
    color: '#f59e0b',
    passages: [{ book: 'Acts', chapterStart: 13, chapterEnd: 14 }],
    route: [
      [36.20, 36.16],  // Antioch (Syria)
      [36.12, 35.93],  // Seleucia (port)
      [35.17, 33.90],  // Salamis (Cyprus)
      [34.77, 32.42],  // Paphos (Cyprus)
      [36.96, 30.85],  // Perga
      [38.27, 31.19],  // Antioch (Pisidia)
      [37.87, 32.48],  // Iconium
      [37.57, 32.35],  // Lystra
      [37.36, 33.37],  // Derbe
      [37.57, 32.35],  // Lystra (return)
      [37.87, 32.48],  // Iconium (return)
      [38.27, 31.19],  // Antioch (Pisidia) (return)
      [36.88, 30.70],  // Attalia
      [36.12, 35.93],  // Seleucia
      [36.20, 36.16],  // Antioch (Syria)
    ],
    cities: [
      { name: 'Antioch (Syria)', lat: 36.20, lng: 36.16, description: 'Home base — Paul and Barnabas sent out by the church here (Acts 13:1–3)' },
      { name: 'Seleucia Pieria', lat: 36.12, lng: 35.93, description: 'Port of Antioch — they sailed from here to Cyprus (Acts 13:4)' },
      { name: 'Salamis (Cyprus)', lat: 35.17, lng: 33.90, description: 'First stop in Cyprus — preached in the synagogues (Acts 13:5)' },
      { name: 'Paphos (Cyprus)', lat: 34.77, lng: 32.42, description: 'Paul confronted Bar-Jesus the sorcerer; proconsul Sergius Paulus believed (Acts 13:6–12)' },
      { name: 'Perga (Pamphylia)', lat: 36.96, lng: 30.85, description: 'John Mark departed for Jerusalem here (Acts 13:13)' },
      { name: 'Antioch (Pisidia)', lat: 38.27, lng: 31.19, description: 'Paul\'s landmark synagogue sermon; expelled by Jewish opposition (Acts 13:14–52)' },
      { name: 'Iconium', lat: 37.87, lng: 32.48, description: 'Many believed; plot to stone them forced them to flee (Acts 14:1–6)' },
      { name: 'Lystra', lat: 37.57, lng: 32.35, description: 'Paul healed a lame man; crowd tried to worship them as gods; Paul stoned and left for dead (Acts 14:8–20)' },
      { name: 'Derbe', lat: 37.36, lng: 33.37, description: 'Made many disciples; turned back to strengthen the churches (Acts 14:20–21)' },
      { name: 'Attalia', lat: 36.88, lng: 30.70, description: 'Sailed from here back to Antioch (Acts 14:25–26)' },
    ],
  },
  {
    id: 'paul-2',
    label: "Paul's 2nd Journey",
    color: '#60a5fa',
    passages: [{ book: 'Acts', chapterStart: 15, chapterEnd: 18 }],
    route: [
      [36.20, 36.16],  // Antioch (Syria)
      [37.36, 33.37],  // Derbe
      [37.57, 32.35],  // Lystra
      [39.78, 26.14],  // Troas
      [40.47, 25.53],  // Samothrace
      [40.94, 24.40],  // Neapolis
      [41.01, 24.28],  // Philippi
      [40.64, 22.94],  // Thessalonica
      [40.52, 22.20],  // Berea
      [37.97, 23.73],  // Athens
      [37.94, 22.93],  // Corinth
      [37.94, 27.34],  // Ephesus
      [32.49, 34.89],  // Caesarea
      [31.77, 35.23],  // Jerusalem
      [36.20, 36.16],  // Antioch (Syria)
    ],
    cities: [
      { name: 'Antioch (Syria)', lat: 36.20, lng: 36.16, description: 'Paul and Silas set out after the Jerusalem Council (Acts 15:36–40)' },
      { name: 'Lystra', lat: 37.57, lng: 32.35, description: 'Timothy joined as a co-worker here (Acts 16:1–3)' },
      { name: 'Troas', lat: 39.78, lng: 26.14, description: 'Paul received the "Macedonian vision" — calling him to Europe (Acts 16:8–10)' },
      { name: 'Samothrace', lat: 40.47, lng: 25.53, description: 'Island stop on the way to Macedonia (Acts 16:11)' },
      { name: 'Neapolis', lat: 40.94, lng: 24.40, description: 'First landing point in Europe (Acts 16:11)' },
      { name: 'Philippi', lat: 41.01, lng: 24.28, description: 'Lydia baptised; Paul and Silas imprisoned and freed by earthquake (Acts 16:12–40)' },
      { name: 'Thessalonica', lat: 40.64, lng: 22.94, description: 'Many believed; Jews stirred up a mob, forcing Paul to leave (Acts 17:1–9)' },
      { name: 'Berea', lat: 40.52, lng: 22.20, description: 'Bereans examined the Scriptures daily — praised for nobility (Acts 17:10–12)' },
      { name: 'Athens', lat: 37.97, lng: 23.73, description: 'Paul\'s famous Areopagus sermon on the "unknown God" (Acts 17:16–34)' },
      { name: 'Corinth', lat: 37.94, lng: 22.93, description: 'Stayed 18 months; met Aquila and Priscilla; wrote 1 & 2 Thessalonians (Acts 18:1–18)' },
      { name: 'Ephesus', lat: 37.94, lng: 27.34, description: 'Brief stop; left Priscilla and Aquila here (Acts 18:19–21)' },
      { name: 'Caesarea Maritima', lat: 32.49, lng: 34.89, description: 'Landed and greeted the church (Acts 18:22)' },
      { name: 'Jerusalem', lat: 31.77, lng: 35.23, description: 'Went up and greeted the church (Acts 18:22)' },
    ],
  },
  {
    id: 'paul-3',
    label: "Paul's 3rd Journey",
    color: '#4ade80',
    passages: [{ book: 'Acts', chapterStart: 18, chapterEnd: 21 }],
    route: [
      [36.20, 36.16],  // Antioch (Syria)
      [38.27, 31.19],  // Antioch (Pisidia) area / Galatia
      [37.94, 27.34],  // Ephesus
      [41.01, 24.28],  // Philippi / Macedonia
      [40.64, 22.94],  // Thessalonica
      [37.94, 22.93],  // Corinth (Greece)
      [40.64, 22.94],  // Thessalonica (return)
      [41.01, 24.28],  // Philippi (return)
      [39.78, 26.14],  // Troas
      [37.52, 27.28],  // Miletus
      [36.90, 27.31],  // Cos
      [36.43, 28.22],  // Rhodes
      [36.26, 29.31],  // Patara
      [33.27, 35.20],  // Tyre
      [32.93, 35.07],  // Ptolemais
      [32.49, 34.89],  // Caesarea
      [31.77, 35.23],  // Jerusalem
    ],
    cities: [
      { name: 'Antioch (Syria)', lat: 36.20, lng: 36.16, description: 'Paul set out again through Galatia and Phrygia (Acts 18:23)' },
      { name: 'Ephesus', lat: 37.94, lng: 27.34, description: 'Paul\'s longest stay — over 2 years; extraordinary miracles; silversmiths\' riot (Acts 19)' },
      { name: 'Philippi', lat: 41.01, lng: 24.28, description: 'Paul passed through Macedonia strengthening the churches (Acts 20:1–2)' },
      { name: 'Corinth', lat: 37.94, lng: 22.93, description: 'Spent 3 months; wrote Romans here (Acts 20:2–3)' },
      { name: 'Troas', lat: 39.78, lng: 26.14, description: 'Paul raised Eutychus from the dead after he fell from a window (Acts 20:6–12)' },
      { name: 'Miletus', lat: 37.52, lng: 27.28, description: 'Farewell address to the Ephesian elders — one of Paul\'s most moving speeches (Acts 20:17–38)' },
      { name: 'Cos', lat: 36.90, lng: 27.31, description: 'Island stop on the way south (Acts 21:1)' },
      { name: 'Rhodes', lat: 36.43, lng: 28.22, description: 'Island stop on the way south (Acts 21:1)' },
      { name: 'Patara', lat: 36.26, lng: 29.31, description: 'Changed ships for the voyage to Phoenicia (Acts 21:1–2)' },
      { name: 'Tyre', lat: 33.27, lng: 35.20, description: 'Disciples urged Paul not to go to Jerusalem (Acts 21:3–6)' },
      { name: 'Ptolemais (Akko)', lat: 32.93, lng: 35.07, description: 'Greeted the brothers and stayed one day (Acts 21:7)' },
      { name: 'Caesarea Maritima', lat: 32.49, lng: 34.89, description: 'Prophet Agabus foretold Paul\'s arrest in Jerusalem (Acts 21:8–14)' },
      { name: 'Jerusalem', lat: 31.77, lng: 35.23, description: 'Paul arrested in the temple — beginning of his imprisonment (Acts 21:15–36)' },
    ],
  },
  {
    id: 'paul-4',
    label: "Paul's Voyage to Rome",
    color: '#f87171',
    passages: [{ book: 'Acts', chapterStart: 27, chapterEnd: 28 }],
    route: [
      [32.49, 34.89],  // Caesarea
      [33.56, 35.37],  // Sidon
      [36.27, 29.98],  // Myra
      [36.67, 27.37],  // Cnidus
      [34.97, 24.79],  // Fair Havens (Crete)
      [35.90, 14.44],  // Malta (shipwreck)
      [37.08, 15.28],  // Syracuse
      [37.92, 15.66],  // Rhegium
      [40.83, 14.12],  // Puteoli
      [41.90, 12.50],  // Rome
    ],
    cities: [
      { name: 'Caesarea Maritima', lat: 32.49, lng: 34.89, description: 'Paul sailed as a prisoner under Julius the centurion (Acts 27:1)' },
      { name: 'Sidon', lat: 33.56, lng: 35.37, description: 'Julius allowed Paul to visit friends (Acts 27:3)' },
      { name: 'Myra (Lycia)', lat: 36.27, lng: 29.98, description: 'Transferred to an Alexandrian grain ship bound for Italy (Acts 27:5–6)' },
      { name: 'Cnidus', lat: 36.67, lng: 27.37, description: 'Headwinds forced them south around Crete (Acts 27:7)' },
      { name: 'Fair Havens (Crete)', lat: 34.97, lng: 24.79, description: 'Paul warned against sailing — overruled; the storm came (Acts 27:8–12)' },
      { name: 'Malta', lat: 35.90, lng: 14.44, description: 'Shipwrecked after 14 days adrift; Paul bitten by viper, unharmed; healed many (Acts 27:39–28:10)' },
      { name: 'Syracuse (Sicily)', lat: 37.08, lng: 15.28, description: 'Stayed 3 days (Acts 28:12)' },
      { name: 'Rhegium', lat: 37.92, lng: 15.66, description: 'Brief stop; south wind came up (Acts 28:13)' },
      { name: 'Puteoli', lat: 40.83, lng: 14.12, description: 'Found brothers who urged them to stay 7 days (Acts 28:13–14)' },
      { name: 'Rome', lat: 41.90, lng: 12.50, description: 'Paul under house arrest for 2 years — wrote Ephesians, Philippians, Colossians, Philemon (Acts 28:16–31)' },
    ],
  },
]
