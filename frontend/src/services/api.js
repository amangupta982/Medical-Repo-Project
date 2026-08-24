import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const client = axios.create({ baseURL: API_BASE, timeout: 10000 })

// In-memory cache for static and semi-static data
const cache = new Map()

function cachedGet(url, params = null, ttlMs = 60000) {
  const key = `${url}:${JSON.stringify(params)}`
  const now = Date.now()
  if (cache.has(key)) {
    const item = cache.get(key)
    if (now - item.timestamp < ttlMs) {
      return Promise.resolve(item.data)
    }
  }
  return client.get(url, { params }).then(r => {
    cache.set(key, { data: r.data, timestamp: now })
    return r.data
  })
}

export const api = {
  // Cached endpoints for instant page switches
  getPHCs: () => cachedGet('/api/phcs', null, 300000), // 5 min cache
  getDistricts: () => cachedGet('/api/districts', null, 300000),
  getStatsOverview: () => cachedGet('/api/stats/overview', null, 30000), // 30s cache
  getResilienceScores: () => cachedGet('/api/resilience-score', null, 60000),
  getModelPerformance: (task) => cachedGet('/api/models/performance', task ? { task } : {}, 120000),

  // Live endpoints
  getInventory: (params) => client.get('/api/inventory', { params }).then(r => r.data),
  getAlerts: (params) => cachedGet('/api/alerts', params, 10000), // 10s cache
  checkHealth: () => client.get('/health', { timeout: 3000 }).then(r => r.data),

  // Mutation / AI Execution Endpoints
  predictDemand: (payload) => client.post('/api/predict/demand', payload).then(r => r.data),
  predictStockout: (payload) => client.post('/api/predict/stockout', payload).then(r => r.data),
  simulateEmergency: (payload) => client.post('/api/emergency/simulate', payload).then(r => r.data),
  optimizeRedistribution: () => client.post('/api/optimize/redistribution').then(r => r.data),
  getExplanation: (predictionId) => client.get(`/api/explainability/${predictionId}`).then(r => r.data),
  trainFederated: (rounds = 5) => client.post('/api/federated/train', { rounds }).then(r => r.data),

  // Clear cache helper
  invalidateCache: () => cache.clear(),
}

export default api
