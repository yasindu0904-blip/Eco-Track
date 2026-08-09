import React, { useState } from 'react'
import { MapPin, Search, Filter, ZoomIn, ZoomOut } from 'lucide-react'
import '../styles/pages.css'

interface MapMarker {
  id: number
  type: 'incident' | 'event' | 'volunteer'
  title: string
  description: string
  lat: number
  lng: number
  icon: string
}

const markers: MapMarker[] = [
  { id: 1, type: 'incident', title: 'Litter at Central Park', description: '45 min ago', lat: 40.785, lng: -73.968, icon: '⚠️' },
  { id: 2, type: 'event', title: 'Beach Cleanup', description: 'Tomorrow, 10am', lat: 40.573, lng: -73.950, icon: '🌊' },
  { id: 3, type: 'volunteer', title: 'Maria & Team', description: '12 volunteers active', lat: 40.758, lng: -73.985, icon: '👥' },
]

export const CitizenVolunteerMap: React.FC = () => {
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null)
  const [filter, setFilter] = useState<'all' | 'incident' | 'event' | 'volunteer'>('all')

  const filteredMarkers = filter === 'all' ? markers : markers.filter(m => m.type === filter)

  return (
    <div className="mobile-container">
      <div className="map-screen">
        <header className="header">
          <div className="header-content">
            <div className="header-title">
              <h1>Incident & Event Map</h1>
              <p className="header-subtitle">Real-time community updates</p>
            </div>
          </div>
        </header>

        <div className="map-container">
          {/* Simplified SVG Map */}
          <svg className="map-svg" viewBox="0 0 390 400" xmlns="http://www.w3.org/2000/svg">
            {/* Background */}
            <rect width="390" height="400" fill="#e8f5e9" />

            {/* Water areas */}
            <circle cx="350" cy="80" r="40" fill="#81d4fa" opacity="0.6" />
            <path d="M 0 350 Q 100 320 200 350 T 390 350 L 390 400 L 0 400" fill="#81d4fa" opacity="0.4" />

            {/* Parks/green spaces */}
            <circle cx="100" cy="150" r="60" fill="#c8e6c9" opacity="0.8" />
            <circle cx="280" cy="240" r="50" fill="#c8e6c9" opacity="0.8" />

            {/* Streets */}
            <line x1="50" y1="100" x2="350" y2="100" stroke="#ddd" strokeWidth="2" />
            <line x1="50" y1="180" x2="350" y2="180" stroke="#ddd" strokeWidth="2" />
            <line x1="50" y1="260" x2="350" y2="260" stroke="#ddd" strokeWidth="2" />
            <line x1="100" y1="50" x2="100" y2="350" stroke="#ddd" strokeWidth="2" />
            <line x1="200" y1="50" x2="200" y2="350" stroke="#ddd" strokeWidth="2" />
            <line x1="300" y1="50" x2="300" y2="350" stroke="#ddd" strokeWidth="2" />

            {/* Markers */}
            {filteredMarkers.map((marker) => {
              const x = (marker.lng + 74) * 25
              const y = (41 - marker.lat) * 25
              return (
                <g key={marker.id} onClick={() => setSelectedMarker(marker)} className="marker-group">
                  <circle
                    cx={x}
                    cy={y}
                    r={marker.id === selectedMarker?.id ? 20 : 16}
                    fill={
                      marker.type === 'incident' ? '#ef5350' :
                      marker.type === 'event' ? '#42a5f5' :
                      '#66bb6a'
                    }
                    stroke="white"
                    strokeWidth="3"
                    style={{ cursor: 'pointer', transition: 'r 0.2s' }}
                  />
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="14"
                    style={{ pointerEvents: 'none' }}
                  >
                    {marker.icon}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Map Controls */}
          <div className="map-controls">
            <button className="map-control-btn" title="Zoom in">+</button>
            <button className="map-control-btn" title="Zoom out">−</button>
          </div>

          {/* Attribution */}
          <div className="map-attribution">
            © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors
          </div>
        </div>

        {/* Map Panel */}
        <div className="map-panel">
          <div className="map-list">
            {filteredMarkers.map((marker) => (
              <div
                key={marker.id}
                className={`map-item ${selectedMarker?.id === marker.id ? 'selected' : ''}`}
                onClick={() => setSelectedMarker(marker)}
              >
                <p className="map-item-title">{marker.icon} {marker.title}</p>
                <p className="map-item-meta">{marker.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
