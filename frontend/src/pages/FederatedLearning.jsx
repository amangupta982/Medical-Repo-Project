import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import api from '../services/api.js'
import AnimatedCounter from '../components/AnimatedCounter.jsx'

const CLIENT_FLAGS = { India: '🇮🇳', Brazil: '🇧🇷', Russia: '🇷🇺', China: '🇨🇳', South_Africa: '🇿🇦' }
const CLIENT_COLORS = { India: '#ff9d3a', Brazil: '#36d89a', Russia: '#4ea8ff', China: '#ff4d6a', South_Africa: '#7c5cff' }

export default function FederatedLearning() {
  const [rounds, setRounds] = useState(5)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await api.trainFederated(rounds)
      setResult(res)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Federated training failed. This can take a few minutes — check backend logs.')
    } finally { setLoading(false) }
  }

  const chartData = result ? Object.entries(result.local_only_before).map(([name, m]) => ({
    name: name.replaceAll('_', ' '),
    'PR-AUC': m.pr_auc,
    'ROC-AUC': m.roc_auc,
    color: CLIENT_COLORS[name] || '#4ea8ff',
  })) : []

  return (
    <div className="dashboard-content">

      <div className="card card-accent">
        {/* Client Cards */}
        <div className="grid grid-5" style={{ marginBottom: 16 }}>
          {Object.entries(CLIENT_FLAGS).map(([name, flag]) => (
            <div key={name} className="scenario-card" style={{ cursor: 'default' }}>
              <div className="scenario-icon">{flag}</div>
              <div className="scenario-name">{name.replaceAll('_', ' ')}</div>
              <div className="scenario-desc">NumPyClient</div>
            </div>
          ))}
        </div>

        <div className="info-banner" style={{ marginBottom: 14 }}>
          ⚠️ Clients are simulated partitions of the calibrated synthetic PHC dataset with
          per-client demand/resource heterogeneity — not real national health records.
          See docs/DATA_SOURCES.md.
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Rounds:</span>
            <input type="number" min="1" max="20" value={rounds}
              onChange={e => setRounds(Number(e.target.value))} style={{ width: 70 }} />
          </label>
          <button onClick={run} disabled={loading}>
            {loading ? '⏳ Training (may take a few minutes)...' : '🌐 Run Federated Training'}
          </button>
        </div>
        {error && <p style={{ color: 'var(--critical)', marginTop: 12, fontSize: 13 }}>{error}</p>}
      </div>

      {result && (
        <>
          <div className="grid grid-2">
            <div className="card">
              <h2>Local-only Performance (Before Federation)</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,90,150,0.1)" />
                  <XAxis dataKey="name" stroke="#5e7399" fontSize={11} />
                  <YAxis stroke="#5e7399" domain={[0, 1]} fontSize={11} />
                  <Tooltip contentStyle={{ background: '#101830', border: '1px solid rgba(56,90,150,0.18)', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="PR-AUC" radius={[3, 3, 0, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.8} />)}
                  </Bar>
                  <Bar dataKey="ROC-AUC" radius={[3, 3, 0, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.4} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h2>Federated (FedAvg) — After {result.rounds} Rounds</h2>
              {Object.keys(result.federated_avg_after).length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  {Object.entries(result.federated_avg_after).map(([key, value]) => (
                    <div key={key} className="driver-item">
                      <div className="driver-label">
                        <span className="driver-name">{key.replaceAll('_', ' ')}</span>
                        <span style={{ fontWeight: 600, color: 'var(--low)' }}>
                          {typeof value === 'number' ? value.toFixed(4) : JSON.stringify(value)}
                        </span>
                      </div>
                      {typeof value === 'number' && (
                        <div className="driver-bar-track">
                          <div className="driver-bar-fill" style={{ width: `${Math.min(100, value * 100)}%`, background: 'var(--low)' }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="methodology">
                  Federated metrics will appear after the training rounds complete.
                  The Flower simulation runs FedAvg aggregation across all 5 clients.
                </div>
              )}
            </div>
          </div>

          {result.note && (
            <div className="card">
              <h2>Data Provenance</h2>
              <div className="info-banner info">{result.note}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
