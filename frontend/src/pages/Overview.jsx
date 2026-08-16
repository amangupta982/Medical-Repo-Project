import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import api from '../services/api.js'
import AnimatedCounter from '../components/AnimatedCounter.jsx'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

export default function Overview() {
  const [phcs, setPhcs] = useState([])
  const [alerts, setAlerts] = useState([])
  const [resilience, setResilience] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getPHCs(), api.getAlerts(), api.getResilienceScores().catch(() => [])])
      .then(([p, a, r]) => { setPhcs(p); setAlerts(a); setResilience(r) })
      .finally(() => setLoading(false))
  }, [])

  const remotePhcs = phcs.filter(p => p.is_remote).length
  const districtsCovered = new Set(phcs.map(p => p.district)).size
  const totalPop = phcs.reduce((s, p) => s + (p.catchment_population || 0), 0)
  const avgResilience = resilience.length
    ? resilience.reduce((s, d) => s + d.resilience_score, 0) / resilience.length
    : 0
  const weakest = resilience.length ? [...resilience].sort((a, b) => a.resilience_score - b.resilience_score)[0] : null

  const resilienceChartData = resilience.slice(0, 10).map(d => ({
    name: d.district.length > 12 ? d.district.slice(0, 12) + '…' : d.district,
    score: d.resilience_score,
  }))

  const COLORS = ['#36d89a', '#4ea8ff', '#7c5cff', '#ffd23a', '#ff9d3a', '#ff4d6a']

  if (loading) return <LoadingSkeleton type="stats" />

  return (
    <div>
      <div className="page-header">
        <h2>National PHC Network Overview</h2>
        <div className="page-subtitle">Real-time visibility across the primary healthcare network</div>
      </div>

      <div className="grid grid-4">
        <div className="card stat">
          <div className="value"><AnimatedCounter value={phcs.length} /></div>
          <div className="label">Primary Health Centres</div>
        </div>
        <div className="card stat">
          <div className="value"><AnimatedCounter value={districtsCovered} /></div>
          <div className="label">Districts Covered</div>
        </div>
        <div className="card stat">
          <div className="value"><AnimatedCounter value={remotePhcs} /></div>
          <div className="label">Remote PHCs</div>
        </div>
        <div className="card stat">
          <div className="value text-low"><AnimatedCounter value={avgResilience} decimals={1} /></div>
          <div className="label">Avg. Resilience Score</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>District Resilience Ranking</h2>
          {resilience.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={resilienceChartData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" domain={[0, 100]} stroke="#5e7399" fontSize={11} />
                <YAxis dataKey="name" type="category" width={100} stroke="#5e7399" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#101830', border: '1px solid rgba(56,90,150,0.18)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {resilienceChartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <div className="empty-text">Resilience data unavailable</div>
              <div className="empty-hint">Check backend connection</div>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <h2>Recent Alerts</h2>
            {alerts.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 16px' }}>
                <div className="empty-icon">🔔</div>
                <div className="empty-text">No alerts yet</div>
                <div className="empty-hint">Run a prediction or simulation to generate alerts</div>
              </div>
            ) : (
              <table>
                <tbody>
                  {alerts.slice(0, 6).map(a => (
                    <tr key={a.id}>
                      <td style={{ width: 90 }}><span className={`badge ${a.severity}`}>{a.severity}</span></td>
                      <td style={{ fontSize: 12 }}>{a.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {weakest && (
            <div className="card card-accent">
              <h2>Weakest District Right Now</h2>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{weakest.district}</div>
              <div style={{ color: 'var(--text-dim)', margin: '6px 0', fontSize: 13 }}>
                Resilience: <strong style={{ color: weakest.resilience_score < 40 ? 'var(--critical)' : 'var(--high)' }}>
                  {weakest.resilience_score}/100
                </strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Weakest factor: <strong>{weakest.weakest_factor.replaceAll('_', ' ')}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Quick Actions</h2>
        <div className="action-cards">
          <Link to="/stockout" className="action-card">
            <div className="action-icon">⚠️</div>
            <div className="action-title">Predict Stock-out Risk</div>
            <div className="action-desc">XGBoost vs LightGBM with SHAP explanations</div>
          </Link>
          <Link to="/demand" className="action-card">
            <div className="action-icon">📈</div>
            <div className="action-title">Forecast Demand</div>
            <div className="action-desc">1/7/14/30-day horizons</div>
          </Link>
          <Link to="/emergency" className="action-card">
            <div className="action-icon">🚨</div>
            <div className="action-title">Simulate Emergency</div>
            <div className="action-desc">Dengue, flu, GI outbreak scenarios</div>
          </Link>
          <Link to="/redistribution" className="action-card">
            <div className="action-icon">🔄</div>
            <div className="action-title">Optimize Redistribution</div>
            <div className="action-desc">OR-Tools transportation LP with FEFO</div>
          </Link>
          <Link to="/federated" className="action-card">
            <div className="action-icon">🌐</div>
            <div className="action-title">Federated Learning</div>
            <div className="action-desc">Train across 5 BRICS clients</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
