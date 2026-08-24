import { useState } from 'react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Zap, AlertTriangle, TrendingUp, Activity, Loader2, ArrowRight } from 'lucide-react'
import { useTheme } from '../components/ThemeContext.jsx'
import api from '../services/api.js'
import AnimatedCounter from '../components/AnimatedCounter.jsx'
import KpiCard from '../components/KpiCard.jsx'

const SCENARIOS = [
  { value: 'dengue_outbreak', label: 'Dengue Outbreak', icon: '🦟', desc: '1.8x patients, 2.2x medicine demand' },
  { value: 'flu_surge', label: 'Seasonal Flu Surge', icon: '🤧', desc: '1.4x patients, 1.3x demand' },
  { value: 'gi_outbreak', label: 'GI / Waterborne Outbreak', icon: '💧', desc: '1.6x patients, 2.0x demand' },
  { value: '', label: 'Custom Stress-Test', icon: '🎛️', desc: 'Configure manual sliders below' },
]

export default function EmergencySimulation() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [scenario, setScenario] = useState('dengue_outbreak')
  const [patientIncrease, setPatientIncrease] = useState(0)
  const [supplyDisruption, setSupplyDisruption] = useState(0)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const runSimulation = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await api.simulateEmergency({
        scenario: scenario || null,
        patient_increase_pct: Number(patientIncrease),
        supply_disruption_pct: Number(supplyDisruption),
      })
      setResult(res)
      toast.success('Simulation executed: stress-tested network against scenario parameters.')
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Simulation failed. Check backend logs.')
    } finally {
      setLoading(false)
    }
  }

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

  const chartData = result ? [
    {
      name: 'Average Network Risk',
      'Baseline (Before)': +(result.avg_risk_before * 100).toFixed(1),
      'Simulated (After)': +(result.avg_risk_after * 100).toFixed(1),
    },
    {
      name: 'Peak Facility Risk',
      'Baseline (Before)': +(result.max_risk_before * 100).toFixed(1),
      'Simulated (After)': +(result.max_risk_after * 100).toFixed(1),
    },
  ] : []

  return (
    <div className="space-y-5">

      {/* ── Scenario Selection ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-5 ${cardCls}`}
      >
        <h2 className={`text-sm font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Select Stress-Test Scenario
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {SCENARIOS.map(s => {
            const active = scenario === s.value
            return (
              <div
                key={s.value}
                onClick={() => setScenario(s.value)}
                className={`p-4 rounded-xl border cursor-pointer transition-all
                  ${active
                    ? 'bg-blue-600/10 border-blue-500 shadow-md shadow-blue-500/10 scale-[1.02]'
                    : isDark ? 'bg-slate-900/30 border-blue-900/10 hover:border-blue-900/30' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }
                `}
              >
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className={`text-xs font-bold ${active ? 'text-blue-400' : isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {s.label}
                </div>
                <div className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {s.desc}
                </div>
              </div>
            )
          })}
        </div>

        {/* Sliders for fine tuning */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mb-5">
          <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-900/40 border border-blue-900/10' : 'bg-slate-50 border border-slate-200'}`}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-400">Additional Patient Surge</span>
              <span className="font-bold text-blue-400">+{patientIncrease}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              step="10"
              value={patientIncrease}
              onChange={e => { setPatientIncrease(e.target.value); setScenario('') }}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>

          <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-900/40 border border-blue-900/10' : 'bg-slate-50 border border-slate-200'}`}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-400">Supply Chain Disruption</span>
              <span className="font-bold text-orange-400">-{supplyDisruption}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value={supplyDisruption}
              onChange={e => { setSupplyDisruption(e.target.value); setScenario('') }}
              className="w-full accent-orange-500 cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={runSimulation}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-red-500/20"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
          {loading ? 'Running simulation on champion models...' : 'Execute Emergency Simulation'}
        </button>
      </motion.div>

      {/* ── Simulation Results ── */}
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-5"
        >
          {/* Results KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`rounded-2xl p-5 border-l-4 border-amber-500 ${cardCls}`}>
              <div className={`text-xs font-semibold uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Average Network Risk
              </div>
              <div className="flex items-center gap-2 text-2xl font-extrabold">
                <span className="text-blue-400"><AnimatedCounter value={result.avg_risk_before * 100} decimals={1} suffix="%" /></span>
                <ArrowRight size={16} className="text-slate-500" />
                <span className="text-red-400"><AnimatedCounter value={result.avg_risk_after * 100} decimals={1} suffix="%" /></span>
              </div>
              <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Risk Delta: +{((result.avg_risk_after - result.avg_risk_before) * 100).toFixed(1)}%
              </div>
            </div>

            <KpiCard
              label="PHCs Newly Critical"
              value={result.phcs_newly_critical}
              unit="facilities"
              icon={AlertTriangle}
              color="red"
              sub="Crossed 80% stockout probability threshold"
              delay={0.1}
            />

            <KpiCard
              label="Peak Facility Risk"
              value={+(result.max_risk_after * 100).toFixed(1)}
              unit="%"
              icon={Activity}
              color="orange"
              sub={`Pre-simulation peak: ${(result.max_risk_before * 100).toFixed(1)}%`}
              delay={0.15}
            />
          </div>

          {/* Before vs After Impact Bar Chart */}
          <div className={`rounded-2xl p-5 ${cardCls}`}>
            <h3 className={`text-sm font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Scenario Impact Comparison
            </h3>
            <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Baseline metrics vs simulated shock response
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(56,90,150,0.1)' : '#f1f5f9'} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} unit="%" />
                  <Tooltip contentStyle={ttStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Baseline (Before)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Simulated (After)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Impacted Pairs Table */}
          <div className={`rounded-2xl p-5 ${cardCls}`}>
            <h3 className={`text-sm font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Top Impacted PHC-Medicine Pairs
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-blue-900/30 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                    <th className="text-left py-2.5 pr-4 font-semibold">PHC Code</th>
                    <th className="text-left py-2.5 pr-4 font-semibold">Medicine</th>
                    <th className="text-right py-2.5 pr-4 font-semibold">Risk Before</th>
                    <th className="text-right py-2.5 pr-4 font-semibold">Risk After</th>
                    <th className="text-right py-2.5 font-semibold">Net Risk Spike</th>
                  </tr>
                </thead>
                <tbody>
                  {result.top_impacted.map((r, i) => (
                    <tr
                      key={i}
                      className={`border-b transition-colors ${isDark ? 'border-blue-900/10 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50'}`}
                    >
                      <td className="py-2.5 pr-4 font-bold text-blue-400">{r.phc_id}</td>
                      <td className={`py-2.5 pr-4 font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{r.medicine}</td>
                      <td className="py-2.5 pr-4 text-right text-slate-400">{(r.risk_before * 100).toFixed(0)}%</td>
                      <td className={`py-2.5 pr-4 text-right font-bold ${r.risk_after > 0.7 ? 'text-red-400' : 'text-amber-400'}`}>
                        {(r.risk_after * 100).toFixed(0)}%
                      </td>
                      <td className="py-2.5 text-right font-extrabold text-red-400">
                        +{(r.risk_delta * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

    </div>
  )
}
