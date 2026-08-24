import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bell, Search, AlertTriangle, ShieldCheck, Clock, CheckCircle } from 'lucide-react'
import { useTheme } from '../components/ThemeContext.jsx'
import api from '../services/api.js'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

export default function Alerts() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    api.getAlerts()
      .then(data => setAlerts(data || []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (filter !== 'ALL' && a.severity !== filter) return false
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchMsg = a.message?.toLowerCase().includes(term)
        const matchType = a.alert_type?.toLowerCase().includes(term)
        if (!matchMsg && !matchType) return false
      }
      return true
    })
  }, [alerts, filter, searchTerm])

  const counts = useMemo(() => ({
    ALL: alerts.length,
    CRITICAL: alerts.filter(a => a.severity === 'CRITICAL').length,
    HIGH: alerts.filter(a => a.severity === 'HIGH').length,
    MEDIUM: alerts.filter(a => a.severity === 'MEDIUM').length,
    LOW: alerts.filter(a => a.severity === 'LOW').length,
  }), [alerts])

  const cardCls = isDark
    ? 'bg-[#111a30] border border-blue-900/20 shadow-sm'
    : 'bg-white border border-slate-200 shadow-sm'

  const inputCls = isDark
    ? 'bg-[#0d1525] border border-blue-900/30 text-slate-200 focus:border-blue-500'
    : 'bg-slate-50 border border-slate-200 text-slate-800 focus:border-blue-400'

  if (loading) return <LoadingSkeleton type="table" />

  return (
    <div className="space-y-5">

      {/* ── Filter Bar & Search ── */}
      <div className={`rounded-2xl p-4 ${cardCls} flex flex-wrap items-center justify-between gap-4`}>
        {/* Severity Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(level => {
            const active = filter === level
            return (
              <button
                key={level}
                onClick={() => setFilter(level)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all
                  ${active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : isDark ? 'bg-slate-800/60 text-slate-400 hover:text-slate-200' : 'bg-slate-100 text-slate-600 hover:text-slate-800'
                  }
                `}
              >
                {level} ({counts[level] || 0})
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search alerts..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl outline-none transition-colors ${inputCls}`}
          >
          </input>
        </div>
      </div>

      {/* ── Alerts Table / Feed ── */}
      <div className={`rounded-2xl p-5 ${cardCls}`}>
        {filtered.length === 0 ? (
          <div className="text-center py-14">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-3">
              <Bell size={22} />
            </div>
            <div className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              No alerts found
            </div>
            <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {filter !== 'ALL'
                ? `There are currently no alerts with severity level ${filter}.`
                : 'Run stockout predictions or emergency simulations to generate alerts.'
              }
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className={`border-b ${isDark ? 'border-blue-900/30 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  <th className="text-left py-2.5 pr-4 font-semibold">Severity</th>
                  <th className="text-left py-2.5 pr-4 font-semibold">Alert Type</th>
                  <th className="text-left py-2.5 pr-4 font-semibold">Event Message</th>
                  <th className="text-right py-2.5 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr
                    key={a.id}
                    className={`border-b transition-colors ${isDark ? 'border-blue-900/10 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50'}`}
                  >
                    <td className="py-2.5 pr-4">
                      <span className={`badge ${a.severity}`}>{a.severity}</span>
                    </td>
                    <td className={`py-2.5 pr-4 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {a.alert_type}
                    </td>
                    <td className={`py-2.5 pr-4 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {a.message}
                    </td>
                    <td className="py-2.5 text-right text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {a.created_at ? new Date(a.created_at).toLocaleString() : 'Just now'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
