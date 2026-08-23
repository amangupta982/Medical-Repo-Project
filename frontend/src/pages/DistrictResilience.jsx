import { useEffect, useState } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import api from '../services/api.js'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

const COLORS = ['#36d89a', '#4ea8ff', '#7c5cff', '#ffd23a', '#ff9d3a', '#ff4d6a', '#c84eff', '#2fb8e0', '#ff6b9d', '#a0e548']

export default function DistrictResilience() {
  const [scores, setScores] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getResilienceScores()
      .then(data => { setScores(data); if (data.length) setSelected(data[0]) })
      .finally(() => setLoading(false))
  }, [])

  const radarData = selected ? [
    { factor: 'Medicine', value: selected.medicine_availability, fullMark: 100 },
    { factor: 'Beds', value: selected.bed_capacity, fullMark: 100 },
    { factor: 'Staffing', value: selected.staffing_adequacy, fullMark: 100 },
    { factor: 'Readiness', value: selected.emergency_readiness, fullMark: 100 },
  ] : []

  const barData = scores.map(s => ({
    name: s.district.length > 14 ? s.district.slice(0, 14) + '…' : s.district,
    score: s.resilience_score,
  }))

  if (loading) return <LoadingSkeleton type="stats" />

  return (
    <div className="dashboard-content">

      <div className="grid grid-2">
        <div className="card">
          <h2>District Ranking</h2>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={barData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" domain={[0, 100]} stroke="#5e7399" fontSize={11} />
              <YAxis dataKey="name" type="category" width={110} stroke="#5e7399" fontSize={11} />
              <Tooltip contentStyle={{ background: '#101830', border: '1px solid rgba(56,90,150,0.18)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} cursor="pointer"
                onClick={(data) => {
                  const match = scores.find(s => s.district.startsWith(data.name.replace('…', '')))
                  if (match) setSelected(match)
                }}>
                {barData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <div className="card">
            <h2>{selected ? `${selected.district} — Factor Breakdown` : 'Select a district'}</h2>
            {selected && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <span style={{
                    fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em',
                    color: selected.resilience_score >= 60 ? 'var(--low)' : selected.resilience_score >= 40 ? 'var(--high)' : 'var(--critical)',
                  }}>
                    {selected.resilience_score}
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>/100</span>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(56,90,150,0.15)" />
                    <PolarAngleAxis dataKey="factor" stroke="#9aacca" fontSize={11} />
                    <PolarRadiusAxis domain={[0, 100]} stroke="rgba(56,90,150,0.15)" fontSize={9} />
                    <Radar dataKey="value" stroke="#4ea8ff" fill="#4ea8ff" fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>

          {selected && (
            <div className="card">
              <h2>Factor Scores</h2>
              {['medicine_availability', 'bed_capacity', 'staffing_adequacy', 'emergency_readiness'].map(key => (
                <div key={key} className="driver-item">
                  <div className="driver-label">
                    <span className="driver-name">{key.replaceAll('_', ' ')}</span>
                    <span style={{ fontWeight: 600, color: selected[key] >= 60 ? 'var(--low)' : selected[key] >= 40 ? 'var(--high)' : 'var(--critical)' }}>
                      {selected[key]}
                    </span>
                  </div>
                  <div className="driver-bar-track">
                    <div className="driver-bar-fill" style={{
                      width: `${selected[key]}%`,
                      background: selected[key] >= 60 ? 'var(--low)' : selected[key] >= 40 ? 'var(--high)' : 'var(--critical)',
                    }} />
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10 }}>
                Weakest: <strong style={{ color: 'var(--high)' }}>{selected.weakest_factor.replaceAll('_', ' ')}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Methodology</h2>
        <div className="methodology">
          Resilience = 0.35 × Medicine Availability + 0.20 × Bed Capacity +
          0.25 × Staffing Adequacy + 0.20 × Emergency Readiness. Each component
          is min-max normalized 0–100 across districts. Weights are documented and
          tunable in <code>backend/app/services/resilience_service.py</code>.
        </div>
      </div>
    </div>
  )
}
