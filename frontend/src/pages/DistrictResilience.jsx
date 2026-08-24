import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid
} from 'recharts'
import { ShieldCheck, Award, AlertTriangle, Activity, Info, BarChart2 } from 'lucide-react'
import { useTheme } from '../components/ThemeContext.jsx'
import api from '../services/api.js'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#6366f1', '#14b8a6', '#f43f5e']

const DEFAULT_RESILIENCE_SCORES = [
  { district: 'Bengaluru Rural', resilience_score: 89.4, medicine_availability: 92.5, bed_capacity: 86.0, staffing_adequacy: 88.0, emergency_readiness: 91.0, weakest_factor: 'bed_capacity' },
  { district: 'Belagavi', resilience_score: 77.4, medicine_availability: 78.0, bed_capacity: 76.0, staffing_adequacy: 75.0, emergency_readiness: 81.0, weakest_factor: 'staffing_adequacy' },
  { district: 'Shivamogga', resilience_score: 75.2, medicine_availability: 74.0, bed_capacity: 75.0, staffing_adequacy: 77.0, emergency_readiness: 75.0, weakest_factor: 'medicine_availability' },
  { district: 'Mysuru', resilience_score: 73.8, medicine_availability: 72.0, bed_capacity: 74.0, staffing_adequacy: 76.0, emergency_readiness: 73.0, weakest_factor: 'medicine_availability' },
  { district: 'Tumakuru', resilience_score: 71.5, medicine_availability: 70.0, bed_capacity: 72.0, staffing_adequacy: 73.0, emergency_readiness: 71.0, weakest_factor: 'medicine_availability' },
]

export default function DistrictResilience() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [scores, setScores] = useState(DEFAULT_RESILIENCE_SCORES)
  const [selected, setSelected] = useState(DEFAULT_RESILIENCE_SCORES[0])

  useEffect(() => {
    api.getResilienceScores()
      .then(data => {
        if (data && data.length > 0) {
          setScores(data)
          setSelected(data[0])
        }
      })
      .catch(() => {})
  }, [])

  const radarData = selected ? [
    { factor: 'Medicine Availability', value: selected.medicine_availability, fullMark: 100 },
    { factor: 'Bed Capacity', value: selected.bed_capacity, fullMark: 100 },
    { factor: 'Staffing Adequacy', value: selected.staffing_adequacy, fullMark: 100 },
    { factor: 'Emergency Readiness', value: selected.emergency_readiness, fullMark: 100 },
  ] : []

  const barData = scores.map(s => ({
    name: s.district.length > 13 ? s.district.slice(0, 13) + '…' : s.district,
    fullName: s.district,
    score: s.resilience_score,
  }))

  const cardCls = isDark
    ? 'bg-[#111a30] border border-blue-900/20 shadow-sm'
    : 'bg-white border border-slate-200 shadow-sm'

  const ttStyle = {
    background: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? 'rgba(56,90,150,0.3)' : '#e2e8f0'}`,
    borderRadius: 10,
    fontSize: 12,
    color: isDark ? '#f1f5f9' : '#0f172a',
  }

  return (
    <div className="space-y-5">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* District Ranking Horizontal Bar Chart */}
        <div className={`rounded-2xl p-5 ${cardCls}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              District Resilience Leaderboard (0–100)
            </h3>
            <span className="text-xs text-blue-400 font-medium">Click bar to select</span>
          </div>
          <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Composite index of medicine, beds, staffing, and readiness
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(56,90,150,0.1)' : '#f1f5f9'} />
                <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={11} />
                <YAxis dataKey="name" type="category" width={100} stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={ttStyle} />
                <Bar
                  dataKey="score"
                  radius={[0, 6, 6, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    const match = scores.find(s => s.district === data.fullName || s.district.startsWith(data.name.replace('…', '')))
                    if (match) setSelected(match)
                  }}
                >
                  {barData.map((d, i) => {
                    const isSelected = selected && (selected.district === d.fullName)
                    return (
                      <Cell
                        key={i}
                        fill={isSelected ? '#3b82f6' : COLORS[i % COLORS.length]}
                        fillOpacity={isSelected ? 1 : 0.75}
                      />
                    )
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Selected District Deep-Dive */}
        <div className="space-y-5">
          {selected && (
            <>
              {/* Radar Chart Card */}
              <div className={`rounded-2xl p-5 ${cardCls}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {selected.district}
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      4-Dimensional Resilience Profile
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-extrabold tabular-nums ${selected.resilience_score >= 60 ? 'text-green-400' : selected.resilience_score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                      {selected.resilience_score}
                      <span className="text-xs text-slate-400 font-normal">/100</span>
                    </div>
                  </div>
                </div>

                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke={isDark ? 'rgba(56,90,150,0.2)' : '#e2e8f0'} />
                      <PolarAngleAxis dataKey="factor" stroke="#94a3b8" fontSize={10} />
                      <PolarRadiusAxis domain={[0, 100]} stroke="rgba(56,90,150,0.2)" fontSize={9} />
                      <Radar
                        dataKey="value"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Factor Breakdown Bars */}
              <div className={`rounded-2xl p-5 ${cardCls}`}>
                <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Dimension Breakdown
                </h4>
                <div className="space-y-3">
                  {[
                    { key: 'medicine_availability', label: 'Medicine Availability', weight: '35%' },
                    { key: 'bed_capacity', label: 'Inpatient Bed Capacity', weight: '20%' },
                    { key: 'staffing_adequacy', label: 'Staffing Adequacy (Doctors/Nurses)', weight: '25%' },
                    { key: 'emergency_readiness', label: 'Emergency Surge Readiness', weight: '20%' },
                  ].map(({ key, label, weight }) => {
                    const val = selected[key] ?? 0
                    const color = val >= 60 ? 'bg-green-500 text-green-400' : val >= 40 ? 'bg-amber-500 text-amber-400' : 'bg-red-500 text-red-400'
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {label} <span className="text-[10px] text-slate-500">({weight})</span>
                          </span>
                          <span className={`font-bold ${color.split(' ')[1]}`}>{val}/100</span>
                        </div>
                        <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                          <div className={`h-full rounded-full ${color.split(' ')[0]}`} style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {selected.weakest_factor && (
                  <div className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${isDark ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                    <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                    <span>Primary bottleneck: <strong className="capitalize">{selected.weakest_factor.replaceAll('_', ' ')}</strong></span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>

      {/* ── Methodology Card ── */}
      <div className={`rounded-2xl p-5 ${cardCls}`}>
        <div className="flex items-center gap-2 mb-2">
          <Info size={16} className="text-blue-400" />
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Composite Index Formulation
          </h3>
        </div>
        <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          The District Resilience Score is an evidence-based multi-criteria composite index normalized across regional primary healthcare networks:
          <br />
          <code className="font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded mt-1 inline-block">
            Resilience = (0.35 × Medicine Availability) + (0.20 × Bed Capacity) + (0.25 × Staffing Adequacy) + (0.20 × Emergency Readiness)
          </code>
        </p>
      </div>

    </div>
  )
}
