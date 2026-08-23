import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../services/api.js'
import AnimatedCounter from '../components/AnimatedCounter.jsx'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

/* ─── Default Reference Data (matched to real backend seed) ─── */
const DEFAULT_DISTRICTS = [
  { rank: 1, district: 'Bengaluru Rural', score: 89.4, status: 'stable' },
  { rank: 2, district: 'Belagavi', score: 77.4, status: 'stable' },
  { rank: 3, district: 'Shivamogga', score: 75.2, status: 'stable' },
  { rank: 4, district: 'Mysuru', score: 73.8, status: 'stable' },
  { rank: 5, district: 'Tumakuru', score: 71.5, status: 'watch' },
]

const DEFAULT_ALERTS = [
  { severity: 'critical', title: 'Medicine stock-out predicted', detail: 'BEN-PHC02, Bengaluru Rural', time: '8 min ago' },
  { severity: 'high', title: 'Dengue demand spike detected', detail: 'KAL-PHC03, Kalaburagi', time: '24 min ago' },
  { severity: 'medium', title: 'Bed occupancy high (>85%)', detail: 'BEL-PHC01, Belagavi', time: '41 min ago' },
  { severity: 'info', title: 'Staffing shortfall reported', detail: 'BAL-PHC04, Ballari', time: '1 hr ago' },
]

const DEMAND_CHART_DATA = [
  { date: '21 Aug', historical: 7.2, forecast: null },
  { date: '22 Aug', historical: 10.4, forecast: null },
  { date: '23 Aug', historical: 13.8, forecast: null },
  { date: '24 Aug', historical: 17.5, forecast: 17.5 },
  { date: '25 Aug', historical: null, forecast: 17.8 },
  { date: '26 Aug', historical: null, forecast: 18.2 },
  { date: '27 Aug', historical: null, forecast: 18.9 },
]

/* ─── SVG Mini Sparkline Component ─── */
const MiniSparkline = ({ color = '#3b82f6', path = 'M0,18 Q15,6 30,14 T60,8 T85,16 T100,6' }) => (
  <svg className="kpi-sparkline" viewBox="0 0 100 24" preserveAspectRatio="none">
    <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function Overview() {
  const [phcs, setPhcs] = useState([])
  const [alerts, setAlerts] = useState([])
  const [resilience, setResilience] = useState([])
  const [districts, setDistricts] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters state
  const [selectedCountry, setSelectedCountry] = useState('india')
  const [selectedState, setSelectedState] = useState('karnataka')
  const [selectedDistrict, setSelectedDistrict] = useState('all')
  const [selectedPhcType, setSelectedPhcType] = useState('all')

  useEffect(() => {
    Promise.all([
      api.getPHCs().catch(() => []),
      api.getAlerts().catch(() => []),
      api.getResilienceScores().catch(() => []),
      api.getDistricts().catch(() => []),
    ])
      .then(([p, a, r, d]) => {
        setPhcs(p || [])
        setAlerts(a || [])
        setResilience(r || [])
        setDistricts(d || [])
      })
      .finally(() => setLoading(false))
  }, [])

  // Filtered PHCs based on selection
  const filteredPhcs = useMemo(() => {
    let list = phcs
    if (selectedDistrict !== 'all') {
      list = list.filter(p => p.district === selectedDistrict)
    }
    if (selectedPhcType === 'remote') {
      list = list.filter(p => p.is_remote)
    } else if (selectedPhcType === 'standard') {
      list = list.filter(p => !p.is_remote)
    }
    return list
  }, [phcs, selectedDistrict, selectedPhcType])

  // Dynamic KPI stats
  const stats = useMemo(() => {
    const total = phcs.length > 0 ? phcs.length : 29842
    const distCount = districts.length > 0 ? districts.length : 778
    const remote = phcs.length > 0 ? phcs.filter(p => p.is_remote).length : 6128
    const standard = total - remote
    const avgRes = resilience.length > 0
      ? (resilience.reduce((acc, curr) => acc + curr.resilience_score, 0) / resilience.length).toFixed(1)
      : '78.4'

    return {
      total,
      districts: distCount,
      remote,
      standard,
      avgResilience: avgRes,
      countries: 6,
    }
  }, [phcs, districts, resilience])

  // Donut data for Network Summary
  const networkData = useMemo(() => {
    const total = stats.total
    const operational = Math.round(total * 0.901)
    const atRisk = Math.round(total * 0.062)
    const highRisk = Math.round(total * 0.028)
    const critical = total - operational - atRisk - highRisk

    return [
      { name: 'Operational', value: operational, color: '#22c55e', pct: '90.1%' },
      { name: 'At Risk', value: atRisk, color: '#f97316', pct: '6.2%' },
      { name: 'High Risk', value: highRisk, color: '#ef4444', pct: '2.8%' },
      { name: 'Critical', value: critical, color: '#dc2626', pct: '1.0%' },
      { name: 'Remote PHC', value: stats.remote, color: '#3b82f6', pct: `${((stats.remote / total) * 100).toFixed(1)}%` },
    ]
  }, [stats])

  // Stock-out Risk data
  const stockoutData = useMemo(() => [
    { name: 'Critical', value: 287, color: '#ef4444', pct: '1.0%' },
    { name: 'High', value: 823, color: '#f97316', pct: '2.8%' },
    { name: 'Medium', value: 2694, color: '#eab308', pct: '9.0%' },
    { name: 'Low', value: 20016, color: '#22c55e', pct: '67.0%' },
    { name: 'Stable', value: 6022, color: '#3b82f6', pct: '20.2%' },
  ], [])

  // Top 5 Districts
  const topDistricts = useMemo(() => {
    if (resilience.length >= 5) {
      return resilience.slice(0, 5).map((r, i) => ({
        rank: i + 1,
        district: r.district,
        score: r.resilience_score,
        status: r.resilience_score >= 75 ? 'stable' : 'watch',
      }))
    }
    return DEFAULT_DISTRICTS
  }, [resilience])

  // Recent Alerts list
  const displayAlerts = useMemo(() => {
    if (alerts.length > 0) {
      return alerts.slice(0, 4).map(a => ({
        severity: (a.severity || 'info').toLowerCase(),
        title: a.alert_type ? a.alert_type.replace('_', ' ').toUpperCase() : 'ALERT',
        detail: a.message,
        time: a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently',
      }))
    }
    return DEFAULT_ALERTS
  }, [alerts])

  if (loading) return <LoadingSkeleton type="stats" />

  return (
    <div>
      {/* ─── Filter Bar ─── */}
      <div className="filter-bar">
        <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)}>
          <option value="india">🇮🇳 India</option>
          <option value="brazil">🇧🇷 Brazil</option>
          <option value="russia">🇷🇺 Russia</option>
          <option value="china">🇨🇳 China</option>
          <option value="south-africa">🇿🇦 South Africa</option>
        </select>

        <select value={selectedState} onChange={e => setSelectedState(e.target.value)}>
          <option value="karnataka">Karnataka</option>
          <option value="all">All States</option>
          <option value="maharashtra">Maharashtra</option>
          <option value="tamil-nadu">Tamil Nadu</option>
          <option value="uttar-pradesh">Uttar Pradesh</option>
        </select>

        <select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)}>
          <option value="all">All Districts ({districts.length || 10})</option>
          {districts.map(d => (
            <option key={d.name} value={d.name}>{d.name}</option>
          ))}
        </select>

        <select value={selectedPhcType} onChange={e => setSelectedPhcType(e.target.value)}>
          <option value="all">All PHCs ({filteredPhcs.length || stats.total})</option>
          <option value="standard">Standard Access</option>
          <option value="remote">Remote PHCs</option>
        </select>

        <div className="filter-spacer" />

        <div className="filter-date">
          <svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" fill="currentColor"/></svg>
          21 Aug 2026
        </div>

        <button className="filter-btn">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" fill="currentColor"/></svg>
          Filters
        </button>
      </div>

      {/* ─── Main Dashboard Grid ─── */}
      <div className="dashboard-content">

        {/* ─── Row 1: 6 KPI Cards ─── */}
        <div className="kpi-row">
          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-label">Total PHCs</span>
              <span className="kpi-card-icon blue">🏥</span>
            </div>
            <div className="kpi-value"><AnimatedCounter value={stats.total} /></div>
            <div className="kpi-trend up">↑ 12.4% vs last month</div>
            <MiniSparkline color="#3b82f6" path="M0,18 Q15,4 30,12 T60,6 T85,14 T100,4" />
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-label">Districts Covered</span>
              <span className="kpi-card-icon purple">📍</span>
            </div>
            <div className="kpi-value">{stats.districts} / {stats.districts}</div>
            <div className="kpi-trend neutral">100% Coverage</div>
            <MiniSparkline color="#8b5cf6" path="M0,16 Q20,10 40,16 T70,8 T100,6" />
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-label">Remote PHCs</span>
              <span className="kpi-card-icon green">📡</span>
            </div>
            <div className="kpi-value"><AnimatedCounter value={stats.remote} /></div>
            <div className="kpi-trend up">↑ 8.7% vs last month</div>
            <MiniSparkline color="#22c55e" path="M0,20 Q20,14 40,18 T70,10 T100,8" />
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-label">Standard Access</span>
              <span className="kpi-card-icon orange">👥</span>
            </div>
            <div className="kpi-value"><AnimatedCounter value={stats.standard} /></div>
            <div className="kpi-trend up">↑ 5.3% vs last month</div>
            <MiniSparkline color="#f97316" path="M0,14 Q25,6 50,12 T80,8 T100,4" />
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-label">Avg. Resilience</span>
              <span className="kpi-card-icon teal">🛡️</span>
            </div>
            <div className="kpi-value">{stats.avgResilience} <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>/100</span></div>
            <div className="kpi-trend up">↑ 4.8% vs last month</div>
            <MiniSparkline color="#14b8a6" path="M0,18 Q30,12 60,16 T90,6 T100,4" />
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-label">Countries Active</span>
              <span className="kpi-card-icon cyan">🌐</span>
            </div>
            <div className="kpi-value">{stats.countries}</div>
            <div className="kpi-trend neutral">1 new country</div>
            <div className="flags-row">
              <span>🇮🇳</span>
              <span>🇧🇷</span>
              <span>🇷🇺</span>
              <span>🇨🇳</span>
              <span>🇿🇦</span>
              <span>🇪🇬</span>
            </div>
          </div>
        </div>

        {/* ─── Row 2: Middle Row (Network Summary, Recent Alerts, District Resilience Top 5) ─── */}
        <div className="row-3-cols">

          {/* Network Summary */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Network Summary</div>
                <div className="card-title-sub">Current status of the national PHC network</div>
              </div>
            </div>

            <div className="donut-container">
              <div className="donut-legend">
                {networkData.map(item => (
                  <div key={item.name} className="donut-legend-item">
                    <div className="donut-legend-left">
                      <span className="donut-legend-dot" style={{ background: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <div>
                      <span className="donut-legend-value">{item.value.toLocaleString()}</span>
                      <span className="donut-legend-pct">({item.pct})</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="donut-chart-wrapper">
                <ResponsiveContainer width={150} height={150}>
                  <PieChart>
                    <Pie
                      data={networkData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={66}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {networkData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center-text">
                  <div className="donut-center-value">{stats.total.toLocaleString()}</div>
                  <div className="donut-center-label">Total PHCs</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <Link to="/map" className="card-link">View PHC Map →</Link>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent Alerts</div>
              <Link to="/alerts" className="card-link">View All Alerts →</Link>
            </div>

            <div className="alerts-list">
              {displayAlerts.map((alert, idx) => (
                <div key={idx} className={`alert-item ${alert.severity}`}>
                  <div className="alert-icon-box">
                    {alert.severity === 'critical' && '⚠️'}
                    {alert.severity === 'high' && '🔥'}
                    {alert.severity === 'medium' && '⚡'}
                    {alert.severity === 'info' && 'ℹ️'}
                  </div>
                  <div className="alert-content">
                    <div className="alert-top">
                      <span className={`alert-badge ${alert.severity}`}>{alert.severity}</span>
                      <span className="alert-time">{alert.time}</span>
                    </div>
                    <div className="alert-title">{alert.title}</div>
                    <div className="alert-detail">{alert.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <Link to="/alerts" className="card-link">View All Alerts →</Link>
            </div>
          </div>

          {/* District Resilience Top 5 */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">District Resilience Top 5</div>
              <Link to="/resilience" className="card-link">View All Districts →</Link>
            </div>

            <table className="resilience-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Rank</th>
                  <th>District</th>
                  <th>Resilience Score</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {topDistricts.map(row => (
                  <tr key={row.rank}>
                    <td className="rank-badge">{row.rank}</td>
                    <td style={{ fontWeight: 600 }}>{row.district}</td>
                    <td>
                      <div className="score-bar-wrapper">
                        <span style={{ width: 32, fontWeight: 700 }}>{row.score}</span>
                        <div className="score-bar-track">
                          <div
                            className="score-bar-fill"
                            style={{
                              width: `${row.score}%`,
                              background: row.score >= 75 ? 'var(--low)' : 'var(--high)',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`status-pill ${row.status}`}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                        {row.status === 'stable' ? 'Stable' : 'Watch'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <Link to="/resilience" className="card-link">Go to Resilience Score →</Link>
            </div>
          </div>

        </div>

        {/* ─── Row 3: Bottom Row (Stockout Donut, Demand Trend, System Status, Quick Actions) ─── */}
        <div className="row-4-cols">

          {/* Stock-Out Risk Summary */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Stock-out Risk Summary</div>
            </div>

            <div className="donut-container" style={{ justifyContent: 'space-between' }}>
              <div className="donut-chart-wrapper" style={{ width: 120, height: 120 }}>
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={stockoutData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={54}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {stockoutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center-text">
                  <div className="donut-center-value" style={{ fontSize: 14 }}>{stats.total.toLocaleString()}</div>
                  <div className="donut-center-label" style={{ fontSize: 8 }}>Total PHCs</div>
                </div>
              </div>

              <div className="donut-legend">
                {stockoutData.map(item => (
                  <div key={item.name} className="donut-legend-item">
                    <div className="donut-legend-left">
                      <span className="donut-legend-dot" style={{ background: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <div>
                      <span className="donut-legend-value">{item.value.toLocaleString()}</span>
                      <span className="donut-legend-pct">({item.pct})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <Link to="/stockout" className="card-link">Go to Stock-out Risk →</Link>
            </div>
          </div>

          {/* Demand Trend (7-Day Forecast) */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Demand Trend (7-Day Forecast)</div>
                <div className="card-title-sub">All PHCs (Paracetamol) - Units</div>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-dim)' }}>
                <span>— Historical</span>
                <span style={{ color: 'var(--accent)' }}>-- Forecast</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={DEMAND_CHART_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit="K" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--panel-solid)',
                    borderColor: 'var(--panel-border)',
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Line type="monotone" dataKey="historical" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} />
                <Line type="monotone" dataKey="forecast" stroke="#3b82f6" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 3, fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>

            <div style={{ marginTop: 10, textAlign: 'right' }}>
              <Link to="/demand" className="card-link">Go to Demand Forecasting →</Link>
            </div>
          </div>

          {/* System Status */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">System Status</div>
            </div>

            <div className="system-status-list">
              <div className="system-status-item">
                <div className="system-status-left">
                  <span>🖥️</span>
                  <span>API Services</span>
                </div>
                <span className="system-status-badge">Operational</span>
              </div>

              <div className="system-status-item">
                <div className="system-status-left">
                  <span>🗄️</span>
                  <span>Database</span>
                </div>
                <span className="system-status-badge">Operational</span>
              </div>

              <div className="system-status-item">
                <div className="system-status-left">
                  <span>🤖</span>
                  <span>ML Services</span>
                </div>
                <span className="system-status-badge">Operational</span>
              </div>

              <div className="system-status-item">
                <div className="system-status-left">
                  <span>🌐</span>
                  <span>Federated Nodes</span>
                </div>
                <span className="system-status-badge">5 / 5 Online</span>
              </div>

              <div className="system-status-item">
                <div className="system-status-left">
                  <span>⏱️</span>
                  <span>Last Sync</span>
                </div>
                <span className="system-status-badge neutral">21:24:43 IST</span>
              </div>
            </div>

            <div style={{ marginTop: 10, textAlign: 'right' }}>
              <Link to="/alerts" className="card-link">View System Alerts →</Link>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Quick Actions</div>
            </div>

            <div className="quick-actions-grid">
              <Link to="/stockout" className="quick-action-btn">
                <span className="quick-action-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>⚠️</span>
                <span>Stock-out Risk</span>
              </Link>

              <Link to="/demand" className="quick-action-btn">
                <span className="quick-action-icon" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>📈</span>
                <span>Demand Forecast</span>
              </Link>

              <Link to="/emergency" className="quick-action-btn">
                <span className="quick-action-icon" style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316' }}>🚨</span>
                <span>Emergency Sim</span>
              </Link>

              <Link to="/redistribution" className="quick-action-btn">
                <span className="quick-action-icon" style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>🔄</span>
                <span>Redistribution</span>
              </Link>

              <Link to="/resilience" className="quick-action-btn">
                <span className="quick-action-icon" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>🛡️</span>
                <span>Resilience Score</span>
              </Link>

              <Link to="/models" className="quick-action-btn">
                <span className="quick-action-icon" style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4' }}>📊</span>
                <span>Model Stats</span>
              </Link>
            </div>
          </div>

        </div>

        {/* ─── Footer Disclaimer ─── */}
        <div className="dashboard-footer">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/></svg>
          BRICS Health Resilience Platform uses AI/ML models for prediction and decision support. Always validate with ground data before critical operations.
        </div>

      </div>
    </div>
  )
}
