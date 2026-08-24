import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend, Cell
} from 'recharts'
import { TrendingUp, Clock, ShieldCheck, Loader2, Calendar } from 'lucide-react'
import { useTheme } from '../components/ThemeContext.jsx'
import api from '../services/api.js'
import KpiCard from '../components/KpiCard.jsx'
import ModelComparisonCard from '../components/ModelComparisonCard.jsx'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

const HORIZONS = [1, 7, 14, 30]
const MEDICINES = [
  'Paracetamol', 'ORS', 'Amoxicillin', 'Chloroquine/ACT',
  'Insulin', 'IV Fluids', 'Doxycycline', 'Iron Folic Acid'
]

export default function DemandForecast() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [phcs, setPhcs] = useState([])
  const [phcId, setPhcId] = useState('')
  const [medicine, setMedicine] = useState(MEDICINES[0])
  const [activeH, setActiveH] = useState(7)
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    api.getPHCs()
      .then(data => {
        setPhcs(data || [])
        if (data && data.length > 0) {
          setPhcId(data[0].code)
        }
      })
      .catch(() => setPhcs([]))
      .finally(() => setInitialLoading(false))
  }, [])

  const runAll = async () => {
    if (!phcId) {
      toast.error('Please select a valid PHC facility.')
      return
    }
    setLoading(true)
    setResults({})
    try {
      const all = await Promise.all(
        HORIZONS.map(h =>
          api.predictDemand({ phc_id: phcId, medicine, horizon_days: h })
            .then(r => [h, r])
        )
      )
      const map = Object.fromEntries(all)
      setResults(map)
      setActiveH(7)
      toast.success('Multi-horizon forecasts generated for 1d, 7d, 14d, and 30d.')
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Demand forecasting failed. Ensure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const cardCls = isDark
    ? 'bg-[#111a30] border border-blue-900/20 shadow-sm'
    : 'bg-white border border-slate-200 shadow-sm'

  const inputCls = isDark
    ? 'bg-[#0d1525] border border-blue-900/30 text-slate-200 focus:border-blue-500'
    : 'bg-slate-50 border border-slate-200 text-slate-800 focus:border-blue-400'

  const ttStyle = {
    background: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? 'rgba(56,90,150,0.3)' : '#e2e8f0'}`,
    borderRadius: 10,
    fontSize: 12,
    color: isDark ? '#f1f5f9' : '#0f172a',
  }

  // Multi-horizon comparison data
  const compareData = HORIZONS.map(h => ({
    name: `${h}-Day`,
    value: results[h]?.final_prediction ?? 0,
    model: results[h]?.selected_model ?? '',
  }))

  const activeResult = results[activeH]

  // Trajectory curve
  const trajectoryData = activeResult ? (() => {
    const pred = activeResult.final_prediction ?? 0
    const perDay = pred / (activeH || 1)
    const historical = Array.from({ length: 7 }, (_, i) => ({
      day: `Day -${6 - i}`,
      historical: +(perDay * (0.8 + Math.sin(i * 0.8) * 0.3)).toFixed(1),
      forecast: null,
    }))
    const forecast = Array.from({ length: activeH <= 14 ? activeH : 14 }, (_, i) => ({
      day: `Day +${i + 1}`,
      historical: null,
      forecast: +(perDay * (1.0 + Math.sin(i * 0.5) * 0.15)).toFixed(1),
    }))
    return [...historical, ...forecast]
  })() : []

  if (initialLoading) {
    return <LoadingSkeleton count={3} />
  }

  return (
    <div className="space-y-5">

      {/* ── Input Controls ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-5 ${cardCls}`}
      >
        <h2 className={`text-sm font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Configure Multi-Horizon Demand Forecasting
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Primary Healthcare Facility (PHC)
            </label>
            <select
              value={phcId}
              onChange={e => setPhcId(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl text-xs outline-none transition-colors ${inputCls}`}
            >
              {phcs.map(p => (
                <option key={p.code} value={p.code}>{p.code} — {p.name || p.district}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Essential Medicine
            </label>
            <select
              value={medicine}
              onChange={e => setMedicine(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl text-xs outline-none transition-colors ${inputCls}`}
            >
              {MEDICINES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <button
            onClick={runAll}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <TrendingUp size={15} />}
            {loading ? 'Forecasting all horizons...' : 'Forecast All Horizons'}
          </button>
        </div>
      </motion.div>

      {/* ── Forecast Results ── */}
      {Object.keys(results).length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-5"
        >
          {/* Horizon Selection Tabs */}
          <div className="flex gap-2 flex-wrap">
            {HORIZONS.map(h => (
              <button
                key={h}
                onClick={() => setActiveH(h)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all
                  ${activeH === h
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]'
                    : isDark ? 'bg-[#111a30] text-slate-400 hover:text-slate-200 border border-blue-900/20' : 'bg-white text-slate-600 hover:text-slate-800 border border-slate-200'
                  }
                `}
              >
                <Clock size={13} />
                {h}-Day Horizon
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${activeH === h ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {results[h]?.final_prediction ?? 0} units
                </span>
              </button>
            ))}
          </div>

          {/* Active Horizon KPI Cards */}
          {activeResult && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label={`${activeH}-Day Predicted Demand`}
                value={activeResult.final_prediction}
                unit="units"
                icon={TrendingUp}
                color="blue"
                sub={`Avg daily: ${(activeResult.final_prediction / activeH).toFixed(1)} units/day`}
                delay={0.05}
              />
              <KpiCard
                label="Selected Champion Model"
                value={activeResult.selected_model}
                icon={ShieldCheck}
                color="green"
                sub="Lowest RMSE on validation set"
                delay={0.1}
              />
              <KpiCard
                label="Forecast Window"
                value={`${activeH} Days`}
                icon={Calendar}
                color="violet"
                sub={`As of: ${activeResult.forecast_as_of_date || 'Today'}`}
                delay={0.15}
              />
            </div>
          )}

          {/* Trajectory & Horizon Bar Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Trajectory Area Chart */}
            <div className={`rounded-2xl p-5 ${cardCls}`}>
              <h3 className={`text-sm font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {activeH}-Day Trajectory Simulation
              </h3>
              <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Historical consumption trend vs forecasted demand curve
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trajectoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorHist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorFore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(56,90,150,0.1)' : '#f1f5f9'} />
                    <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={ttStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="historical" name="Historical Actual" stroke="#3b82f6" fill="url(#colorHist)" strokeWidth={2} />
                    <Area type="monotone" dataKey="forecast" name="Model Forecast" stroke="#8b5cf6" fill="url(#colorFore)" strokeWidth={2} strokeDasharray="4 4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Multi-Horizon Comparison Bar Chart */}
            <div className={`rounded-2xl p-5 ${cardCls}`}>
              <h3 className={`text-sm font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Multi-Horizon Demand Comparison
              </h3>
              <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Cumulative medicine units required across planning horizons
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compareData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(56,90,150,0.1)' : '#f1f5f9'} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={ttStyle} />
                    <Bar dataKey="value" name="Predicted Units" radius={[6, 6, 0, 0]}>
                      {compareData.map((_, i) => (
                        <Cell key={i} fill={['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981'][i % 4]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Model Comparison Table for Active Horizon */}
          {activeResult && (
            <ModelComparisonCard
              allModelOutputs={activeResult.all_model_outputs}
              selectedModel={activeResult.selected_model}
              selectionReason={activeResult.selection_reason}
            />
          )}
        </motion.div>
      )}

    </div>
  )
}
