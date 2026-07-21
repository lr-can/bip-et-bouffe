import { defineStore } from 'pinia'
import { useSheetsStore } from '@/stores/sheets'
import { fuzzyMatch, toNumber } from '@/utils/recipe'
import { canonicalUnit, macrosForQuantity, sumMacros, isCatalogIngredient, costForQuantity } from '@/utils/nutrition'

export const useRecipesStore = defineStore('recipes', {
  getters: {
    all(state) {
      const sheets = useSheetsStore()
      return sheets.data.recettes || []
    },

    ingredientsMap() {
      const sheets = useSheetsStore()
      return Object.fromEntries((sheets.data.ingredients || []).map((i) => [i.idIngr, i]))
    },

    /** Catalogue utilisable pour les recettes (avec macros / catégorie). */
    catalogIngredients() {
      const sheets = useSheetsStore()
      return (sheets.data.ingredients || [])
        .filter((i) => isCatalogIngredient(i))
        .slice()
        .sort((a, b) =>
          String(a.nomIngr || '').localeCompare(String(b.nomIngr || ''), 'fr'),
        )
    },

    catalogByCategory() {
      const groups = new Map()
      for (const ing of this.catalogIngredients) {
        const cat = String(ing.categorie || '').trim() || 'Autres'
        if (!groups.has(cat)) groups.set(cat, [])
        groups.get(cat).push(ing)
      }
      return [...groups.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
        .map(([name, items]) => ({
          name,
          items: items.sort((a, b) =>
            String(a.nomIngr || '').localeCompare(String(b.nomIngr || ''), 'fr'),
          ),
        }))
    },

    categoryOptions() {
      return this.catalogByCategory.map((g) => g.name)
    },

    allergensMap() {
      const sheets = useSheetsStore()
      return Object.fromEntries(
        (sheets.data.allergenes || []).map((a) => [a.idAllergie, a]),
      )
    },

    allergenOptions() {
      const sheets = useSheetsStore()
      return (sheets.data.allergenes || [])
        .slice()
        .sort((a, b) =>
          String(a.nomAllergie || '').localeCompare(String(b.nomAllergie || ''), 'fr'),
        )
    },

    allergenName() {
      return (idAllergie) => {
        if (!idAllergie) return ''
        return this.allergensMap[idAllergie]?.nomAllergie || ''
      }
    },

    substitutions() {
      const sheets = useSheetsStore()
      return (sheets.data.substitutionsAllergenes || []).slice()
    },

    substitutionsByAllergen() {
      const grouped = new Map()
      for (const row of this.substitutions) {
        const key = String(row.idAllergie || '').trim()
        if (!key) continue
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key).push(row)
      }
      return grouped
    },

    ingredientSubstitutions() {
      return (ingredient, selectedAllergenIds = []) => {
        if (!ingredient || !selectedAllergenIds.length) return []
        const name = String(ingredient.nomIngr || '').toLowerCase()
        const rows = selectedAllergenIds.flatMap(
          (id) => this.substitutionsByAllergen.get(id) || [],
        )
        return rows.filter((row) => {
          const pattern = String(row.ingredientPattern || '').trim()
          if (!pattern) return false
          try {
            return new RegExp(pattern, 'i').test(name)
          } catch {
            return name.includes(pattern.toLowerCase())
          }
        })
      }
    },

    moods() {
      const set = new Set(
        this.all.map((r) => String(r.mood || '').trim()).filter(Boolean),
      )
      return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
    },

    byId() {
      return (id) => this.all.find((r) => r.idRecette === id) || null
    },

    enriched() {
      return (id, personnes = null) => {
        const sheets = useSheetsStore()
        const recipe = this.byId(id)
        if (!recipe) return null

        const nb = personnes ?? (toNumber(recipe.nbPerso, 2) || 2)
        const links = (sheets.data.ingredientsRecette || []).filter(
          (l) => l.idRecette === id,
        )
        const ingredients = links.map((link) => {
          const base = this.ingredientsMap[link.idIngr] || {
            idIngr: link.idIngr,
            nomIngr: link.idIngr,
            unite: '',
            prixUnitaire: 0,
            saison: '',
            idAllergie: '',
          }
          const qteParPersonne = toNumber(link.qteParPersonne, 0)
          const unite = canonicalUnit(link.unite || base.unite || 'g')
          const quantite = qteParPersonne * nb
          const nomAllergie = this.allergenName(base.idAllergie)
          const withUnit = { ...base, unite }
          // Macros / coût sur la quantité totale, puis dérivés par personne
          const macros = macrosForQuantity(withUnit, quantite)
          const macrosParPers = macrosForQuantity(withUnit, qteParPersonne)
          const cout = costForQuantity(base, quantite, unite)
          const coutParPers = costForQuantity(base, qteParPersonne, unite)
          return {
            ...base,
            unite,
            uniteCatalogue: canonicalUnit(base.unite || 'g'),
            nomAllergie,
            qteParPersonne,
            quantite,
            cout,
            coutParPers,
            macros,
            macrosParPers,
          }
        })

        const etapes = (sheets.data.etape || [])
          .filter((e) => e.idRecette === id)
          .slice()
          .sort((a, b) => toNumber(a.ordre, 0) - toNumber(b.ordre, 0))

        const cout = ingredients.reduce((sum, i) => sum + i.cout, 0)
        const coutParPers = Math.round((cout / nb) * 100) / 100
        // Macros par personne = somme des macros de chaque qteParPersonne
        // (évite toute ambiguïté avec le total / nb)
        const nutritionParPers = sumMacros(ingredients.map((i) => i.macrosParPers))
        const nutrition = sumMacros(ingredients.map((i) => i.macros))
        const fromIngredients = [
          ...new Set(ingredients.map((i) => i.nomAllergie).filter(Boolean)),
        ]
        const fromRecipe = String(recipe.allergie || '')
          .split(/[,;/|]+/)
          .map((s) => s.trim())
          .filter(Boolean)
        const allergiesDetectees = [...new Set([...fromRecipe, ...fromIngredients])]
        const allergieIdsDetectes = [
          ...new Set(
            ingredients
              .map((i) => i.idAllergie)
              .filter(Boolean),
          ),
        ]

        return {
          ...recipe,
          personnes: nb,
          ingredients,
          etapes,
          cout,
          coutParPers,
          nutrition,
          nutritionParPers,
          allergiesDetectees,
          allergieIdsDetectes,
        }
      }
    },

    search() {
      return ({ mood = '', ingredientId = '', query = '' } = {}) => {
        const sheets = useSheetsStore()
        let list = this.all.slice()

        if (mood) {
          list = list.filter((r) => normalizeEq(r.mood, mood))
        }

        if (ingredientId) {
          const ids = new Set(
            (sheets.data.ingredientsRecette || [])
              .filter((l) => l.idIngr === ingredientId)
              .map((l) => l.idRecette),
          )
          list = list.filter((r) => ids.has(r.idRecette))
        }

        if (query) {
          list = list.filter(
            (r) =>
              fuzzyMatch(r.nomRecette, query) ||
              fuzzyMatch(r.type, query) ||
              fuzzyMatch(r.mood, query) ||
              fuzzyMatch(r.allergie, query),
          )
        }

        return list
      }
    },

    byType() {
      return (type, { mood = '' } = {}) =>
        this.all.filter(
          (r) =>
            normalizeEq(r.type, type) && (!mood || normalizeEq(r.mood, mood)),
        )
    },

    suggestedIngredients() {
      return ({ type = '', mood = '', limit = 8 } = {}) => {
        const sheets = useSheetsStore()
        const relatedIds = new Set(
          this.all
            .filter(
              (r) =>
                (!type || normalizeEq(r.type, type)) &&
                (!mood || normalizeEq(r.mood, mood)),
            )
            .map((r) => r.idRecette),
        )
        const counts = new Map()
        for (const link of sheets.data.ingredientsRecette || []) {
          if (!relatedIds.has(link.idRecette)) continue
          counts.set(link.idIngr, (counts.get(link.idIngr) || 0) + 1)
        }
        return [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => this.ingredientsMap[id])
          .filter((ing) => ing && isCatalogIngredient(ing))
          .slice(0, limit)
      }
    },

    estimateCost() {
      return (recipeIds, personnes) => {
        return recipeIds.reduce((sum, id) => {
          const enriched = this.enriched(id, personnes)
          return sum + (enriched?.cout || 0)
        }, 0)
      }
    },
  },
})

function normalizeEq(a, b) {
  return String(a || '')
    .trim()
    .toLowerCase() === String(b || '').trim().toLowerCase()
}
