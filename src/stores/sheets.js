import { defineStore } from 'pinia'
import { sheetsApi } from '@/services/sheetsApi'

const SHEET_KEYS = ['recettes', 'ingredientsRecette', 'ingredients', 'allergenes', 'substitutionsAllergenes', 'etape']

export const useSheetsStore = defineStore('sheets', {
  state: () => ({
    meta: null,
    schema: null,
    data: {
      recettes: [],
      ingredientsRecette: [],
      ingredients: [],
      allergenes: [],
      substitutionsAllergenes: [],
      etape: [],
    },
    headers: {
      recettes: [],
      ingredientsRecette: [],
      ingredients: [],
      allergenes: [],
      substitutionsAllergenes: [],
      etape: [],
    },
    loading: false,
    saving: false,
    error: null,
    lastFetchedAt: null,
  }),

  getters: {
    sheetKeys: () => SHEET_KEYS,
    countBySheet: (state) =>
      Object.fromEntries(SHEET_KEYS.map((k) => [k, state.data[k]?.length || 0])),
  },

  actions: {
    async fetchMeta() {
      this.error = null
      try {
        this.meta = await sheetsApi.meta()
        this.schema = this.meta.schema
        return this.meta
      } catch (err) {
        this.error = err.response?.data?.error || err.message
        throw err
      }
    },

    async syncSchema() {
      this.error = null
      try {
        const result = await sheetsApi.syncSchema()
        this.schema = result.schema
        return result
      } catch (err) {
        this.error = err.response?.data?.error || err.message
        throw err
      }
    },

    async fetchSheet(sheetKey) {
      this.loading = true
      this.error = null
      try {
        const result = await sheetsApi.list(sheetKey)
        this.data[sheetKey] = result.rows
        this.headers[sheetKey] = result.headers
        this.lastFetchedAt = new Date().toISOString()
        return result
      } catch (err) {
        this.error = err.response?.data?.error || err.message
        throw err
      } finally {
        this.loading = false
      }
    },

    async fetchAll() {
      this.loading = true
      this.error = null
      try {
        await this.fetchMeta()
        await Promise.all(SHEET_KEYS.map((key) => this.fetchSheet(key)))
        this.lastFetchedAt = new Date().toISOString()
      } catch (err) {
        this.error = err.response?.data?.error || err.message
        throw err
      } finally {
        this.loading = false
      }
    },

    async ensureLoaded() {
      if (this.lastFetchedAt) return
      await this.fetchAll()
    },

    async addRow(sheetKey, payload) {
      this.saving = true
      this.error = null
      try {
        const result = await sheetsApi.create(sheetKey, payload)
        await this.fetchSheet(sheetKey)
        return result
      } catch (err) {
        this.error = err.response?.data?.error || err.message
        throw err
      } finally {
        this.saving = false
      }
    },

    async updateRow(sheetKey, rowNumber, payload) {
      this.saving = true
      this.error = null
      try {
        const result = await sheetsApi.update(sheetKey, rowNumber, payload)
        await this.fetchSheet(sheetKey)
        return result
      } catch (err) {
        this.error = err.response?.data?.error || err.message
        throw err
      } finally {
        this.saving = false
      }
    },

    async createRecipe(payload) {
      this.saving = true
      this.error = null
      try {
        const result = await sheetsApi.createRecipe(payload)
        await this.fetchAll()
        return result
      } catch (err) {
        this.error = err.response?.data?.error || err.message
        throw err
      } finally {
        this.saving = false
      }
    },

    async updateRecipe(id, payload) {
      this.saving = true
      this.error = null
      try {
        const result = await sheetsApi.updateRecipe(id, payload)
        await this.fetchAll()
        return result
      } catch (err) {
        this.error = err.response?.data?.error || err.message
        throw err
      } finally {
        this.saving = false
      }
    },

    async deleteRecipe(id) {
      this.saving = true
      this.error = null
      try {
        const result = await sheetsApi.deleteRecipe(id)
        await this.fetchAll()
        return result
      } catch (err) {
        this.error = err.response?.data?.error || err.message
        throw err
      } finally {
        this.saving = false
      }
    },
  },
})
