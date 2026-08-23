import { useState } from 'react'
import api from '../services/api.js'
import AnimatedCounter from '../components/AnimatedCounter.jsx'

export default function ResourceRedistribution() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await api.optimizeRedistribution()
      setResult(res)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Optimization failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="dashboard-content">

      <div className="card card-accent">
        <div className="methodology" style={{ marginBottom: 14 }}>
          Solves a constrained optimization problem: minimize transport cost while prioritizing
          high-risk recipients. Stock close to expiry (FEFO) gets shipped first to avoid wastage
          at low-demand PHCs.
        </div>
        <button onClick={run} disabled={loading}>
          {loading ? '⏳ Optimizing...' : '🔄 Generate Redistribution Plan'}
        </button>
        {error && <p style={{ color: 'var(--critical)', marginTop: 12, fontSize: 13 }}>{error}</p>}
      </div>

      {result && (
        <>
          <div className="grid grid-3">
            <div className="card stat">
              <div className="value"><AnimatedCounter value={result.total_transfer_orders} /></div>
              <div className="label">Transfer Orders</div>
            </div>
            <div className="card stat">
              <div className="value"><AnimatedCounter value={result.total_units_redistributed} /></div>
              <div className="label">Units Redistributed</div>
            </div>
            <div className="card stat">
              <div className="value text-low"><AnimatedCounter value={result.at_risk_phcs_addressed} /></div>
              <div className="label">At-Risk PHCs Addressed</div>
            </div>
          </div>

          <div className="card">
            <h2>Recommended Transfers</h2>
            {result.transfers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <div className="empty-text">No transfers needed</div>
                <div className="empty-hint">All PHCs are adequately stocked</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Medicine</th><th>From</th><th></th><th>To</th>
                    <th>Qty</th><th>Distance</th><th>Risk</th><th>FEFO</th>
                  </tr>
                </thead>
                <tbody>
                  {result.transfers.map((t, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{t.medicine}</td>
                      <td>
                        {t.from_phc}
                        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}> ({t.from_district})</span>
                      </td>
                      <td style={{ color: 'var(--accent)', fontSize: 16, textAlign: 'center' }}>→</td>
                      <td>
                        {t.to_phc}
                        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}> ({t.to_district})</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{t.quantity}</td>
                      <td>{t.distance_km} km</td>
                      <td>
                        <span className={`badge ${t.recipient_risk_score > 0.7 ? 'CRITICAL' : t.recipient_risk_score > 0.5 ? 'HIGH' : 'MEDIUM'}`}>
                          {(t.recipient_risk_score * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td>
                        {t.fefo_priority ? (
                          <span style={{ color: 'var(--high)' }}>⏳ Yes</span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
