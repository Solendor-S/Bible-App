import React, { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { JOURNEYS } from '../data/mapData'
import { getJourneyForPassage } from '../lib/mapContext'
import type { SelectedVerse } from '../types'

interface Props {
  selected: SelectedVerse
}

export function MapPanel({ selected }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const layersRef = useRef<any>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Passage-aware auto-select
  useEffect(() => {
    const match = getJourneyForPassage(selected.book, selected.chapter)
    if (match) setActiveId(match)
  }, [selected.book, selected.chapter])

  // Init Leaflet dynamically — deferred so DOM is ready and no sync crash
  useEffect(() => {
    if (!containerRef.current) return
    let destroyed = false

    import('leaflet').then(mod => {
      if (destroyed || !containerRef.current) return
      const L = mod.default ?? mod as any

      try {
        const map = L.map(containerRef.current, { center: [37, 33], zoom: 5 })
        L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          { attribution: '&copy; OpenStreetMap &copy; CARTO' }
        ).addTo(map)

        const layers = L.layerGroup().addTo(map)
        mapRef.current = map
        layersRef.current = layers
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

  // Update journey overlay whenever activeId changes
  useEffect(() => {
    const map = mapRef.current
    const layers = layersRef.current
    if (!map || !layers) return

    import('leaflet').then(mod => {
      const L = mod.default ?? mod as any
      layers.clearLayers()

      const journey = JOURNEYS.find(j => j.id === activeId)
      if (!journey) return

      const icon = L.divIcon({
        html: `<div style="width:10px;height:10px;border-radius:50%;background:${journey.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.6)"></div>`,
        className: '',
        iconSize: [10, 10],
        iconAnchor: [5, 5],
        popupAnchor: [0, -10],
      })

      L.polyline(journey.route, { color: journey.color, weight: 2.5, opacity: 0.85 }).addTo(layers)

      journey.cities.forEach(city => {
        L.marker([city.lat, city.lng], { icon })
          .bindPopup(`<strong>${city.name}</strong><p style="margin:4px 0 0;font-size:12px;color:#888">${city.description}</p>`)
          .addTo(layers)
      })

      const bounds = L.latLngBounds(journey.cities.map((c: any) => [c.lat, c.lng]))
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 8 })
    })
  }, [activeId, mapRef.current])

  // Invalidate size after fullscreen toggle
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 50)
    }
  }, [fullscreen])

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
        <select
          className="map-journey-select"
          value={activeId ?? ''}
          onChange={e => setActiveId(e.target.value || null)}
        >
          <option value="">— Select a journey —</option>
          {JOURNEYS.map(j => (
            <option key={j.id} value={j.id}>{j.label}</option>
          ))}
        </select>
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
