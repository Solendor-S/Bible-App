import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { JOURNEYS } from '../data/mapData'
import { getJourneyForPassage } from '../lib/mapContext'
import type { SelectedVerse } from '../types'

function makeIcon(color: string) {
  return L.divIcon({
    html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.6)"></div>`,
    className: '',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    popupAnchor: [0, -10],
  })
}

function BoundsFitter({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length >= 2) {
      map.fitBounds(L.latLngBounds(positions), { padding: [36, 36], maxZoom: 8 })
    } else if (positions.length === 1) {
      map.setView(positions[0], 7)
    }
  }, [positions.join(), map])
  return null
}

interface Props {
  selected: SelectedVerse
}

export function MapPanel({ selected }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const match = getJourneyForPassage(selected.book, selected.chapter)
    if (match) setActiveId(match)
  }, [selected.book, selected.chapter])

  const journey = JOURNEYS.find(j => j.id === activeId) ?? null
  const icon = journey ? makeIcon(journey.color) : makeIcon('#6b7280')

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

      <MapContainer
        center={[37, 33]}
        zoom={5}
        className="map-container"
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />
        {journey && (
          <>
            <BoundsFitter positions={journey.cities.map(c => [c.lat, c.lng])} />
            <Polyline
              positions={journey.route}
              pathOptions={{ color: journey.color, weight: 2.5, opacity: 0.85, dashArray: undefined }}
            />
            {journey.cities.map(city => (
              <Marker key={city.name} position={[city.lat, city.lng]} icon={icon}>
                <Popup className="map-popup">
                  <strong>{city.name}</strong>
                  <p>{city.description}</p>
                </Popup>
              </Marker>
            ))}
          </>
        )}
      </MapContainer>
    </div>
  )
}
