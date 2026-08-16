import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import api from '../services/api.js'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

export default function PHCMapPage() {
  const [phcs, setPhcs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { api.getPHCs().then(setPhcs).finally(() => setLoading(false)) }, [])

  const center = phcs.length ? [phcs[0].lat, phcs[0].lon] : [15.0, 76.0]
  const remoteCount = phcs.filter(p => p.is_remote).length

  if (loading) return <LoadingSkeleton count={1} />

  return (
    <div>
      <div className="page-header">
        <h2>National PHC Map</h2>
        <div className="page-subtitle">{phcs.length} facilities across {new Set(phcs.map(p => p.district)).size} districts</div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card stat" style={{ padding: '12px 16px' }}>
          <div className="value" style={{ fontSize: 22 }}>{phcs.length}</div>
          <div className="label">Total PHCs</div>
        </div>
        <div className="card stat" style={{ padding: '12px 16px' }}>
          <div className="value" style={{ fontSize: 22, color: 'var(--accent)' }}>{phcs.length - remoteCount}</div>
          <div className="label">Standard Access</div>
        </div>
        <div className="card stat" style={{ padding: '12px 16px' }}>
          <div className="value" style={{ fontSize: 22, color: 'var(--high)' }}>{remoteCount}</div>
          <div className="label">Remote (longer resupply)</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <MapContainer center={center} zoom={7} style={{ height: '65vh', width: '100%', borderRadius: 'var(--radius-lg)' }}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {phcs.map(p => (
            <CircleMarker
              key={p.code}
              center={[p.lat, p.lon]}
              radius={p.is_remote ? 5 : 7}
              pathOptions={{
                color: p.is_remote ? '#ff9d3a' : '#4ea8ff',
                fillColor: p.is_remote ? '#ff9d3a' : '#4ea8ff',
                fillOpacity: 0.7,
                weight: 1.5,
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.6, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{p.code}</div>
                  <div style={{ color: '#666', marginBottom: 6 }}>{p.district}</div>
                  <div>🛏️ Beds: {p.total_beds}</div>
                  <div>👨‍⚕️ Doctors: {p.sanctioned_doctors}</div>
                  <div>👩‍⚕️ Nurses: {p.sanctioned_nurses}</div>
                  <div>👥 Catchment: {p.catchment_population.toLocaleString()}</div>
                  <div style={{ marginTop: 4, color: p.is_remote ? '#e67e22' : '#27ae60', fontWeight: 600 }}>
                    {p.is_remote ? '⚠️ Remote' : '✅ Standard access'}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#4ea8ff', marginRight: 6 }}></span>Standard PHC</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ff9d3a', marginRight: 6 }}></span>Remote PHC</span>
        </div>
      </div>
    </div>
  )
}
