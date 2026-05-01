import React, { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { JOURNEYS } from '../data/mapData'
import { getJourneyForPassage } from '../lib/mapContext'
import type { SelectedVerse } from '../types'

interface Props {
  selected: SelectedVerse
}

const GROUPS = [
  { label: 'Old Testament', ids: ['abraham', 'exodus', 'exile'] },
  { label: 'New Testament', ids: ['jesus-ministry', 'seven-churches', 'jonah', 'flight-egypt'] },
  { label: "Paul's Journeys", ids: ['paul-1', 'paul-2', 'paul-3', 'paul-4'] },
]

export function MapPanel({ selected }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const layersRef = useRef<any>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [stackedIds, setStackedIds] = useState<Set<string>>(new Set())
  const [mapReady, setMapReady] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Passage-aware auto-select
  useEffect(() => {
    const match = getJourneyForPassage(selected.book, selected.chapter)
    if (match) setActiveId(match)
  }, [selected.book, selected.chapter])

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  // Init Leaflet
  useEffect(() => {
    if (!containerRef.current) return
    let destroyed = false

    import('leaflet').then(mod => {
      if (destroyed || !containerRef.current) return
      const L = mod.default ?? mod as any
      try {
        const map = L.map(containerRef.current, { center: [37, 33], zoom: 5, zoomControl: false })
        L.control.zoom({ position: 'bottomleft' }).addTo(map)
        L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          { attribution: '&copy; OpenStreetMap &copy; CARTO' }
        ).addTo(map)
        const layers = L.layerGroup().addTo(map)
        mapRef.current = map
        layersRef.current = layers
        setMapReady(true)
      } catch (e: any) {
        setError(e?.message ?? 'Failed to initialise map')
      }
    }).catch(e => {
      if (!destroyed) setError(e?.message ?? 'Failed to load Leaflet')
    })

    return () => {
      destroyed = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        layersRef.current = null
      }
    }
  }, [])

  // Render all active journeys
  useEffect(() => {
    const map = mapRef.current
    const layers = layersRef.current
    if (!map || !layers) return

    import('leaflet').then(mod => {
      const L = mod.default ?? mod as any
      layers.clearLayers()

      const activeJourneys = JOURNEYS.filter(j =>
        j.id === activeId || stackedIds.has(j.id)
      )
      if (activeJourneys.length === 0) return

      activeJourneys.forEach(journey => {
        const icon = L.divIcon({
          html: `<div style="width:10px;height:10px;border-radius:50%;background:${journey.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.6)"></div>`,
          className: '',
          iconSize: [10, 10],
          iconAnchor: [5, 5],
          popupAnchor: [0, -10],
        })

        L.polyline(journey.route, { color: journey.color, weight: 2.5, opacity: 0.85 }).addTo(layers)

        const MIN_DEG = 0.2
        for (let i = 0; i < journey.route.length - 1; i++) {
          const [aLat, aLng] = journey.route[i]
          const [bLat, bLng] = journey.route[i + 1]
          const segLen = Math.sqrt((bLat - aLat) ** 2 + (bLng - aLng) ** 2)
          if (segLen < MIN_DEG) continue

          const midLat = (aLat + bLat) / 2
          const midLng = (aLng + bLng) / 2
          const dLng = (bLng - aLng) * Math.PI / 180
          const lat1R = aLat * Math.PI / 180
          const lat2R = bLat * Math.PI / 180
          const y = Math.sin(dLng) * Math.cos(lat2R)
          const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng)
          const bearing = Math.atan2(y, x) * 180 / Math.PI

          const arrowIcon = L.divIcon({
            html: `<div style="transform:rotate(${bearing - 90}deg);color:${journey.color};font-size:13px;line-height:1;text-shadow:0 0 3px rgba(0,0,0,0.7);opacity:0.95">▶</div>`,
            className: '',
            iconSize: [13, 13],
            iconAnchor: [6, 7],
          })
          L.marker([midLat, midLng], { icon: arrowIcon, interactive: false }).addTo(layers)
        }

        journey.cities.forEach(city => {
          L.marker([city.lat, city.lng], { icon })
            .bindPopup(
              `<strong>${city.name}</strong><p style="margin:4px 0 0;font-size:12px;color:#888">${city.description}</p>`,
              { className: 'map-popup' }
            )
            .addTo(layers)
        })
      })

      const allCities = activeJourneys.flatMap(j => j.cities.map(c => [c.lat, c.lng] as [number, number]))
      const bounds = L.latLngBounds(allCities)
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 8 })
    })
  }, [activeId, stackedIds, mapReady])

  // Invalidate size after fullscreen toggle
  useEffect(() => {
    if (mapRef.current) setTimeout(() => mapRef.current?.invalidateSize(), 50)
  }, [fullscreen])

  const toggleStack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setStackedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const activeJourney = JOURNEYS.find(j => j.id === activeId)

  if (error) {
    return (
      <div className="map-panel">
        <div className="panel-empty">Map error: {error}</div>
      </div>
    )
  }

  return (
    <div className={`map-panel${fullscreen ? ' map-panel--fullscreen' : ''}`}>
      <div className="map-toolbar">
        <div className="map-journey-dropdown" ref={dropdownRef}>
          <button
            className="map-journey-dropdown-btn"
            onClick={() => setDropdownOpen(o => !o)}
          >
            {activeJourney
              ? <><span className="map-journey-dot" style={{ background: activeJourney.color }} />{activeJourney.label}</>
              : <span className="map-journey-placeholder">— Select a journey —</span>
            }
            <span className="map-journey-chevron">{dropdownOpen ? '▲' : '▼'}</span>
          </button>

          {dropdownOpen && (
            <div className="map-journey-list">
              {GROUPS.map(group => {
                const journeys = JOURNEYS.filter(j => group.ids.includes(j.id))
                return (
                  <div key={group.label}>
                    <div className="map-journey-group-label">{group.label}</div>
                    {journeys.map(j => (
                      <div
                        key={j.id}
                        className={`map-journey-item${activeId === j.id ? ' map-journey-item--active' : ''}`}
                        onClick={() => { setActiveId(j.id); setDropdownOpen(false) }}
                      >
                        <span className="map-journey-dot" style={{ background: j.color }} />
                        <span className="map-journey-name">{j.label}</span>
                        <button
                          className={`map-journey-stack-btn${stackedIds.has(j.id) ? ' map-journey-stack-btn--remove' : ''}`}
                          onClick={e => toggleStack(j.id, e)}
                          title={stackedIds.has(j.id) ? 'Remove layer' : 'Add layer'}
                        >
                          {stackedIds.has(j.id) ? '−' : '+'}
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <button
          className="map-fullscreen-btn"
          onClick={() => setFullscreen(f => !f)}
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {fullscreen ? '✕' : '⛶'}
        </button>
      </div>
      <div ref={containerRef} className="map-container" />
    </div>
  )
}
