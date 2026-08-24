import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { useTheme } from '../components/ThemeContext.jsx'
import api from '../services/api.js'
import KpiCard from '../components/KpiCard.jsx'
import ModelComparisonCard from '../components/ModelComparisonCard.jsx'
import ExplanationDrivers from '../components/ExplanationDrivers.jsx'
import RiskGauge from '../components/RiskGauge.jsx'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'
import {
  AlertTriangle, Package, Clock, ShieldCheck,
  Search, Loader2, RefreshCw
} from 'lucide-react'

const MEDICINES = [
  'Paracetamol', 'ORS', 'Amoxicillin', 'Chloroquine/ACT',
  'Insulin', 'IV Fluids', 'Doxycycline', 'Iron Folic Acid'
]

const RISK_STYLE = {
  CRITICAL: 'bg-red-500/10 text-red-400 border border-red-500/20',
  HIGH:     'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  MEDIUM:   'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  LOW:      'bg-green-500/10 text-green-400 border border-green-500/20',
}

const DEFAULT_PHCS = [
  { code: 'BEN-PHC01', name: 'Bengaluru Rural Central PHC', district: 'Bengaluru Rural' },
  { code: 'BEN-PHC02', name: 'Devanahalli PHC', district: 'Bengaluru Rural' },
  { code: 'BEL-PHC01', name: 'Belagavi North PHC', district: 'Belagavi' },
  { code: 'KAL-PHC01', name: 'Kalaburagi Main PHC', district: 'Kalaburagi' },
  { code: 'MYS-PHC01', name: 'Mysuru City PHC', district: 'Mysuru' },
]

export default function StockoutRisk() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [phcs, setPhcs] = useState(DEFAULT_PHCS)
  const [phcId, setPhcId] = useState('BEN-PHC01')
  const [medicine, setMedicine] = useState(MEDICINES[0])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.getPHCs()
      .then(data => {
        if (data && data.length > 0) {
          setPhcs(data)
          if (!phcId) setPhcId(data[0].code)
        }
      })
      .catch(() => {})
  }, [])

  const runPrediction = async () => {
    if (!phcId) {
      toast.error('Please select a valid PHC facility.')
      return
    }
    setLoading(true)
    try {
      const res = await api.predictStockout({ phc_id: phcId, medicine })
      setResult(res)
      toast.success(`Risk evaluated: ${res.risk_level} (${(res.stockout_probability * 100).toFixed(1)}%)`)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Prediction failed. Please ensure the backend is running.')
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

  return (
    <div className="space-y-5">

      {/* ── Input Controls ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-5 ${cardCls}`}
      >
        <h2 className={`text-sm font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Run Stockout Risk Prediction
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
            onClick={runPrediction}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {loading ? 'Analyzing models...' : 'Predict Stockout Risk'}
          </button>
        </div>
      </motion.div>

      {/* ── Results Display ── */}
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-5"
        >
          {/* Top KPI & Gauge Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`md:col-span-2 rounded-2xl p-5 ${cardCls} flex flex-col items-center justify-center`}>
              <RiskGauge probability={result.stockout_probability} size={220} />
            </div>

            <KpiCard
              label="Current Inventory"
              value={result.current_stock}
              unit="units"
              icon={Package}
              color={result.current_stock < 50 ? 'red' : 'green'}
              sub="Stock level on hand"
              delay={0.1}
            />

            <KpiCard
              label="Days of Stock Remaining"
              value={result.expected_stockout_days ?? '—'}
              unit={result.expected_stockout_days ? 'days' : ''}
              icon={Clock}
              color={result.expected_stockout_days < 7 ? 'red' : result.expected_stockout_days < 14 ? 'orange' : 'green'}
              sub={`Demand/day: ${result.predicted_demand_per_day?.toFixed(1) || 0} units`}
              delay={0.15}
            />
          </div>

          {/* Risk Classification & Champion Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`rounded-2xl p-5 ${cardCls}`}>
              <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Risk Classification
              </div>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold ${RISK_STYLE[result.risk_level] || ''}`}>
                <AlertTriangle size={14} />
                {result.risk_level} LEVEL
              </div>
              <div className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {(result.stockout_probability * 100).toFixed(1)}% probability of reaching stockout within 7 days.
              </div>
            </div>

            <div className={`rounded-2xl p-5 ${cardCls}`}>
              <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Champion AI Model
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-green-400" />
                <span className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {result.selected_model}
                </span>
              </div>
              <div className={`text-xs mt-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Selected by highest PR-AUC on held-out time-based validation data.
              </div>
            </div>
          </div>

          {/* SHAP Drivers & Model Output Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ExplanationDrivers topDrivers={result.top_drivers} />
            <ModelComparisonCard
              allModelOutputs={result.all_model_outputs}
              selectedModel={result.selected_model}
              selectionReason={result.selection_reason}
            />
          </div>
        </motion.div>
      )}

    </div>
  )
}
