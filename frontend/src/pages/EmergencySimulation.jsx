import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../services/api.js'
import AnimatedCounter from '../components/AnimatedCounter.jsx'

const SCENARIOS = [
  { value: 'dengue_outbreak', label: 'Dengue Outbreak', icon: '🦟', desc: '1.8x patients, 2.2x medicine demand' },
  { value: 'flu_surge', label: 'Flu Surge', icon: '🤧', desc: '1.4x patients, 1.3x demand' },
  { value: 'gi_outbreak', label: 'GI / Waterborne', icon: '💧', desc: '1.6x patients, 2.0x demand' },
  { value: '', label: 'Custom', icon: '🎛️', desc: 'Use sliders below' },
]

export default function EmergencySimulation() {
  const [scenario, setScenario] = useState('dengue_outbreak')
  const [patientIncrease, setPatientIncrease] = useState(0)
  const [supplyDisruption, setSupplyDisruption] = useState(0)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await api.simulateEmergency({
        scenario: scenario || null,
        patient_increase_pct: Number(patientIncrease),
        supply_disruption_pct: Number(supplyDisruption),
      })
      setResult(res)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Simulation failed.')
    } finally { setLoading(false) }
  }

  const chartData = result ? [
    { name: 'Avg Risk', Before: +(result.avg_risk_before * 100).toFixed(1), After: +(result.avg_risk_after * 100).toFixed(1) },
    { name: 'Max Risk', Before: +(result.max_risk_before * 100).toFixed(1), After: +(result.max_risk_after * 100).toFixed(1) },
  ] : []

  return (
    <div>
      <div className="page-header">
        <h2>Emergency / What-If Simulation</h2>
        <div className="page-subtitle">Stress-test the current model against outbreak and supply-chain scenarios</div>
      </div>

      <div className="card card-accent">
        <h2>Select Scenario</h2>
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          {SCENARIOS.map(s => (
            <div key={s.value}
              className={`scenario-card ${scenario === s.value ? 'active' : ''}`}
              onClick={() => setScenario(s.value)}>
              <div className="scenario-icon">{s.icon}</div>
              <div className="scenario-name">{s.label}</div>
              <div className="scenario-desc">{s.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 500, marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Patient increase: <strong style={{ color: 'var(--accent)' }}>{patientIncrease}%</strong>
            <input type="range" min="0" max="150" step="10" value={patientIncrease}
              onChange={e => setPatientIncrease(e.target.value)} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Supply disruption: <strong style={{ color: 'var(--high)' }}>{supplyDisruption}%</strong>
            <input type="range" min="0" max="100" step="10" value={supplyDisruption}
              onChange={e => setSupplyDisruption(e.target.value)} />
          </label>
        </div>

        <button onClick={run} disabled={loading}>
          {loading ? '⏳ Simulating...' : '🚨 Run Simulation'}
        </button>
        {error && <p style={{ color: 'var(--critical)', marginTop: 12, fontSize: 13 }}>{error}</p>}
      </div>

      {result && (
        <>
          <div className="grid grid-3">
            <div className="card stat">
              <div className="value">
                <AnimatedCounter value={result.avg_risk_before * 100} decimals={0} suffix="%" />
                <span style={{ color: 'var(--text-dim)', margin: '0 6px', fontSize: 16 }}>→</span>
                <span style={{ color: 'var(--critical)' }}>
                  <AnimatedCounter value={result.avg_risk_after * 100} decimals={0} suffix="%" />
                </span>
              </div>
              <div className="label">Avg Risk (Before → After)</div>
            </div>
            <div className="card stat">
              <div className="value text-critical"><AnimatedCounter value={result.phcs_newly_critical} /></div>
              <div className="label">PHCs Newly Critical</div>
            </div>
            <div className="card stat">
              <div className="value text-critical"><AnimatedCounter value={result.max_risk_after * 100} decimals={0} suffix="%" /></div>
              <div className="label">Peak Risk After</div>
            </div>
          </div>

          <div className="card">
            <h2>Before vs After Impact</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,90,150,0.1)" />
                <XAxis dataKey="name" stroke="#5e7399" fontSize={12} />
                <YAxis stroke="#5e7399" fontSize={11} unit="%" />
                <Tooltip contentStyle={{ background: '#101830', border: '1px solid rgba(56,90,150,0.18)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Before" fill="#4ea8ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="After" fill="#ff4d6a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h2>Top Impacted PHC-Medicine Pairs</h2>
            <table>
              <thead><tr><th>PHC</th><th>Medicine</th><th>Risk Before</th><th>Risk After</th><th>Delta</th></tr></thead>
              <tbody>
                {result.top_impacted.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{r.phc_id}</td>
                    <td>{r.medicine}</td>
                    <td>{(r.risk_before * 100).toFixed(0)}%</td>
                    <td style={{ color: r.risk_after > 0.7 ? 'var(--critical)' : 'var(--text)' }}>
                      {(r.risk_after * 100).toFixed(0)}%
                    </td>
                    <td style={{ color: 'var(--critical)', fontWeight: 600 }}>+{(r.risk_delta * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
