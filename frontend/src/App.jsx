import { Routes, Route, NavLink } from 'react-router-dom'
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
  { to: '/', label: 'Overview', icon: '📊', end: true },
  { to: '/map', label: 'PHC Map', icon: '🗺️' },
  { to: '/stockout', label: 'Stock-out Risk', icon: '⚠️' },
  { to: '/demand', label: 'Demand Forecasting', icon: '📈' },
  { to: '/emergency', label: 'Emergency Sim', icon: '🚨' },
  { to: '/redistribution', label: 'Redistribution', icon: '🔄' },
  { to: '/resilience', label: 'Resilience Score', icon: '🛡️' },
  { to: '/models', label: 'Model Comparison', icon: '🧪' },
  { to: '/federated', label: 'Federated Learning', icon: '🌐' },
  { to: '/alerts', label: 'System Alerts', icon: '🔔' },
]

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>
            <span className="brand-gradient">BRICS Health</span>
            <br />Resilience Platform
          </h1>
          <div className="subtitle">Command Center v1.0</div>
        </div>
        <div className="sidebar-status">
          <span className="status-dot" />
          <span>System Online</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          PREDICT → EXPLAIN → SIMULATE → OPTIMIZE → ACT
        </div>
      </aside>
      <main className="main">
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
