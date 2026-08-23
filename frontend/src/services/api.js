<<<<<<< HEAD
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const client = axios.create({ baseURL: API_BASE, timeout: 60000 })

export const api = {
  getPHCs: () => client.get('/api/phcs').then(r => r.data),
  getDistricts: () => client.get('/api/districts').then(r => r.data),
  getInventory: (params) => client.get('/api/inventory', { params }).then(r => r.data),
  getAlerts: () => client.get('/api/alerts').then(r => r.data),

  checkHealth: () => client.get('/health', { timeout: 4000 }).then(r => r.data),
  predictDemand: (payload) => client.post('/api/predict/demand', payload).then(r => r.data),
  predictStockout: (payload) => client.post('/api/predict/stockout', payload).then(r => r.data),

  simulateEmergency: (payload) => client.post('/api/emergency/simulate', payload).then(r => r.data),
  optimizeRedistribution: () => client.post('/api/optimize/redistribution').then(r => r.data),
  getResilienceScores: () => client.get('/api/resilience-score').then(r => r.data),
  getModelPerformance: (task) => client.get('/api/models/performance', { params: { task } }).then(r => r.data),
  getExplanation: (predictionId) => client.get(`/api/explainability/${predictionId}`).then(r => r.data),
  trainFederated: (rounds = 5) => client.post('/api/federated/train', { rounds }).then(r => r.data),
}

export default api
=======
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const client = axios.create({ baseURL: API_BASE, timeout: 60000 })

export const api = {
  getPHCs: () => client.get('/api/phcs').then(r => r.data),
  getDistricts: () => client.get('/api/districts').then(r => r.data),
  getInventory: (params) => client.get('/api/inventory', { params }).then(r => r.data),
  getAlerts: () => client.get('/api/alerts').then(r => r.data),

  checkHealth: () => client.get('/health', { timeout: 4000 }).then(r => r.data),
  predictDemand: (payload) => client.post('/api/predict/demand', payload).then(r => r.data),
  predictStockout: (payload) => client.post('/api/predict/stockout', payload).then(r => r.data),

  simulateEmergency: (payload) => client.post('/api/emergency/simulate', payload).then(r => r.data),
  optimizeRedistribution: () => client.post('/api/optimize/redistribution').then(r => r.data),
  getResilienceScores: () => client.get('/api/resilience-score').then(r => r.data),
  getModelPerformance: (task) => client.get('/api/models/performance', { params: { task } }).then(r => r.data),
  getExplanation: (predictionId) => client.get(`/api/explainability/${predictionId}`).then(r => r.data),
  trainFederated: (rounds = 5) => client.post('/api/federated/train', { rounds }).then(r => r.data),
}

export default api
>>>>>>> origin/main
