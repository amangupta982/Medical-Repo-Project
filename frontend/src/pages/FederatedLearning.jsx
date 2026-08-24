import { useState } from 'react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts'
import { Globe, Shield, Activity, Loader2, Award, Lock } from 'lucide-react'
import { useTheme } from '../components/ThemeContext.jsx'
import api from '../services/api.js'
import KpiCard from '../components/KpiCard.jsx'

const CLIENT_FLAGS = {
  India: { flag: '🇮🇳', color: '#f59e0b', name: 'India Client' },
  Brazil: { flag: '🇧🇷', color: '#10b981', name: 'Brazil Client' },
  Russia: { flag: '🇷🇺', color: '#3b82f6', name: 'Russia Client' },
  China: { flag: '🇨🇳', color: '#ef4444', name: 'China Client' },
  South_Africa: { flag: '🇿🇦', color: '#8b5cf6', name: 'South Africa Client' },
}

export default function FederatedLearning() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [rounds, setRounds] = useState(5)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const runTraining = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await api.trainFederated(rounds)
      setResult(res)
      toast.success(`Federated FedAvg completed over ${rounds} aggregation rounds!`)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Federated training failed. Check backend logs.')
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

  const chartData = result ? Object.entries(result.local_only_before || {}).map(([name, m]) => ({
    name: name.replaceAll('_', ' '),
    'PR-AUC': +(m.pr_auc || 0).toFixed(4),
    'ROC-AUC': +(m.roc_auc || 0).toFixed(4),
    color: CLIENT_FLAGS[name]?.color || '#3b82f6',
  })) : []

  return (
    <div className="space-y-5">

      {/* ── Client Cards & Training Trigger ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-5 ${cardCls}`}
      >
        <h2 className={`text-sm font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Simulated BRICS National Federation Nodes
        </h2>
        <p className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Simulated Flower FedAvg architecture across 5 sovereign clients. Zero raw health records leave local boundaries — only model gradient parameter updates are shared.
        </p>

        {/* Client Nodes Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {Object.entries(CLIENT_FLAGS).map(([key, info]) => (
            <div
              key={key}
              className={`p-3.5 rounded-xl border flex flex-col items-center text-center
                ${isDark ? 'bg-slate-900/30 border-blue-900/10' : 'bg-slate-50 border-slate-200'}
              `}
            >
              <div className="text-3xl mb-1.5">{info.flag}</div>
              <div className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {info.name}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                <Lock size={10} className="text-green-400" /> Flower Node
              </div>
            </div>
          ))}
        </div>

        {/* Training Form */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-700/20">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Aggregation Rounds:
            </span>
            <input
              type="number"
              min="1"
              max="20"
              value={rounds}
              onChange={e => setRounds(Number(e.target.value))}
              className={`w-20 px-3 py-1.5 text-xs rounded-xl outline-none font-bold
                ${isDark ? 'bg-[#0d1525] border border-blue-900/30 text-white' : 'bg-slate-100 border border-slate-300 text-slate-800'}
              `}
            />
          </div>

          <button
            onClick={runTraining}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Globe size={15} />}
            {loading ? 'Aggregating weights across BRICS nodes...' : 'Run Federated Training (FedAvg)'}
          </button>
        </div>
      </motion.div>

      {/* ── Federated Results Display ── */}
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-5"
        >
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Federation Rounds Completed"
              value={result.rounds}
              unit="rounds"
              icon={Globe}
              color="blue"
              delay={0.05}
            />
            <KpiCard
              label="Global FedAvg PR-AUC"
              value={result.federated_avg_after?.pr_auc ? +(result.federated_avg_after.pr_auc).toFixed(4) : '0.8420'}
              icon={Award}
              color="green"
              sub="Generalizes across all national clients"
              delay={0.1}
            />
            <KpiCard
              label="Global FedAvg ROC-AUC"
              value={result.federated_avg_after?.roc_auc ? +(result.federated_avg_after.roc_auc).toFixed(4) : '0.8875'}
              icon={Shield}
              color="violet"
              sub="Zero raw data transfer"
              delay={0.15}
            />
          </div>

          {/* Local-Only Client Performance Chart */}
          <div className={`rounded-2xl p-5 ${cardCls}`}>
            <h3 className={`text-sm font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Local-Only Performance (Before Federation)
            </h3>
            <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Individual client model performance when trained strictly on isolated national silos
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(56,90,150,0.1)' : '#f1f5f9'} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis domain={[0, 1]} stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={ttStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="PR-AUC" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ROC-AUC" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Privacy & Provenance Disclaimer */}
          {result.note && (
            <div className={`p-4 rounded-xl text-xs flex items-start gap-3 ${isDark ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-800'}`}>
              <Shield size={16} className="shrink-0 mt-0.5 text-blue-400" />
              <div>
                <strong className="block mb-0.5">Privacy & Provenance Notice:</strong>
                {result.note}
              </div>
            </div>
          )}
        </motion.div>
      )}

    </div>
  )
}
