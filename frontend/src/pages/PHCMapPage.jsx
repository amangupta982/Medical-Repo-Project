import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, Search, Filter, AlertTriangle, Users, Bed, Stethoscope, MapPin } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import api from '../services/api.js'
import { useTheme } from '../components/ThemeContext.jsx'
import KpiCard from '../components/KpiCard.jsx'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

// Component to dynamically adjust map center when filtered
function ChangeView({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, zoom)
  }, [center, zoom, map])
  return null
}

export default function PHCMapPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [phcs, setPhcs] = useState([])
  const [districts, setDistricts] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedDistrict, setSelectedDistrict] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPhc, setSelectedPhc] = useState(null)

  useEffect(() => {
    Promise.all([
      api.getPHCs().catch(() => []),
      api.getDistricts().catch(() => []),
    ])
      .then(([p, d]) => {
        setPhcs(p || [])
        setDistricts(d || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredPhcs = useMemo(() => {
    return phcs.filter(p => {
      if (selectedDistrict !== 'all' && p.district !== selectedDistrict) return false
      if (selectedType === 'remote' && !p.is_remote) return false
      if (selectedType === 'standard' && p.is_remote) return false
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchCode = p.code?.toLowerCase().includes(term)
        const matchName = p.name?.toLowerCase().includes(term)
        const matchDist = p.district?.toLowerCase().includes(term)
        if (!matchCode && !matchName && !matchDist) return false
      }
      return true
    })
  }, [phcs, selectedDistrict, selectedType, searchTerm])

  const remoteCount = useMemo(() => filteredPhcs.filter(p => p.is_remote).length, [filteredPhcs])
  const standardCount = useMemo(() => filteredPhcs.length - remoteCount, [filteredPhcs, remoteCount])
  const totalBeds = useMemo(() => filteredPhcs.reduce((a, b) => a + (b.total_beds || 0), 0), [filteredPhcs])

  // Center point calculation
  const mapCenter = useMemo(() => {
    if (filteredPhcs.length === 0) return [14.5, 76.2] // Karnataka default
    const valid = filteredPhcs.filter(p => p.lat && p.lon)
    if (valid.length === 0) return [14.5, 76.2]
    const latSum = valid.reduce((a, b) => a + b.lat, 0)
    const lonSum = valid.reduce((a, b) => a + b.lon, 0)
    return [latSum / valid.length, lonSum / valid.length]
  }, [filteredPhcs])

  const mapZoom = selectedDistrict !== 'all' ? 9 : 7

  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

  const cardCls = isDark
    ? 'bg-[#111a30] border border-blue-900/20 shadow-sm'
    : 'bg-white border border-slate-200 shadow-sm'

  const inputCls = isDark
    ? 'bg-[#0d1525] border border-blue-900/30 text-slate-200 focus:border-blue-500'
    : 'bg-slate-50 border border-slate-200 text-slate-800 focus:border-blue-400'

  if (loading) {
    return (
      <div className="space-y-5">
        <LoadingSkeleton type="stats" />
        <div className="h-96 rounded-2xl bg-slate-800 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Visible Facilities"
          value={filteredPhcs.length}
          unit="PHCs"
          icon={Building2}
          color="blue"
          delay={0.05}
        />
        <KpiCard
          label="Standard Facilities"
          value={standardCount}
          unit="PHCs"
          icon={MapPin}
          color="green"
          delay={0.1}
        />
        <KpiCard
          label="Remote / Tribal"
          value={remoteCount}
          unit="PHCs"
          icon={AlertTriangle}
          color="orange"
          delay={0.15}
        />
        <KpiCard
          label="Total Inpatient Beds"
          value={totalBeds}
          unit="beds"
          icon={Bed}
          color="violet"
          delay={0.2}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className={`rounded-2xl p-4 ${cardCls} flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search PHC code, name, or district..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl outline-none transition-colors ${inputCls}`}
            />
          </div>

          {/* District Selector */}
          <div className="min-w-[150px]">
            <select
              value={selectedDistrict}
              onChange={e => setSelectedDistrict(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-xl outline-none transition-colors ${inputCls}`}
            >
              <option value="all">All Districts ({districts.length || 10})</option>
              {districts.map(d => (
                <option key={d.id || d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Type Selector */}
          <div className="min-w-[140px]">
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-xl outline-none transition-colors ${inputCls}`}
            >
              <option value="all">All Types</option>
              <option value="standard">Standard Facilities</option>
              <option value="remote">Remote / Tribal</option>
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block shadow-sm shadow-blue-500/50" />
            <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Standard PHC</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500 inline-block shadow-sm shadow-orange-500/50" />
            <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Remote / Tribal</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className={`rounded-2xl p-2 ${cardCls} overflow-hidden shadow-lg h-[540px] relative`}>
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', borderRadius: '14px' }}
        >
          <ChangeView center={mapCenter} zoom={mapZoom} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url={tileUrl}
          />
          {filteredPhcs.map(p => {
            if (!p.lat || !p.lon) return null
            const isRemote = p.is_remote
            return (
              <CircleMarker
                key={p.code}
                center={[p.lat, p.lon]}
                radius={isRemote ? 7 : 6}
                pathOptions={{
                  color: isRemote ? '#ea580c' : '#2563eb',
                  fillColor: isRemote ? '#f97316' : '#3b82f6',
                  fillOpacity: 0.85,
                  weight: 2,
                }}
                eventHandlers={{
                  click: () => setSelectedPhc(p),
                }}
              >
                <Popup>
                  <div className="p-1 space-y-2 min-w-[200px] text-xs">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-700/20 pb-1.5">
                      <div>
                        <div className="font-bold text-sm text-blue-400">{p.code}</div>
                        <div className="font-medium text-slate-200">{p.name || `PHC ${p.code}`}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isRemote ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {isRemote ? 'Remote' : 'Standard'}
                      </span>
                    </div>

                    <div className="space-y-1 text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">District:</span>
                        <span className="font-semibold">{p.district}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Beds:</span>
                        <span className="font-semibold">{p.total_beds || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sanctioned Doctors:</span>
                        <span className="font-semibold">{p.sanctioned_doctors || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sanctioned Nurses:</span>
                        <span className="font-semibold">{p.sanctioned_nurses || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Catchment Pop:</span>
                        <span className="font-semibold">{(p.catchment_population || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-700/20">
                      <Link
                        to={`/stockout`}
                        className="w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-center block font-semibold transition-colors shadow-sm"
                      >
                        Predict Stockout Risk
                      </Link>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

    </div>
  )
}
