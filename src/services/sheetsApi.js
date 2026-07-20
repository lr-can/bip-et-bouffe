import axios from 'axios'

// Même origine en prod (Netlify Functions sur /api/*).
// En local, @netlify/vite-plugin expose aussi /api/* — VITE_API_URL optionnel.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
})

export const sheetsApi = {
  health: () => api.get('/api/health').then((r) => r.data),
  meta: () => api.get('/api/meta').then((r) => r.data),
  syncSchema: () => api.post('/api/schema/sync').then((r) => r.data),
  list: (sheetKey) => api.get(`/api/sheets/${sheetKey}`).then((r) => r.data),
  create: (sheetKey, payload) =>
    api.post(`/api/sheets/${sheetKey}`, payload).then((r) => r.data),
  update: (sheetKey, row, payload) =>
    api.put(`/api/sheets/${sheetKey}/${row}`, payload).then((r) => r.data),
  createRecipe: (payload) => api.post('/api/recipes', payload).then((r) => r.data),
  updateRecipe: (id, payload) => api.put(`/api/recipes/${id}`, payload).then((r) => r.data),
  deleteRecipe: (id) => api.delete(`/api/recipes/${id}`).then((r) => r.data),
}

export default api
