import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { useTheme } from '../components/ThemeContext.jsx'
import api from '../services/api.js'
import KpiCard from '../components/KpiCard.jsx'
import ModelComparisonCard from '../components/ModelComparisonCard.jsx'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid, ReferenceLine
} from 'recharts'
import { TrendingUp, Loader2 } from 'lucide-react'

const MEDICINES = ['Paracetamol', 'ORS', 'Amoxicillin', 'Chloroquine/ACT', 'Insulin', 'IV Fluids', 'Doxycycline', 'Iron Folic Acid']
const HORIZONS = [1, 7, 14, 30]
const H_COLORS = { 1: '#3b82f6', 7: '#8b5cf6', 14: '#f97316', 30: '#ef4444' }

export default function DemandForecast() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [phcs, setPhcs] = useState([])
  const [phcId, setPhcId] = useState('')
  const [medicine, setMedicine] = useState(MEDICINES[0])
  const [horizon, setHorizon] = useState(7)
  const [results, setResults] = useState({})   // keyed by horizon
  const [loading, setLoading] = useState(false)
  const [activeH, setActiveH] = useState(7)

  useEffect(() => {
    api.getPHCs().then(data => { setPhcs(data); if (data.length) setPhcId(data[0].code) })
  }, [])

  const runAll = async () => {
    if (!phcId) return
    setLoading(true); setResults({})
    try {
      const all = await Promise.all(
        HORIZONS.map(h => api.predictDemand({ phc_id: phcId, medicine, horizon_days: h }).then(r => [h, r]))
      )
      const map = Object.fromEntries(all)
      setResults(map)
      setActiveH(7)
      toast.success(`Forecasts ready for all 4 horizons`)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Forecast failed.')
    } finally { setLoading(false) }
  }

<<<<<<< HEAD
  return (
    <div className="dashboard-content">
=======
  const card = isDark ? 'bg-[#111a30] border border-blue-900/20' : 'bg-white border border-slate-200'
  const inputCls = isDark
    ? 'bg-[#0d1525] border border-blue-900/30 text-slate-200 focus:border-blue-500'
    : 'bg-slate-50 border border-slate-200 text-slate-800 focus:border-blue-400'
>>>>>>> origin/main

  // Build comparison chart data
  const compareData = HORIZONS.map(h => ({
    name: `${h}d`,
    value: results[h]?.final_prediction ?? 0,
    model: results[h]?.selected_model ?? '',
  }))

  const activeResult = results[activeH]

  // Build mock trajectory for area chart
  const trajectoryData = activeResult ? (() => {
    const pred = activeResult.final_prediction ?? 0
    const historical = Array.from({ length: 7 }, (_, i) => ({
      day: `Day -${6 - i}`,
      historical: +(pred * (0.7 + Math.random() * 0.6)).toFixed(1),
      forecast: null,
    }))
    const forecast = Array.from({ length: activeH <= 7 ? activeH : 7 }, (_, i) => ({
      day: `Day +${i + 1}`,
      historical: null,
      forecast: +(pred * (0.85 + Math.random() * 0.3)).toFixed(1),
    }))
    return [...historical, ...forecast]
  })() : []

  const ttStyle = {
    background: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? 'rgba(56,90,150,0.3)' : '#e2e8f0'}`,
    borderRadius: 10, fontSize: 12,
    color: isDark ? '#f1f5f9' : '#0f172a',
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
        className={`rounded-2xl p-5 ${card} shadow-sm`}>
        <h2 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Configure Forecast
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Facility (PHC)</label>
            <select value={phcId} onChange={e => setPhcId(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors ${inputCls}`}>
              {phcs.map(p => <option key={p.code} value={p.code}>{p.code} — {p.district}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Medicine</label>
            <select value={medicine} onChange={e => setMedicine(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors ${inputCls}`}>
              {MEDICINES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button onClick={runAll} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <TrendingUp size={15} />}
            {loading ? 'Forecasting all horizons...' : 'Forecast All Horizons'}
          </button>
        </div>
      </motion.div>

      {/* Horizon comparison */}
      {Object.keys(results).length > 0 && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="space-y-5">

          {/* KPI cards — one per horizon */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {HORIZONS.map((h, i) => (
              <motion.div key={h} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.06 }}
                onClick={() => setActiveH(h)}
                className={`cursor-pointer rounded-2xl p-4 border-l-4 transition-all shadow-sm
                  ${activeH === h
                    ? isDark ? 'bg-blue-500/10 border-blue-400 ring-1 ring-blue-500/30' : 'bg-blue-50 border-blue-400 ring-1 ring-blue-400/30'
                    : isDark ? 'bg-[#111a30] border-transparent hover:border-blue-900/50' : 'bg-white border-transparent hover:border-slate-300'
                  }
                  ${isDark ? 'border-t border-r border-b border-blue-900/20' : 'border-t border-r border-b border-slate-200'}
                `}
                style={{ borderLeftColor: H_COLORS[h] }}
              >
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {h}-Day Horizon
                </div>
                <div className={`text-2xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {results[h]?.final_prediction ?? '—'}
                </div>
                <div className={`text-[10px] mt-1 font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  units · {results[h]?.selected_model}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Comparison bar chart */}
          <div className={`rounded-2xl p-5 ${card} shadow-sm`}>
            <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Horizon Comparison — Predicted Units
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={compareData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(56,90,150,0.1)' : '#f1f5f9'} />
                <XAxis dataKey="name" stroke="#5e7399" fontSize={12} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                <YAxis stroke="#5e7399" fontSize={11} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                <Tooltip contentStyle={ttStyle} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {compareData.map((d, i) => (
                    <Cell key={i} fill={H_COLORS[HORIZONS[i]]} fillOpacity={activeH === HORIZONS[i] ? 1 : 0.45} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Active horizon detail */}
          {activeResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Trajectory area chart */}
              <div className={`rounded-2xl p-5 ${card} shadow-sm`}>
                <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {activeH}-Day Demand Trajectory
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trajectoryData}>
                    <defs>
                      <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(56,90,150,0.1)' : '#f1f5f9'} />
                    <XAxis dataKey="day" stroke="#5e7399" fontSize={9} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <YAxis stroke="#5e7399" fontSize={10} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <Tooltip contentStyle={ttStyle} />
                    <ReferenceLine x="Day -1" stroke="#475569" strokeDasharray="4 4" label={{ value: 'Today', fill: '#64748b', fontSize: 9 }} />
                    <Area type="monotone" dataKey="historical" stroke="#3b82f6" fill="url(#histGrad)" strokeWidth={2} dot={false} name="Historical" connectNulls={false} />
                    <Area type="monotone" dataKey="forecast" stroke="#22c55e" fill="url(#fcGrad)" strokeWidth={2} strokeDasharray="5 3" dot={false} name="Forecast" connectNulls={false} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className={`flex gap-4 mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Historical (indicative)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block border-dashed" /> Forecast</span>
                </div>
              </div>

              {/* Model comparison */}
              <ModelComparisonCard
                allModelOutputs={activeResult.all_model_outputs}
                selectedModel={activeResult.selected_model}
                selectionReason={activeResult.selection_reason}
              />
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
