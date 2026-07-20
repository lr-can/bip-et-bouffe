import { defineStore } from 'pinia'
import { useRecipesStore } from '@/stores/recipes'
import { useSheetsStore } from '@/stores/sheets'
import { MENU_CORE_TYPES, toNumber } from '@/utils/recipe'
import { buildShoppingList } from '@/composables/useShoppingList'

function emptyDay() {
  return {
    entree: null,
    plat: null,
    dessert: null,
    extras: [],
  }
}

function dayIds(day) {
  if (!day) return []
  return [day.entree, day.plat, day.dessert, ...(day.extras || [])].filter(Boolean)
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export const useMenuStore = defineStore('menu', {
  state: () => ({
    nbPersonnes: 4,
    nbJours: 3,
    mood: '',
    allergies: '',
    budgetParJour: null,
    activeDay: 0,
    days: [emptyDay(), emptyDay(), emptyDay()],
  }),

  getters: {
    currentDay(state) {
      return state.days[state.activeDay] || emptyDay()
    },

    allSelectedIds(state) {
      return state.days.flatMap((d) => dayIds(d))
    },

    dayRecipes() {
      return (dayIndex) => {
        const recipes = useRecipesStore()
        const day = this.days[dayIndex]
        if (!day) return []
        return dayIds(day)
          .map((id) => recipes.enriched(id, this.nbPersonnes))
          .filter(Boolean)
      }
    },

    selectedRecipes() {
      return this.days.flatMap((_, i) => this.dayRecipes(i))
    },

    dayCost() {
      return (dayIndex) =>
        this.dayRecipes(dayIndex).reduce((sum, r) => sum + (r.cout || 0), 0)
    },

    totalCost() {
      return this.days.reduce((sum, _, i) => sum + this.dayCost(i), 0)
    },

    shoppingList() {
      return buildShoppingList(this.selectedRecipes)
    },

    shoppingText() {
      const lines = [`Liste de courses — ${this.nbJours} jour(s) · ${this.nbPersonnes} pers.`]
      for (const item of this.shoppingList) {
        const qty = Number.isInteger(item.quantite)
          ? item.quantite
          : Number(item.quantite.toFixed(2))
        lines.push(`• ${item.nomIngr} — ${qty} ${item.unite || ''}`.trim())
      }
      return lines.join('\n')
    },

    planSummary() {
      return this.days.map((day, i) => ({
        index: i,
        label: `Jour ${i + 1}`,
        cost: this.dayCost(i),
        recipes: this.dayRecipes(i),
        filled: dayIds(day).length,
      }))
    },

    collectedAllergies() {
      const set = new Set()
      const recipes = useRecipesStore()
      for (const recipe of this.selectedRecipes) {
        String(recipe.allergie || '')
          .split(/[,;/|]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((a) => set.add(a))
        const enriched = recipes.enriched(recipe.idRecette)
        for (const name of enriched?.allergiesDetectees || []) {
          if (name) set.add(name)
        }
      }
      return [...set]
    },

    allergyTokens() {
      return String(this.allergies || '')
        .split(/[,;/|]+/)
        .map((s) => normalize(s))
        .filter(Boolean)
    },
  },

  actions: {
    setNbJours(n) {
      const count = Math.min(14, Math.max(1, Number(n) || 1))
      this.nbJours = count
      while (this.days.length < count) this.days.push(emptyDay())
      if (this.days.length > count) this.days = this.days.slice(0, count)
      if (this.activeDay >= count) this.activeDay = count - 1
    },

    setActiveDay(index) {
      if (index >= 0 && index < this.days.length) this.activeDay = index
    },

    setSlot(type, id, dayIndex = this.activeDay) {
      if (!MENU_CORE_TYPES.includes(type)) return
      const day = this.days[dayIndex]
      if (!day) return
      day[type] = id
    },

    clearSlot(type, dayIndex = this.activeDay) {
      if (!MENU_CORE_TYPES.includes(type)) return
      const day = this.days[dayIndex]
      if (!day) return
      day[type] = null
    },

    addExtra(id, dayIndex = this.activeDay) {
      const day = this.days[dayIndex]
      if (!day || !id) return
      if (dayIds(day).includes(id)) return
      day.extras.push(id)
    },

    removeExtra(id, dayIndex = this.activeDay) {
      const day = this.days[dayIndex]
      if (!day) return
      day.extras = day.extras.filter((x) => x !== id)
    },

    clearDay(dayIndex = this.activeDay) {
      this.days[dayIndex] = emptyDay()
    },

    clear() {
      this.days = Array.from({ length: this.nbJours }, () => emptyDay())
      this.activeDay = 0
    },

    /**
     * Remplit TOUS les jours demandés.
     * Priorité : recettes jamais utilisées → puis réutilisation (si pas assez de stock).
     */
    generate() {
      this.setNbJours(this.nbJours)

      const recipes = useRecipesStore()
      const sheets = useSheetsStore()
      const usedRecipes = new Set()
      const recentIngredientIds = []
      const usedMoods = []
      const plan = []
      const allergyTokens = this.allergyTokens

      const conflictsAllergy = (recipe) => {
        if (!allergyTokens.length) return false
        const linked = (sheets.data.ingredientsRecette || []).filter(
          (l) => l.idRecette === recipe.idRecette,
        )
        const ingNames = linked
          .map((l) => recipes.ingredientsMap[l.idIngr]?.nomIngr || '')
          .join(' ')
        const allergenNames = linked
          .map((l) => {
            const idAllergie = recipes.ingredientsMap[l.idIngr]?.idAllergie
            return recipes.allergenName(idAllergie)
          })
          .filter(Boolean)
          .join(' ')
        const full = normalize(
          [recipe.allergie, recipe.nomRecette, ingNames, allergenNames]
            .filter(Boolean)
            .join(' '),
        )
        return allergyTokens.some((token) => full.includes(token))
      }

      const ingredientIdsOf = (recipeId) =>
        (sheets.data.ingredientsRecette || [])
          .filter((l) => l.idRecette === recipeId)
          .map((l) => l.idIngr)

      const scoreCandidate = (recipe, type, dayIndex, currentDay, allowReuse) => {
        let score = 12 + Math.random() * 3

        if (conflictsAllergy(recipe)) score -= 35

        if (this.mood && normalize(recipe.mood) === normalize(this.mood)) score += 8
        else if (this.mood) score -= 2

        if (!this.mood && recipe.mood) {
          const moodHits = usedMoods.filter((m) => normalize(m) === normalize(recipe.mood)).length
          score -= moodHits * 2
          if (!moodHits) score += 2
        }

        if (usedRecipes.has(recipe.idRecette)) {
          score -= allowReuse ? 5 : 70
        }

        const ings = ingredientIdsOf(recipe.idRecette)
        const overlap = ings.filter((id) => recentIngredientIds.includes(id)).length
        score -= overlap * (type === 'plat' ? 1.8 : 0.9)

        if (dayIndex > 0 && plan[dayIndex - 1]?.plat) {
          const prev = recipes.byId(plan[dayIndex - 1].plat)
          if (prev && normalize(prev.difficulte) === normalize(recipe.difficulte)) {
            score -= 1
          }
        }

        if (this.budgetParJour != null && this.budgetParJour !== '') {
          const budget = toNumber(this.budgetParJour, Infinity)
          const cost = recipes.enriched(recipe.idRecette, this.nbPersonnes)?.cout || 0
          const daySoFar = MENU_CORE_TYPES.reduce((sum, t) => {
            const id = currentDay?.[t]
            if (!id) return sum
            return sum + (recipes.enriched(id, this.nbPersonnes)?.cout || 0)
          }, 0)
          if (daySoFar + cost > budget) score -= 20
        }

        return score
      }

      const pickBest = (type, dayIndex, localUsed, currentDay) => {
        const allOfType = recipes.byType(type)
        if (!allOfType.length) return null

        const withoutAllergy = allOfType.filter((r) => !conflictsAllergy(r))
        const safe = withoutAllergy.length ? withoutAllergy : allOfType

        // Passe 1 : jamais utilisées sur le planning
        let pool = safe.filter(
          (r) => !localUsed.has(r.idRecette) && !usedRecipes.has(r.idRecette),
        )
        let allowReuse = false

        // Passe 2 : réutilisation autorisée (sauf doublon le même jour)
        if (!pool.length) {
          pool = safe.filter((r) => !localUsed.has(r.idRecette))
          allowReuse = true
        }

        // Passe 3 : dernier recours
        if (!pool.length) {
          pool = safe.slice()
          allowReuse = true
        }

        if (this.mood) {
          const matched = pool.filter((r) => normalize(r.mood) === normalize(this.mood))
          if (matched.length) pool = matched
        }

        const ranked = pool
          .map((r) => ({
            r,
            score: scoreCandidate(r, type, dayIndex, currentDay, allowReuse),
          }))
          .sort((a, b) => b.score - a.score)

        const top = ranked.slice(0, Math.min(3, ranked.length))
        const weights = top.map((t, i) => Math.max(1, t.score + 15) * (4 - i))
        const total = weights.reduce((a, b) => a + b, 0) || 1
        let roll = Math.random() * total
        for (let i = 0; i < top.length; i += 1) {
          roll -= weights[i]
          if (roll <= 0) return top[i].r
        }
        return top[0]?.r || null
      }

      for (let d = 0; d < this.nbJours; d += 1) {
        const day = emptyDay()
        const localUsed = new Set()

        for (const type of MENU_CORE_TYPES) {
          const picked = pickBest(type, d, localUsed, day)
          if (picked) {
            day[type] = picked.idRecette
            localUsed.add(picked.idRecette)
            usedRecipes.add(picked.idRecette)
            usedMoods.push(picked.mood || '')
            recentIngredientIds.push(...ingredientIdsOf(picked.idRecette))
            while (recentIngredientIds.length > 24) recentIngredientIds.shift()
          }
        }

        plan.push(day)
      }

      this.days = plan
      this.activeDay = 0

      const daysFilled = plan.filter((day) => dayIds(day).length > 0).length
      return {
        recipes: this.allSelectedIds.length,
        daysFilled,
        daysRequested: this.nbJours,
      }
    },
  },
})
