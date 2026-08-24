import { useState } from 'react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { RefreshCw, Package, Truck, ArrowRight, ShieldCheck, Clock, Loader2 } from 'lucide-react'
import { useTheme } from '../components/ThemeContext.jsx'
import api from '../services/api.js'
import KpiCard from '../components/KpiCard.jsx'

export default function ResourceRedistribution() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const runOptimization = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await api.optimizeRedistribution()
      setResult(res)
      toast.success(`Plan optimized: ${res.total_transfer_orders} transfer orders calculated.`)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Optimization failed. Check backend logs.')
    } finally {
      setLoading(false)
    }
  }

  const cardCls = isDark
    ? 'bg-[#111a30] border border-blue-900/20 shadow-sm'
    : 'bg-white border border-slate-200 shadow-sm'

  return (
    <div className="space-y-5">

      {/* ── Explanation & Trigger Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-5 ${cardCls}`}
      >
        <h2 className={`text-sm font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Constrained Linear Programming Redistribution Engine
        </h2>
        <p className={`text-xs max-w-3xl mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Solves an OR-Tools transportation LP problem across district boundaries: minimizes inter-facility transport costs while prioritizing recipients facing highest stockout probabilities. Batches close to expiry (First-Expiry-First-Out) are prioritized for immediate dispatch to eliminate medicine wastage.
        </p>

        <button
          onClick={runOptimization}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {loading ? 'Optimizing cross-district routes...' : 'Generate Redistribution Plan'}
        </button>
      </motion.div>

      {/* ── Optimization Results ── */}
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-5"
        >
          {/* Result KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Transfer Orders"
              value={result.total_transfer_orders}
              unit="routes"
              icon={Truck}
              color="blue"
              sub={`Computed as of ${result.as_of_date || 'Today'}`}
              delay={0.05}
            />
            <KpiCard
              label="Total Units Redistributed"
              value={result.total_units_redistributed}
              unit="units"
              icon={Package}
              color="violet"
              sub="Zero procurement cost"
              delay={0.1}
            />
            <KpiCard
              label="At-Risk PHCs Addressed"
              value={result.at_risk_phcs_addressed}
              unit="facilities"
              icon={ShieldCheck}
              color="green"
              sub="Critical deficit resolved"
              delay={0.15}
            />
          </div>

          {/* Transfer Orders Table */}
          <div className={`rounded-2xl p-5 ${cardCls}`}>
            <h3 className={`text-sm font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Recommended Cross-District Dispatch Orders
            </h3>

            {result.transfers.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                ✅ All facilities are adequately stocked. No cross-district transfers required at this time.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-blue-900/30 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                      <th className="text-left py-2.5 pr-4 font-semibold">Medicine</th>
                      <th className="text-left py-2.5 pr-4 font-semibold">Source Facility (Donor)</th>
                      <th className="text-center py-2.5 pr-4 font-semibold">Route</th>
                      <th className="text-left py-2.5 pr-4 font-semibold">Target Facility (Recipient)</th>
                      <th className="text-right py-2.5 pr-4 font-semibold">Quantity</th>
                      <th className="text-right py-2.5 pr-4 font-semibold">Distance</th>
                      <th className="text-right py-2.5 pr-4 font-semibold">Recipient Risk</th>
                      <th className="text-center py-2.5 font-semibold">FEFO Expiry Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.transfers.map((t, i) => (
                      <tr
                        key={i}
                        className={`border-b transition-colors ${isDark ? 'border-blue-900/10 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50'}`}
                      >
                        <td className="py-2.5 pr-4 font-bold text-blue-400">{t.medicine}</td>
                        <td className="py-2.5 pr-4">
                          <div className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t.from_phc}</div>
                          <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.from_district}</div>
                        </td>
                        <td className="py-2.5 pr-4 text-center text-blue-400 font-bold">
                          <ArrowRight size={14} className="inline" />
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t.to_phc}</div>
                          <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.to_district}</div>
                        </td>
                        <td className={`py-2.5 pr-4 text-right font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          {t.quantity} units
                        </td>
                        <td className="py-2.5 pr-4 text-right text-slate-400">{t.distance_km} km</td>
                        <td className="py-2.5 pr-4 text-right">
                          <span className={`badge ${t.recipient_risk_score > 0.7 ? 'CRITICAL' : t.recipient_risk_score > 0.5 ? 'HIGH' : 'MEDIUM'}`}>
                            {(t.recipient_risk_score * 100).toFixed(0)}% Risk
                          </span>
                        </td>
                        <td className="py-2.5 text-center">
                          {t.fefo_priority ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              <Clock size={10} /> Expiring Soon
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">Standard</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

    </div>
  )
}
