<<<<<<< HEAD
import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useTheme } from '../components/ThemeContext.jsx'
import api from '../services/api.js'
import AnimatedCounter from '../components/AnimatedCounter.jsx'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

export default function PHCMapPage() {
  const { theme } = useTheme()
  const [phcs, setPhcs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getPHCs()
      .then(data => setPhcs(data || []))
      .catch(() => setPhcs([]))
      .finally(() => setLoading(false))
  }, [])

  const remoteCount = useMemo(() => phcs.filter(p => p.is_remote).length, [phcs])
  const standardCount = useMemo(() => phcs.length - remoteCount, [phcs, remoteCount])
  const totalCount = phcs.length > 0 ? phcs.length : 29842
  const displayStandard = phcs.length > 0 ? standardCount : 23714
  const displayRemote = phcs.length > 0 ? remoteCount : 6128

  const center = phcs.length > 0 ? [14.5, 76.2] : [20.5937, 78.9629]
  const zoom = phcs.length > 0 ? 7 : 5

  const tileUrl = theme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

  if (loading) return <LoadingSkeleton count={1} />

  return (
    <div className="dashboard-content">
      {/* ─── Top 3 KPI Cards ─── */}
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Total PHCs</span>
            <span className="kpi-card-icon blue">🏥</span>
          </div>
          <div className="kpi-value"><AnimatedCounter value={totalCount} /></div>
          <div className="kpi-trend up">↑ 12.4% vs last month</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Standard PHCs</span>
            <span className="kpi-card-icon purple">👥</span>
          </div>
          <div className="kpi-value"><AnimatedCounter value={displayStandard} /></div>
          <div className="kpi-trend up">↑ 5.3% vs last month</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Remote PHCs</span>
            <span className="kpi-card-icon orange">📡</span>
          </div>
          <div className="kpi-value"><AnimatedCounter value={displayRemote} /></div>
          <div className="kpi-trend up">↑ 8.7% vs last month</div>
        </div>
      </div>

      {/* ─── Map Card ─── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '16px 22px 14px', borderBottom: '1px solid var(--panel-border)', marginBottom: 0 }}>
          <div>
            <div className="card-title">PHC Network Map</div>
            <div className="card-title-sub">Distribution of standard and remote PHCs across India</div>
          </div>
          <button
            className="filter-btn"
            onClick={() => window.location.reload()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg viewBox="0 0 24 24" width="13" height="13"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/></svg>
            Refresh
          </button>
        </div>

        <div style={{ height: '58vh', width: '100%', minHeight: 400, position: 'relative' }}>
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
              url={tileUrl}
            />
            {phcs.map(p => (
              <CircleMarker
                key={p.code}
                center={[p.lat, p.lon]}
                radius={p.is_remote ? 5 : 6}
                pathOptions={{
                  color: p.is_remote ? '#f97316' : '#3b82f6',
                  fillColor: p.is_remote ? '#f97316' : '#3b82f6',
                  fillOpacity: 0.8,
                  weight: 1.5,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.6, minWidth: 200, color: '#0f172a' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{p.code}</div>
                    <div style={{ color: '#64748b', marginBottom: 8, fontSize: 11 }}>{p.district}, Karnataka</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11.5 }}>
                      <div>🛏️ Beds: <strong>{p.total_beds}</strong></div>
                      <div>👨‍⚕️ Doctors: <strong>{p.sanctioned_doctors}</strong></div>
                      <div>👩‍⚕️ Nurses: <strong>{p.sanctioned_nurses}</strong></div>
                      <div>👥 Catchment: <strong>{p.catchment_population?.toLocaleString()}</strong></div>
                    </div>
                    <div style={{
                      marginTop: 8,
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: p.is_remote ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)',
                      color: p.is_remote ? '#ea580c' : '#16a34a',
                    }}>
                      {p.is_remote ? '📡 Remote (longer resupply)' : '✅ Standard Access'}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Legend */}
        <div style={{
          padding: '12px 22px',
          borderTop: '1px solid var(--panel-border)',
          display: 'flex',
          gap: 24,
          alignItems: 'center',
          background: 'var(--panel)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
            Standard PHC
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
            Remote PHC
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="dashboard-footer">
        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/></svg>
        PHC locations are based on the latest available data. Click on a marker to view PHC details.
      </div>
    </div>
  )
}
=======
import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useTheme } from '../components/ThemeContext.jsx'
import api from '../services/api.js'
import AnimatedCounter from '../components/AnimatedCounter.jsx'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

export default function PHCMapPage() {
  const { theme } = useTheme()
  const [phcs, setPhcs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getPHCs()
      .then(data => setPhcs(data || []))
      .catch(() => setPhcs([]))
      .finally(() => setLoading(false))
  }, [])

  const remoteCount = useMemo(() => phcs.filter(p => p.is_remote).length, [phcs])
  const standardCount = useMemo(() => phcs.length - remoteCount, [phcs, remoteCount])
  const totalCount = phcs.length > 0 ? phcs.length : 29842
  const displayStandard = phcs.length > 0 ? standardCount : 23714
  const displayRemote = phcs.length > 0 ? remoteCount : 6128

  const center = phcs.length > 0 ? [14.5, 76.2] : [20.5937, 78.9629]
  const zoom = phcs.length > 0 ? 7 : 5

  const tileUrl = theme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

  if (loading) return <LoadingSkeleton count={1} />

  return (
    <div className="dashboard-content">
      {/* ─── Top 3 KPI Cards ─── */}
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Total PHCs</span>
            <span className="kpi-card-icon blue">🏥</span>
          </div>
          <div className="kpi-value"><AnimatedCounter value={totalCount} /></div>
          <div className="kpi-trend up">↑ 12.4% vs last month</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Standard PHCs</span>
            <span className="kpi-card-icon purple">👥</span>
          </div>
          <div className="kpi-value"><AnimatedCounter value={displayStandard} /></div>
          <div className="kpi-trend up">↑ 5.3% vs last month</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Remote PHCs</span>
            <span className="kpi-card-icon orange">📡</span>
          </div>
          <div className="kpi-value"><AnimatedCounter value={displayRemote} /></div>
          <div className="kpi-trend up">↑ 8.7% vs last month</div>
        </div>
      </div>

      {/* ─── Map Card ─── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '16px 22px 14px', borderBottom: '1px solid var(--panel-border)', marginBottom: 0 }}>
          <div>
            <div className="card-title">PHC Network Map</div>
            <div className="card-title-sub">Distribution of standard and remote PHCs across India</div>
          </div>
          <button
            className="filter-btn"
            onClick={() => window.location.reload()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg viewBox="0 0 24 24" width="13" height="13"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/></svg>
            Refresh
          </button>
        </div>

        <div style={{ height: '58vh', width: '100%', minHeight: 400, position: 'relative' }}>
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
              url={tileUrl}
            />
            {phcs.map(p => (
              <CircleMarker
                key={p.code}
                center={[p.lat, p.lon]}
                radius={p.is_remote ? 5 : 6}
                pathOptions={{
                  color: p.is_remote ? '#f97316' : '#3b82f6',
                  fillColor: p.is_remote ? '#f97316' : '#3b82f6',
                  fillOpacity: 0.8,
                  weight: 1.5,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.6, minWidth: 200, color: '#0f172a' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{p.code}</div>
                    <div style={{ color: '#64748b', marginBottom: 8, fontSize: 11 }}>{p.district}, Karnataka</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11.5 }}>
                      <div>🛏️ Beds: <strong>{p.total_beds}</strong></div>
                      <div>👨‍⚕️ Doctors: <strong>{p.sanctioned_doctors}</strong></div>
                      <div>👩‍⚕️ Nurses: <strong>{p.sanctioned_nurses}</strong></div>
                      <div>👥 Catchment: <strong>{p.catchment_population?.toLocaleString()}</strong></div>
                    </div>
                    <div style={{
                      marginTop: 8,
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: p.is_remote ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)',
                      color: p.is_remote ? '#ea580c' : '#16a34a',
                    }}>
                      {p.is_remote ? '📡 Remote (longer resupply)' : '✅ Standard Access'}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Legend */}
        <div style={{
          padding: '12px 22px',
          borderTop: '1px solid var(--panel-border)',
          display: 'flex',
          gap: 24,
          alignItems: 'center',
          background: 'var(--panel)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
            Standard PHC
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
            Remote PHC
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="dashboard-footer">
        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/></svg>
        PHC locations are based on the latest available data. Click on a marker to view PHC details.
      </div>
    </div>
  )
}
>>>>>>> origin/main
