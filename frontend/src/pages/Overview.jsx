import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts'
import {
  Building2, MapPin, Users, Bed, ShieldCheck, AlertTriangle,
  ArrowUpRight, TrendingUp, Zap, RefreshCw, ChevronRight, Activity, Filter
} from 'lucide-react'
import api from '../services/api.js'
import { useTheme } from '../components/ThemeContext.jsx'
import KpiCard from '../components/KpiCard.jsx'
import AnimatedCounter from '../components/AnimatedCounter.jsx'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

const DEFAULT_DISTRICTS = [
  { rank: 1, district: 'Bengaluru Rural', score: 89.4, status: 'stable' },
  { rank: 2, district: 'Belagavi', score: 77.4, status: 'stable' },
  { rank: 3, district: 'Shivamogga', score: 75.2, status: 'stable' },
  { rank: 4, district: 'Mysuru', score: 73.8, status: 'stable' },
  { rank: 5, district: 'Tumakuru', score: 71.5, status: 'watch' },
]

const DEMAND_TREND_DATA = [
  { date: 'Mon', historical: 14.2, forecast: null },
  { date: 'Tue', historical: 16.8, forecast: null },
  { date: 'Wed', historical: 19.4, forecast: null },
  { date: 'Thu', historical: 22.1, forecast: 22.1 },
  { date: 'Fri', historical: null, forecast: 24.5 },
  { date: 'Sat', historical: null, forecast: 25.8 },
  { date: 'Sun', historical: null, forecast: 26.2 },
]

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899']

const DEFAULT_OVERVIEW_PHCS = [
  { code: 'BEN-PHC01', name: 'Bengaluru Rural Central PHC', district: 'Bengaluru Rural', total_beds: 12, sanctioned_doctors: 2, catchment_population: 32000, is_remote: false },
  { code: 'BEN-PHC02', name: 'Devanahalli PHC', district: 'Bengaluru Rural', total_beds: 10, sanctioned_doctors: 2, catchment_population: 28000, is_remote: false },
  { code: 'BEL-PHC01', name: 'Belagavi North PHC', district: 'Belagavi', total_beds: 15, sanctioned_doctors: 3, catchment_population: 45000, is_remote: false },
  { code: 'KAL-PHC01', name: 'Kalaburagi Main PHC', district: 'Kalaburagi', total_beds: 14, sanctioned_doctors: 2, catchment_population: 38000, is_remote: true },
  { code: 'MYS-PHC01', name: 'Mysuru City PHC', district: 'Mysuru', total_beds: 16, sanctioned_doctors: 3, catchment_population: 52000, is_remote: false },
]

export default function Overview() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [phcs, setPhcs] = useState(DEFAULT_OVERVIEW_PHCS)
  const [districts, setDistricts] = useState([])
  const [alerts, setAlerts] = useState([])
  const [resilience, setResilience] = useState([])
  const [overviewStats, setOverviewStats] = useState(null)

  // Global filters
  const [selectedDistrict, setSelectedDistrict] = useState('all')
  const [selectedType, setSelectedType] = useState('all')

  useEffect(() => {
    Promise.all([
      api.getPHCs().catch(() => []),
      api.getDistricts().catch(() => []),
      api.getAlerts().catch(() => []),
      api.getResilienceScores().catch(() => []),
      api.getStatsOverview().catch(() => null),
    ])
      .then(([p, d, a, r, stats]) => {
        if (p && p.length > 0) setPhcs(p)
        if (d && d.length > 0) setDistricts(d)
        if (a) setAlerts(a)
        if (r) setResilience(r)
        if (stats) setOverviewStats(stats)
      })
  }, [])

  const filteredPhcs = useMemo(() => {
    return phcs.filter(p => {
      if (selectedDistrict !== 'all' && p.district !== selectedDistrict) return false
      if (selectedType === 'remote' && !p.is_remote) return false
      if (selectedType === 'standard' && p.is_remote) return false
      return true
    })
  }, [phcs, selectedDistrict, selectedType])

  // Aggregate stats
  const totalFacilities = filteredPhcs.length || phcs.length || 60
  const remoteFacilities = filteredPhcs.filter(p => p.is_remote).length
  const totalBeds = filteredPhcs.reduce((acc, p) => acc + (p.total_beds || 0), 0)
  const totalDoctors = filteredPhcs.reduce((acc, p) => acc + (p.sanctioned_doctors || 0), 0)
  const totalPopulation = filteredPhcs.reduce((acc, p) => acc + (p.catchment_population || 0), 0)

  const avgResilienceScore = useMemo(() => {
    if (!resilience || resilience.length === 0) return 78.4
    const sum = resilience.reduce((acc, r) => acc + (r.resilience_score || 0), 0)
    return (sum / resilience.length).toFixed(1)
  }, [resilience])

  // District distribution chart data
  const districtDistribution = useMemo(() => {
    const counts = {}
    phcs.forEach(p => {
      counts[p.district] = (counts[p.district] || 0) + 1
    })
    return Object.entries(counts).map(([name, count]) => ({
      name: name.length > 12 ? name.slice(0, 12) + '…' : name,
      fullName: name,
      count,
    }))
  }, [phcs])

  // Facility remote split
  const facilitySplit = useMemo(() => [
    { name: 'Standard PHCs', value: totalFacilities - remoteFacilities },
    { name: 'Remote / Tribal PHCs', value: remoteFacilities },
  ], [totalFacilities, remoteFacilities])

  const cardCls = isDark
    ? 'bg-[#111a30] border border-blue-900/20 shadow-sm'
    : 'bg-white border border-slate-200 shadow-sm'

  const selectCls = isDark
    ? 'bg-[#0d1525] border border-blue-900/30 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-blue-500'
    : 'bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 outline-none focus:border-blue-500'

  const tooltipStyle = {
    background: isDark ? '#1e293b' : '#ffffff',
    border: `1px solid ${isDark ? 'rgba(56,90,150,0.3)' : '#e2e8f0'}`,
    borderRadius: 10,
    fontSize: 12,
    color: isDark ? '#f1f5f9' : '#0f172a',
  }

  return (
    <div className="space-y-6">

      {/* ── Filter Bar ── */}
      <div className={`p-4 rounded-2xl ${cardCls} flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-blue-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Network Filters</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <select
              value={selectedDistrict}
              onChange={e => setSelectedDistrict(e.target.value)}
              className={selectCls}
            >
              <option value="all">All Districts ({districts.length || 10})</option>
              {districts.map(d => (
                <option key={d.id || d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className={selectCls}
            >
              <option value="all">All Facility Types</option>
              <option value="standard">Standard Facilities</option>
              <option value="remote">Remote / Tribal Facilities</option>
            </select>
          </div>
          {(selectedDistrict !== 'all' || selectedType !== 'all') && (
            <button
              onClick={() => { setSelectedDistrict('all'); setSelectedType('all') }}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Primary KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Facilities"
          value={totalFacilities}
          unit="PHCs"
          icon={Building2}
          color="blue"
          sub={`${remoteFacilities} classified remote`}
          trend={5.2}
          trendLabel="+5.2% network coverage"
          delay={0.05}
        />
        <KpiCard
          label="Catchment Population"
          value={(totalPopulation || 2840000).toLocaleString()}
          unit="citizens"
          icon={Users}
          color="violet"
          sub="Primary care catchment"
          delay={0.1}
        />
        <KpiCard
          label="Total Inpatient Beds"
          value={totalBeds || 720}
          unit="beds"
          icon={Bed}
          color="green"
          sub={`${totalDoctors || 120} doctors sanctioned`}
          delay={0.15}
        />
        <KpiCard
          label="Avg Resilience Score"
          value={avgResilienceScore}
          unit="/100"
          icon={ShieldCheck}
          color="orange"
          sub="Across all operational districts"
          trend={2.4}
          trendLabel="+2.4 vs last quarter"
          delay={0.2}
        />
      </div>

      {/* ── Visual Analytics Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* District Distribution Bar Chart */}
        <div className={`lg:col-span-2 rounded-2xl p-5 ${cardCls}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Facilities by District
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Distribution of primary healthcare centers across operational zones
              </p>
            </div>
            <Link to="/map" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold">
              View Map <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={districtDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(56,90,150,0.1)' : '#f1f5f9'} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} angle={-25} textAnchor="end" />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {districtDistribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Remote Split Doughnut */}
        <div className={`rounded-2xl p-5 ${cardCls} flex flex-col justify-between`}>
          <div>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Facility Classification
            </h3>
            <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Standard vs Remote / Tribal accessibility
            </p>
            <div className="h-44 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={facilitySplit}
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#f97316" />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-700/20 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Standard Facilities
              </span>
              <span className="font-bold">{totalFacilities - remoteFacilities}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                Remote / Tribal
              </span>
              <span className="font-bold">{remoteFacilities}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Bottom Section: Active Alerts & Resilience Leaderboard ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Alerts Feed */}
        <div className={`lg:col-span-2 rounded-2xl p-5 ${cardCls}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={17} className="text-amber-400" />
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Recent System Alerts
              </h3>
            </div>
            <Link to="/alerts" className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
              All Alerts <ChevronRight size={13} />
            </Link>
          </div>

          {alerts.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No active alerts detected. Run a stockout prediction or simulation to trigger alerts.
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.slice(0, 4).map((a, i) => (
                <div
                  key={a.id || i}
                  className={`flex items-center justify-between p-3 rounded-xl text-xs transition-colors
                    ${isDark ? 'bg-slate-900/40 hover:bg-slate-900/80 border border-blue-900/10' : 'bg-slate-50 hover:bg-slate-100 border border-slate-100'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className={`badge ${a.severity}`}>{a.severity}</span>
                    <div>
                      <div className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        {a.message || a.alert_type}
                      </div>
                      <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {a.alert_type} • {a.created_at ? new Date(a.created_at).toLocaleTimeString() : 'Just now'}
                      </div>
                    </div>
                  </div>
                  <Link to="/stockout" className="text-blue-400 hover:text-blue-300 p-1.5 rounded-lg">
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resilience Top Districts */}
        <div className={`rounded-2xl p-5 ${cardCls} flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="text-green-400" />
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  District Resilience
                </h3>
              </div>
              <Link to="/resilience" className="text-xs text-blue-400 hover:text-blue-300 font-semibold">
                Explore
              </Link>
            </div>

            <div className="space-y-2.5">
              {(resilience.length > 0 ? resilience.slice(0, 5) : DEFAULT_DISTRICTS).map((d, i) => (
                <div key={d.district || i} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-amber-500/20 text-amber-400' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {i + 1}
                    </span>
                    <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {d.district}
                    </span>
                  </div>
                  <span className={`font-bold tabular-nums ${d.resilience_score >= 70 || d.score >= 70 ? 'text-green-400' : 'text-amber-400'}`}>
                    {d.resilience_score ?? d.score}/100
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/20">
            <Link
              to="/resilience"
              className="w-full py-2 px-3 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              Full Resilience Analysis <ChevronRight size={13} />
            </Link>
          </div>
        </div>

      </div>

      {/* ── Quick Action Shortcuts ── */}
      <div className={`p-5 rounded-2xl ${cardCls}`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Operational Workflows & AI Modules
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/stockout"
            className={`p-3.5 rounded-xl border flex flex-col items-center text-center gap-2 transition-all hover:scale-[1.02]
              ${isDark ? 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10 text-slate-200' : 'bg-blue-50/50 border-blue-200 hover:bg-blue-50 text-slate-800'}
            `}
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <AlertTriangle size={16} />
            </div>
            <div>
              <div className="text-xs font-bold">Predict Stockout</div>
              <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>7-day early warning</div>
            </div>
          </Link>

          <Link
            to="/demand"
            className={`p-3.5 rounded-xl border flex flex-col items-center text-center gap-2 transition-all hover:scale-[1.02]
              ${isDark ? 'bg-violet-500/5 border-violet-500/20 hover:bg-violet-500/10 text-slate-200' : 'bg-violet-50/50 border-violet-200 hover:bg-violet-50 text-slate-800'}
            `}
          >
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
            <div>
              <div className="text-xs font-bold">Demand Forecast</div>
              <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>1d/7d/14d/30d</div>
            </div>
          </Link>

          <Link
            to="/emergency"
            className={`p-3.5 rounded-xl border flex flex-col items-center text-center gap-2 transition-all hover:scale-[1.02]
              ${isDark ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 text-slate-200' : 'bg-red-50/50 border-red-200 hover:bg-red-50 text-slate-800'}
            `}
          >
            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
              <Zap size={16} />
            </div>
            <div>
              <div className="text-xs font-bold">Emergency Sim</div>
              <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Stress-test scenarios</div>
            </div>
          </Link>

          <Link
            to="/redistribution"
            className={`p-3.5 rounded-xl border flex flex-col items-center text-center gap-2 transition-all hover:scale-[1.02]
              ${isDark ? 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10 text-slate-200' : 'bg-green-50/50 border-green-200 hover:bg-green-50 text-slate-800'}
            `}
          >
            <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center">
              <RefreshCw size={16} />
            </div>
            <div>
              <div className="text-xs font-bold">Redistribution</div>
              <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>OR-Tools LP optimizer</div>
            </div>
          </Link>
        </div>
      </div>

    </div>
  )
}
