import axios from 'axios'

/**
 * Toujours passer par /api/* (Netlify Functions).
 * En local : @netlify/vite-plugin émule les functions.
 * On ignore volontairement un VITE_API_URL vers localhost.
 */
function resolveBaseUrl() {
  const raw = String(import.meta.env.VITE_API_URL || '').trim()
  if (!raw) return ''
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(raw)) return ''
  return raw.replace(/\/$/, '')
}

const api = axios.create({
  baseURL: resolveBaseUrl(),
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
  lookupNutrition: (name) =>
    api.post('/api/nutrition/lookup', { name }).then((r) => r.data),
  searchNutrition: (name, limit = 8) =>
    api.post('/api/nutrition/search', { name, limit }).then((r) => r.data),
  enrichNutrition: (force = false) =>
    api.post('/api/nutrition/enrich', { force }).then((r) => r.data),
  importIngredients: (items, enrich = true) =>
    api.post('/api/ingredients/import', { items, enrich }).then((r) => r.data),
}

export default api
