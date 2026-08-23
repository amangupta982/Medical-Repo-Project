<<<<<<< HEAD
import { useEffect, useState } from 'react'
import api from '../services/api.js'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')

  useEffect(() => { api.getAlerts().then(setAlerts).finally(() => setLoading(false)) }, [])

  const filtered = filter === 'ALL' ? alerts : alerts.filter(a => a.severity === filter)
  const counts = {
    ALL: alerts.length,
    CRITICAL: alerts.filter(a => a.severity === 'CRITICAL').length,
    HIGH: alerts.filter(a => a.severity === 'HIGH').length,
    MEDIUM: alerts.filter(a => a.severity === 'MEDIUM').length,
    LOW: alerts.filter(a => a.severity === 'LOW').length,
  }

  if (loading) return <LoadingSkeleton type="table" />

  return (
    <div className="dashboard-content">

      <div className="pill-group" style={{ marginBottom: 16 }}>
        {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(level => (
          <button key={level} className={`pill ${filter === level ? 'active' : ''}`}
            onClick={() => setFilter(level)}>
            {level} ({counts[level]})
          </button>
        ))}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔔</div>
            <div className="empty-text">No alerts {filter !== 'ALL' ? `with severity ${filter}` : 'yet'}</div>
            <div className="empty-hint">Run a stock-out prediction or emergency simulation to generate alerts</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Severity</th><th>Type</th><th>Message</th><th>Time</th></tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td><span className={`badge ${a.severity}`}>{a.severity}</span></td>
                  <td style={{ fontWeight: 500, fontSize: 12 }}>{a.alert_type}</td>
                  <td style={{ fontSize: 12 }}>{a.message}</td>
                  <td style={{ color: 'var(--text-dim)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
=======
import { useEffect, useState } from 'react'
import api from '../services/api.js'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')

  useEffect(() => { api.getAlerts().then(setAlerts).finally(() => setLoading(false)) }, [])

  const filtered = filter === 'ALL' ? alerts : alerts.filter(a => a.severity === filter)
  const counts = {
    ALL: alerts.length,
    CRITICAL: alerts.filter(a => a.severity === 'CRITICAL').length,
    HIGH: alerts.filter(a => a.severity === 'HIGH').length,
    MEDIUM: alerts.filter(a => a.severity === 'MEDIUM').length,
    LOW: alerts.filter(a => a.severity === 'LOW').length,
  }

  if (loading) return <LoadingSkeleton type="table" />

  return (
    <div className="dashboard-content">

      <div className="pill-group" style={{ marginBottom: 16 }}>
        {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(level => (
          <button key={level} className={`pill ${filter === level ? 'active' : ''}`}
            onClick={() => setFilter(level)}>
            {level} ({counts[level]})
          </button>
        ))}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔔</div>
            <div className="empty-text">No alerts {filter !== 'ALL' ? `with severity ${filter}` : 'yet'}</div>
            <div className="empty-hint">Run a stock-out prediction or emergency simulation to generate alerts</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Severity</th><th>Type</th><th>Message</th><th>Time</th></tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td><span className={`badge ${a.severity}`}>{a.severity}</span></td>
                  <td style={{ fontWeight: 500, fontSize: 12 }}>{a.alert_type}</td>
                  <td style={{ fontSize: 12 }}>{a.message}</td>
                  <td style={{ color: 'var(--text-dim)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
>>>>>>> origin/main
