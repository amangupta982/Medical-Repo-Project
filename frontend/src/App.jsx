import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { useTheme } from './components/ThemeContext.jsx'
import api from './services/api'
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

/* ─── SVG Icons ─── */
const OverviewIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
)
const MapIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/></svg>
)
const StockoutIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
)
const DemandIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
)
const ResilienceIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
)
const ModelIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>
)
const EmergencyIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
)
const RedistIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
)
const FederatedIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
)
const AlertIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
)
const SettingsIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
)
const LogoutIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
)
const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" fill="#f59e0b" fillOpacity="0.25" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

/* ─── Route to Title Mapping ─── */
const PAGE_TITLES = {
  '/': { title: 'National PHC Network Overview', subtitle: 'Real-time intelligence across the primary healthcare network' },
  '/map': { title: 'National PHC Map', subtitle: 'India • 29,842 facilities across 778 districts' },
  '/stockout': { title: 'Stock-out Risk Prediction', subtitle: '7-day advance warning — XGBoost vs LightGBM with SHAP explanations' },
  '/demand': { title: 'Demand Forecasting', subtitle: 'Multi-horizon medicine demand prediction' },
  '/emergency': { title: 'Emergency / What-If Simulation', subtitle: 'Stress-test the current model against outbreak and supply-chain scenarios' },
  '/redistribution': { title: 'Cross-District Resource Redistribution', subtitle: 'OR-Tools transportation LP with FEFO expiry prioritization' },
  '/resilience': { title: 'District Resilience Score', subtitle: 'Composite 0–100 index across medicine, beds, staffing, and emergency readiness' },
  '/models': { title: 'Model Performance — Full Comparison', subtitle: 'Evidence-based model selection with time-based validation metrics' },
  '/federated': { title: 'Cross-Border Federated Learning', subtitle: '5 BRICS national clients — Flower FedAvg' },
  '/alerts': { title: 'System Alerts', subtitle: 'All alerts from predictions and simulations' },
}

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'BRICS Health Resilience Platform', subtitle: 'Command Center v1.0' }
  const [isBackendConnected, setIsBackendConnected] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(() => {
    const d = new Date()
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' +
           d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST'
  })

  useEffect(() => {
    let isMounted = true

    const checkStatus = async () => {
      try {
        const res = await api.checkHealth()
        if (isMounted) {
          if (res && res.status === 'healthy') {
            setIsBackendConnected(true)
            const d = new Date()
            setLastUpdated(
              d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' +
              d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST'
            )
          } else {
            setIsBackendConnected(false)
          }
        }
      } catch (err) {
        if (isMounted) {
          setIsBackendConnected(false)
        }
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 6000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div className="sidebar-header-text">
            <h1>
              <span className="brand-gradient">BRICS Health</span>
              <br />Resilience Platform
            </h1>
            <div className="subtitle">COMMAND CENTER V1.0</div>
          </div>
        </div>

        <div className={`sidebar-status ${isBackendConnected ? 'status-online' : 'status-offline'}`}>
          <span className={`status-dot ${isBackendConnected ? 'status-dot-online' : 'status-dot-offline'}`} />
          <span>{isBackendConnected ? 'System Online' : 'System Offline'}</span>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Overview</div>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon"><OverviewIcon /></span>
            <span className="nav-label">Overview</span>
          </NavLink>
          <NavLink to="/map" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon"><MapIcon /></span>
            <span className="nav-label">PHC Map</span>
          </NavLink>

          <div className="sidebar-section-label">Prediction & Analytics</div>
          <NavLink to="/stockout" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon"><StockoutIcon /></span>
            <span className="nav-label">Stock-out Risk</span>
          </NavLink>
          <NavLink to="/demand" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon"><DemandIcon /></span>
            <span className="nav-label">Demand Forecasting</span>
          </NavLink>
          <NavLink to="/resilience" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon"><ResilienceIcon /></span>
            <span className="nav-label">Resilience Score</span>
          </NavLink>
          <NavLink to="/models" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon"><ModelIcon /></span>
            <span className="nav-label">Model Comparison</span>
          </NavLink>

          <div className="sidebar-section-label">Operations</div>
          <NavLink to="/emergency" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon"><EmergencyIcon /></span>
            <span className="nav-label">Emergency Simulation</span>
          </NavLink>
          <NavLink to="/redistribution" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon"><RedistIcon /></span>
            <span className="nav-label">Redistribution</span>
          </NavLink>

          <div className="sidebar-section-label">Advanced</div>
          <NavLink to="/federated" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon"><FederatedIcon /></span>
            <span className="nav-label">Federated Learning</span>
          </NavLink>

          <div className="sidebar-section-label">System</div>
          <NavLink to="/alerts" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon"><AlertIcon /></span>
            <span className="nav-label">System Alerts</span>
          </NavLink>
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="sidebar-avatar">AU</div>
            <div className="sidebar-user-details">
              <div className="sidebar-user-name">Admin User</div>
              <div className="sidebar-user-role">System Administrator</div>
            </div>
          </div>
          <div className="sidebar-user-actions">
            <a href="#"><SettingsIcon /> Settings</a>
            <a href="#"><LogoutIcon /> Logout</a>
          </div>
        </div>
      </aside>

      <main className="main">
        {/* ─── Global Top Header (on Every Page) ─── */}
        <div className="top-header">
          <div className="top-header-left">
            <h2>{pageInfo.title}</h2>
            <div className="page-subtitle">{pageInfo.subtitle}</div>
          </div>

          <div className="top-header-right">
            <div
              className={`live-badge ${isBackendConnected ? 'live-online' : 'live-offline'}`}
              title={isBackendConnected ? 'Backend connected & running (http://localhost:8000)' : 'Backend disconnected / offline'}
            >
              <span className={`live-dot ${isBackendConnected ? 'live-dot-online' : 'live-dot-offline'}`} />
              {isBackendConnected ? 'LIVE' : 'OFFLINE'}
            </div>
            <div className="last-updated">
              Last updated: {lastUpdated}
            </div>
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? (
                <>
                  <MoonIcon />
                  <span className="theme-toggle-label">Dark Mode</span>
                </>
              ) : (
                <>
                  <SunIcon />
                  <span className="theme-toggle-label">Light Mode</span>
                </>
              )}
            </button>
          </div>
        </div>

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
      </main>
    </div>
  )
}
