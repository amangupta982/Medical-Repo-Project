import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from './components/ThemeContext.jsx'
import api from './services/api'
import {
  LayoutDashboard, Map, AlertTriangle, TrendingUp, ShieldCheck,
  BarChart3, Zap, RefreshCw, Globe, Bell, Settings, LogOut,
  Sun, Moon, Activity, ChevronRight
} from 'lucide-react'

import Overview from './pages/Overview.jsx'
import PHCMapPage from './pages/PHCMapPage.jsx'
import StockoutRisk from './pages/StockoutRisk.jsx'
import DemandForecast from './pages/DemandForecast.jsx'
import EmergencySimulation from './pages/EmergencySimulation.jsx'
import ResourceRedistribution from './pages/ResourceRedistribution.jsx'
import DistrictResilience from './pages/DistrictResilience.jsx'
import ModelComparison from './pages/ModelComparison.jsx'
import FederatedLearning from './pages/FederatedLearning.jsx'
import Alerts from './pages/Alerts.jsx'

const NAV = [
  {
    section: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/map', label: 'PHC Map', icon: Map },
    ]
  },
  {
    section: 'Prediction & AI',
    items: [
      { to: '/stockout', label: 'Stockout Risk', icon: AlertTriangle },
      { to: '/demand', label: 'Demand Forecast', icon: TrendingUp },
      { to: '/resilience', label: 'Resilience Score', icon: ShieldCheck },
      { to: '/models', label: 'Model Comparison', icon: BarChart3 },
    ]
  },
  {
    section: 'Operations',
    items: [
      { to: '/emergency', label: 'Emergency Sim', icon: Zap },
      { to: '/redistribution', label: 'Redistribution', icon: RefreshCw },
    ]
  },
  {
    section: 'Advanced',
    items: [
      { to: '/federated', label: 'Federated Learning', icon: Globe },
      { to: '/alerts', label: 'System Alerts', icon: Bell },
    ]
  },
]

const PAGE_META = {
  '/': { title: 'National PHC Network Overview', sub: 'Real-time intelligence across the primary healthcare network' },
  '/map': { title: 'PHC Network Map', sub: 'Interactive geospatial distribution & facility readiness' },
  '/stockout': { title: 'Stockout Risk Prediction', sub: '7-day early warning — LightGBM champion with SHAP explanations' },
  '/demand': { title: 'Demand Forecasting', sub: 'Multi-horizon medicine demand — 1d / 7d / 14d / 30d models' },
  '/emergency': { title: 'Emergency / What-If Simulation', sub: 'Stress-test models against outbreak & supply-chain scenarios' },
  '/redistribution': { title: 'Cross-District Redistribution', sub: 'OR-Tools LP with FEFO expiry prioritization' },
  '/resilience': { title: 'District Resilience Score', sub: 'Composite 0–100 index across medicine, beds, staffing & readiness' },
  '/models': { title: 'Model Performance', sub: 'Evidence-based champion selection with walk-forward validation' },
  '/federated': { title: 'Federated Learning', sub: '5 BRICS national clients — Flower FedAvg aggregation' },
  '/alerts': { title: 'System Alerts', sub: 'Prediction alerts and real-time system notifications' },
}

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const meta = PAGE_META[location.pathname] || { title: 'BRICS Health Platform', sub: 'Command Center' }
  const [online, setOnline] = useState(true)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    let isMounted = true
    const check = async () => {
      try {
        const r = await api.checkHealth()
        if (isMounted) setOnline(r?.status === 'healthy')
      } catch {
        if (isMounted) setOnline(false)
      }
    }
    check()
    const iv = setInterval(() => {
      check()
      if (isMounted) setNow(new Date())
    }, 6000)
    return () => {
      isMounted = false
      clearInterval(iv)
    }
  }, [])

  const isDark = theme === 'dark'

  return (
    <div className={`flex min-h-screen ${isDark ? 'bg-[#0b1120] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>

      {/* ── Sidebar ── */}
      <aside className={`
        fixed top-0 left-0 h-screen z-50 flex flex-col
        w-[260px] overflow-hidden
        ${isDark
          ? 'bg-[#080e1e] border-r border-blue-900/20'
          : 'bg-white border-r border-slate-200'
        }
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-blue-900/10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent leading-tight">
              BRICS Health
            </div>
            <div className={`text-[10px] font-medium tracking-widest uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Resilience Platform
            </div>
          </div>
        </div>

        {/* Status pill */}
        <div className="px-5 py-3">
          <div className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium w-fit
            ${online
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }
          `}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${online ? 'bg-green-400' : 'bg-red-400'}`} />
            {online ? 'System Online' : 'Backend Offline'}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <div className={`px-3 mb-1.5 text-[10px] font-semibold tracking-widest uppercase ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {section}
              </div>
              {items.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-medium transition-all duration-150 group
                  ${isActive
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                    : isDark
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }
                `}>
                  <Icon size={15} className="shrink-0" />
                  <span className="flex-1">{label}</span>
                  <ChevronRight size={12} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={`px-5 py-4 border-t ${isDark ? 'border-blue-900/20' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white">
              AU
            </div>
            <div>
              <div className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Admin User</div>
              <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>System Administrator</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
              <Settings size={12} /> Settings
            </button>
            <button className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/5' : 'text-slate-500 hover:text-red-500 hover:bg-red-50'}`}>
              <LogOut size={12} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div className="ml-[260px] flex-1 flex flex-col min-h-screen">

        {/* Top Header */}
        <header className={`
          sticky top-0 z-40 flex items-center justify-between px-7 py-4
          border-b backdrop-blur-md
          ${isDark
            ? 'bg-[#0b1120]/90 border-blue-900/20'
            : 'bg-white/90 border-slate-200'
          }
        `}>
          <div>
            <h1 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {meta.title}
            </h1>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{meta.sub}</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Live badge */}
            <div className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide
              ${online
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }
            `}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${online ? 'bg-green-400' : 'bg-red-400'}`} />
              {online ? 'LIVE' : 'OFFLINE'}
            </div>

            {/* Timestamp */}
            <div className={`text-xs hidden lg:block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} IST
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }
              `}
            >
              {isDark ? <Sun size={13} className="text-amber-400" /> : <Moon size={13} className="text-blue-500" />}
              <span className="hidden sm:inline">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.18 }}
            >
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/map" element={<PHCMapPage />} />
                <Route path="/stockout" element={<StockoutRisk />} />
                <Route path="/demand" element={<DemandForecast />} />
                <Route path="/emergency" element={<EmergencySimulation />} />
                <Route path="/redistribution" element={<ResourceRedistribution />} />
                <Route path="/resilience" element={<DistrictResilience />} />
                <Route path="/models" element={<ModelComparison />} />
                <Route path="/federated" element={<FederatedLearning />} />
                <Route path="/alerts" element={<Alerts />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
