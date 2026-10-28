// Map tab — Journeys (desktop) plus the Android app's Fathers and Letters modes.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { FATHER_CITIES, JOURNEYS } from '../data/mapData'
import type { FatherCity } from '../data/mapData'
import { CORRESPONDENCE_EXTRA_COORDS, FATHER_LETTERS } from '../data/correspondenceData'
import type { FatherLetter } from '../data/correspondenceData'
import { TRADITION_COLORS } from '../data/traditionColors'
import { getJourneyForPassage } from '../data/mapContext'
import { usePref } from '../context/Prefs'
import { Chips, useOutsideClick } from './Modal'
import type { SelectedVerse } from '../types'

interface Props {
  selected: SelectedVerse
  onOpenFather: (name: string) => void
}

type Mode = 'journeys' | 'fathers' | 'letters'

const GROUPS = [
  { label: 'Old Testament', ids: ['abraham', 'exodus', 'exile'] },
  { label: 'New Testament', ids: ['jesus-ministry', 'seven-churches', 'jonah', 'flight-egypt'] },
  { label: "Paul's Journeys", ids: ['paul-1', 'paul-2', 'paul-3', 'paul-4'] },
]
const TRADITIONS = ['All', 'Eastern', 'Western', 'Alexandrian', 'Syrian', 'North African']
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  ...Object.fromEntries(FATHER_CITIES.map(c => [c.displayName, { lat: c.lat, lng: c.lng }])),
  ...CORRESPONDENCE_EXTRA_COORDS,
}
const traditionColor = (t?: string) => TRADITION_COLORS[t ?? ''] ?? '#94a3b8'
// CARTO basemaps now require an API key and OSM labels places in the local language, so use
// Esri's Canvas basemaps: a base layer plus an English label layer, in light and dark variants.
const esri = (layer: string) => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${layer}/MapServer/tile/{z}/{y}/{x}`
const TILE_OPTS = { attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors', maxZoom: 16 }

function drawJourneys(L: any, layers: any, map: any, ids: Set<string>) {
  const active = JOURNEYS.filter(j => ids.has(j.id))
  for (const journey of active) {
    const icon = L.divIcon({
      html: `<div style="width:10px;height:10px;border-radius:50%;background:${journey.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.6)"></div>`,
      className: '', iconSize: [10, 10], iconAnchor: [5, 5], popupAnchor: [0, -10],
    })
    L.polyline(journey.route, { color: journey.color, weight: 2.5, opacity: 0.85 }).addTo(layers)
    // Direction arrows at segment midpoints
    for (let i = 0; i < journey.route.length - 1; i++) {
      const [aLat, aLng] = journey.route[i]
      const [bLat, bLng] = journey.route[i + 1]
      if (Math.hypot(bLat - aLat, bLng - aLng) < 0.2) continue
      const dLng = (bLng - aLng) * Math.PI / 180
      const lat1 = aLat * Math.PI / 180, lat2 = bLat * Math.PI / 180
      const bearing = Math.atan2(Math.sin(dLng) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)) * 180 / Math.PI
      const arrow = L.divIcon({
        html: `<div style="transform:rotate(${bearing - 90}deg);color:${journey.color};font-size:13px;line-height:1;text-shadow:0 0 3px rgba(0,0,0,0.7)">▶</div>`,
        className: '', iconSize: [13, 13], iconAnchor: [6, 7],
      })
      L.marker([(aLat + bLat) / 2, (aLng + bLng) / 2], { icon: arrow, interactive: false }).addTo(layers)
    }
    for (const city of journey.cities) {
      L.marker([city.lat, city.lng], { icon })
        .bindPopup(`<strong>${city.name}</strong><p style="margin:4px 0 0;font-size:12px;color:#888">${city.description}</p>`, { className: 'map-popup' })
        .addTo(layers)
    }
  }
  const pts = active.flatMap(j => j.cities.map(c => [c.lat, c.lng] as [number, number]))
  if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 8, animate: false })
}

export function MapPanel({ selected, onOpenFather }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const layersRef = useRef<any>(null)
  const [mode, setMode] = useState<Mode>('journeys')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [stackedIds, setStackedIds] = useState<Set<string>>(new Set())
  const [tradition, setTradition] = useState('All')
  const [sender, setSender] = useState('All')
  const [city, setCity] = useState<FatherCity | null>(null)
  const [letter, setLetter] = useState<FatherLetter | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [theme] = usePref('theme')
  const tilesRef = useRef<any>(null)
  const senders = useMemo(() => ['All', ...new Set(FATHER_LETTERS.map(l => l.fromFather))], [])
  useOutsideClick(dropdownRef, dropdownOpen, () => setDropdownOpen(false))

  // Passage-aware auto-select
  useEffect(() => {
    const match = getJourneyForPassage(selected.book, selected.chapter)
    if (match) setActiveId(match)
  }, [selected.book, selected.chapter])

  useEffect(() => {
    if (!containerRef.current) return
    let destroyed = false
    import('leaflet').then(mod => {
      if (destroyed || !containerRef.current) return
      const L = mod.default ?? mod as any
      try {
        const map = L.map(containerRef.current, { center: [37, 33], zoom: 5, zoomControl: false })
        L.control.zoom({ position: 'bottomleft' }).addTo(map)
        tilesRef.current = L.layerGroup().addTo(map)
        layersRef.current = L.layerGroup().addTo(map)
        mapRef.current = map
        setMapReady(true)
      } catch (e: any) { setError(e?.message ?? 'Failed to initialise map') }
    }).catch(e => { if (!destroyed) setError(e?.message ?? 'Failed to load Leaflet') })
    return () => {
      destroyed = true
      mapRef.current?.remove()
      mapRef.current = null
      layersRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current, layers = layersRef.current
    if (!map || !layers) return
    import('leaflet').then(mod => {
      const L = mod.default ?? mod as any
      map.invalidateSize()  // container may have been resized since init (fitBounds needs the real size)
      layers.clearLayers()
      if (mode === 'journeys') {
        drawJourneys(L, layers, map, new Set([...(activeId ? [activeId] : []), ...stackedIds]))
        return
      }
      const pts: [number, number][] = []
      if (mode === 'fathers') {
        for (const c of FATHER_CITIES) {
          const fathers = tradition === 'All' ? c.fathers : c.fathers.filter(f => f.tradition === tradition)
          if (!fathers.length) continue
          const size = Math.min(24, 10 + fathers.length * 2)
          const icon = L.divIcon({
            html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${traditionColor(fathers[0].tradition)};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font:600 10px sans-serif;color:#111">${fathers.length > 1 ? fathers.length : ''}</div>`,
            className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
          })
          L.marker([c.lat, c.lng], { icon, title: c.displayName }).on('click', () => { setCity({ ...c, fathers }); setLetter(null) }).addTo(layers)
          pts.push([c.lat, c.lng])
        }
      } else {
        for (const l of FATHER_LETTERS) {
          if ((tradition !== 'All' && l.tradition !== tradition) || (sender !== 'All' && l.fromFather !== sender)) continue
          const a = CITY_COORDS[l.fromCity], b = CITY_COORDS[l.toCity]
          if (!a || !b) continue
          const col = traditionColor(l.tradition)
          L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: col, weight: 3, opacity: 0.8, dashArray: '6 4' })
            .on('click', () => { setLetter(l); setCity(null) }).addTo(layers)
          for (const [p, name] of [[a, l.fromCity], [b, l.toCity]] as const) {
            L.circleMarker([p.lat, p.lng], { radius: 5, color: '#fff', weight: 1.5, fillColor: col, fillOpacity: 1 }).bindTooltip(name).addTo(layers)
            pts.push([p.lat, p.lng])
          }
        }
      }
      if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 7, animate: false })
    })
  }, [mode, activeId, stackedIds, tradition, sender, mapReady])

  // Basemap follows the app theme (Dark Gray for dark / high contrast, Light Gray for light)
  useEffect(() => {
    const tiles = tilesRef.current
    if (!tiles) return
    import('leaflet').then(mod => {
      const L = mod.default ?? mod as any
      const tone = theme === 'light' ? 'Light_Gray' : 'Dark_Gray'
      tiles.clearLayers()
      L.tileLayer(esri(`${tone}_Base`), TILE_OPTS).addTo(tiles)
      L.tileLayer(esri(`${tone}_Reference`), { ...TILE_OPTS, attribution: '' }).addTo(tiles)
    })
  }, [theme, mapReady])

  useEffect(() => { if (mapRef.current) setTimeout(() => mapRef.current?.invalidateSize(), 50) }, [fullscreen, city, letter])

  const toggleStack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setStackedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const activeJourney = JOURNEYS.find(j => j.id === activeId)

  if (error) return <div className="map-panel"><div className="panel-empty">Map error: {error}</div></div>

  return (
    <div className={`map-panel${fullscreen ? ' map-panel--fullscreen' : ''}`}>
      <div className="map-toolbar">
        <Chips small value={mode} onChange={m => { setMode(m); setCity(null); setLetter(null) }}
          options={[{ value: 'journeys', label: 'Journeys' }, { value: 'fathers', label: 'Fathers' }, { value: 'letters', label: 'Letters' }]} />
        {mode === 'journeys' ? (
          <div className="map-journey-dropdown" ref={dropdownRef}>
            <button className="map-journey-dropdown-btn" onClick={() => setDropdownOpen(o => !o)}>
              {activeJourney
                ? <><span className="map-journey-dot" style={{ background: activeJourney.color }} />{activeJourney.label}</>
                : <span className="map-journey-placeholder">— Select a journey —</span>}
              <span className="map-journey-chevron">{dropdownOpen ? '▲' : '▼'}</span>
            </button>
            {dropdownOpen && (
              <div className="map-journey-list">
                {GROUPS.map(group => (
                  <div key={group.label}>
                    <div className="map-journey-group-label">{group.label}</div>
                    {JOURNEYS.filter(j => group.ids.includes(j.id)).map(j => (
                      <div key={j.id} className={`map-journey-item${activeId === j.id ? ' map-journey-item--active' : ''}`}
                        onClick={() => { setActiveId(j.id); setDropdownOpen(false) }}>
                        <span className="map-journey-dot" style={{ background: j.color }} />
                        <span className="map-journey-name">{j.label}</span>
                        <button className={`map-journey-stack-btn${stackedIds.has(j.id) ? ' map-journey-stack-btn--remove' : ''}`}
                          onClick={e => toggleStack(j.id, e)} title={stackedIds.has(j.id) ? 'Remove layer' : 'Add layer'}>
                          {stackedIds.has(j.id) ? '−' : '+'}
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <select className="map-select" value={tradition} onChange={e => setTradition(e.target.value)}>
              {TRADITIONS.map(t => <option key={t} value={t}>{t === 'All' ? 'All traditions' : t}</option>)}
            </select>
            {mode === 'letters' && (
              <select className="map-select" value={sender} onChange={e => setSender(e.target.value)}>
                {senders.map(t => <option key={t} value={t}>{t === 'All' ? 'All senders' : t}</option>)}
              </select>
            )}
          </>
        )}
        <button className="map-fullscreen-btn" onClick={() => setFullscreen(f => !f)} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {fullscreen ? '✕' : '⛶'}
        </button>
      </div>
      {city && (
        <div className="map-card">
          <div className="map-card-head"><b>{city.displayName}</b><button className="link-btn" onClick={() => setCity(null)}>✕</button></div>
          {city.fathers.map(f => (
            <button key={f.name} className="father-row" onClick={() => onOpenFather(f.name)}>
              <span className="father-row-main"><span className="father-row-name">{f.name}</span><span className="father-row-meta">{f.role ? `${f.role} · ` : ''}{f.dates}</span></span>
              <span className="tradition-dot" style={{ background: traditionColor(f.tradition) }} /><span className="chev">›</span>
            </button>
          ))}
        </div>
      )}
      {letter && (
        <div className="map-card">
          <div className="map-card-head"><b>{letter.label}</b><button className="link-btn" onClick={() => setLetter(null)}>✕</button></div>
          <div className="muted">{letter.year} · {letter.fromCity} → {letter.toCity}</div>
          <div>From <button className="link-btn" onClick={() => onOpenFather(letter.fromFather)}>{letter.fromFather}</button> to {letter.toLabel}</div>
        </div>
      )}
      <div ref={containerRef} className="map-container" />
    </div>
  )
}
