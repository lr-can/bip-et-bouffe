import { defineStore } from 'pinia'
import { useRecipesStore } from '@/stores/recipes'
import { useSheetsStore } from '@/stores/sheets'
import {
  MENU_SLOT_TYPES,
  LUNCH_COURSE_TYPES,
  recipeTypesForSlot,
  toNumber,
  flagTrue,
  spiceLevel,
} from '@/utils/recipe'
import { buildShoppingList } from '@/composables/useShoppingList'

function emptyDay() {
  return {
    petit_dejeuner: null,
    entree: null,
    plat: null,
    dessert: null,
    diner: null,
    extras: [],
  }
}

function dayIds(day) {
  if (!day) return []
  return [
    day.petit_dejeuner,
    day.entree,
    day.plat,
    day.dessert,
    day.diner,
    ...(day.extras || []),
  ].filter(Boolean)
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
    /** '' | vegetarien | vegan */
    diet: '',
    /** null = pas de limite, 0–3 = épice max acceptée */
    maxSpice: null,
    activeDay: 0,
    days: [emptyDay(), emptyDay(), emptyDay()],
    includePetitDejeuner: true,
    includeDiner: true,
    includeCourses: {
      entree: true,
      plat: true,
      dessert: true,
    },
    /** wizard | plan */
    phase: 'wizard',
  }),

  getters: {
    currentDay(state) {
      return state.days[state.activeDay] || emptyDay()
    },

    activeSlots(state) {
      const slots = []
      if (state.includePetitDejeuner) slots.push('petit_dejeuner')
      for (const course of LUNCH_COURSE_TYPES) {
        if (state.includeCourses[course]) slots.push(course)
      }
      if (state.includeDiner) slots.push('diner')
      return slots
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

    dayNutrition() {
      return (dayIndex) =>
        this.dayRecipes(dayIndex).reduce(
          (acc, r) => {
            const n = r.nutritionParPers || r.nutrition
            if (!n) return acc
            return {
              kcal: Math.round((acc.kcal + n.kcal) * 10) / 10,
              proteines: Math.round((acc.proteines + n.proteines) * 10) / 10,
              glucides: Math.round((acc.glucides + n.glucides) * 10) / 10,
              lipides: Math.round((acc.lipides + n.lipides) * 10) / 10,
            }
          },
          { kcal: 0, proteines: 0, glucides: 0, lipides: 0 },
        )
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
        nutrition: this.dayNutrition(i),
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

    setPhase(phase) {
      this.phase = phase
    },

    setSlot(type, id, dayIndex = this.activeDay) {
      if (!MENU_SLOT_TYPES.includes(type)) return
      const day = this.days[dayIndex]
      if (!day) return
      day[type] = id
    },

    clearSlot(type, dayIndex = this.activeDay) {
      if (!MENU_SLOT_TYPES.includes(type)) return
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

    toggleCourse(course) {
      if (!LUNCH_COURSE_TYPES.includes(course)) return
      // Au moins un cours du déjeuner doit rester actif
      const next = !this.includeCourses[course]
      if (!next) {
        const othersOn = LUNCH_COURSE_TYPES.some(
          (c) => c !== course && this.includeCourses[c],
        )
        if (!othersOn && !this.includePetitDejeuner && !this.includeDiner) return
      }
      this.includeCourses[course] = next
    },

    /**
     * Tire une nouvelle recette pour un slot (dés).
     */
    rerollSlot(type, dayIndex = this.activeDay) {
      if (!MENU_SLOT_TYPES.includes(type)) return null
      const day = this.days[dayIndex]
      if (!day) return null

      const picked = this._pickBest(type, dayIndex, new Set(dayIds(day)), day, {
        excludeId: day[type],
      })
      if (!picked) return null
      day[type] = picked.idRecette
      return picked
    },

    _conflictsAllergy(recipe) {
      const recipes = useRecipesStore()
      const sheets = useSheetsStore()
      const allergyTokens = this.allergyTokens
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
    },

    _candidatesForSlot(slot) {
      const recipes = useRecipesStore()
      const types = recipeTypesForSlot(slot)
      const seen = new Set()
      const list = []
      for (const type of types) {
        for (const r of recipes.byType(type)) {
          if (seen.has(r.idRecette)) continue
          seen.add(r.idRecette)
          list.push(r)
        }
      }
      return list
    },

    _pickBest(type, dayIndex, localUsed, currentDay, { excludeId = null } = {}) {
      const recipes = useRecipesStore()
      const sheets = useSheetsStore()
      const allOfType = this._candidatesForSlot(type)
      if (!allOfType.length) return null

      const ingredientIdsOf = (recipeId) =>
        (sheets.data.ingredientsRecette || [])
          .filter((l) => l.idRecette === recipeId)
          .map((l) => l.idIngr)

      const withoutAllergy = allOfType.filter((r) => !this._conflictsAllergy(r))
      let safe = withoutAllergy.length ? withoutAllergy : allOfType
      if (excludeId) safe = safe.filter((r) => r.idRecette !== excludeId)

      let pool = safe.filter((r) => !localUsed.has(r.idRecette))
      let allowReuse = false
      if (!pool.length) {
        pool = safe.slice()
        allowReuse = true
      }
      if (!pool.length) return null

      if (this.mood) {
        const matched = pool.filter((r) => normalize(r.mood) === normalize(this.mood))
        if (matched.length) pool = matched
      }

      if (this.diet === 'vegan') {
        const matched = pool.filter((r) => flagTrue(r.vegan))
        if (matched.length) pool = matched
      } else if (this.diet === 'vegetarien') {
        const matched = pool.filter((r) => flagTrue(r.vegetarien) || flagTrue(r.vegan))
        if (matched.length) pool = matched
      }

      if (this.maxSpice != null && this.maxSpice !== '') {
        const cap = spiceLevel(this.maxSpice)
        const matched = pool.filter((r) => spiceLevel(r.spiceLevel) <= cap)
        if (matched.length) pool = matched
      }

      const scoreCandidate = (recipe) => {
        let score = 12 + Math.random() * 3
        if (this._conflictsAllergy(recipe)) score -= 35
        if (this.mood && normalize(recipe.mood) === normalize(this.mood)) score += 8
        else if (this.mood) score -= 2
        if (this.diet === 'vegan') {
          if (flagTrue(recipe.vegan)) score += 10
          else score -= 45
        } else if (this.diet === 'vegetarien') {
          if (flagTrue(recipe.vegan) || flagTrue(recipe.vegetarien)) score += 10
          else score -= 45
        }
        if (this.maxSpice != null && this.maxSpice !== '') {
          const level = spiceLevel(recipe.spiceLevel)
          const cap = spiceLevel(this.maxSpice)
          if (level <= cap) score += 4
          else score -= 40
        }
        if (localUsed.has(recipe.idRecette)) score -= allowReuse ? 5 : 70
        if (excludeId && recipe.idRecette === excludeId) score -= 100

        if (this.budgetParJour != null && this.budgetParJour !== '') {
          const budget = toNumber(this.budgetParJour, Infinity)
          const cost = recipes.enriched(recipe.idRecette, this.nbPersonnes)?.cout || 0
          const daySoFar = this.activeSlots.reduce((sum, t) => {
            const id = currentDay?.[t]
            if (!id) return sum
            return sum + (recipes.enriched(id, this.nbPersonnes)?.cout || 0)
          }, 0)
          if (daySoFar + cost > budget) score -= 20
        }
        return score
      }

      const ranked = pool
        .map((r) => ({ r, score: scoreCandidate(r) }))
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
    },

    /**
     * Remplit tous les jours selon les repas activés.
     */
    generate() {
      this.setNbJours(this.nbJours)
      const slots = this.activeSlots
      if (!slots.length) {
        return { recipes: 0, daysFilled: 0, daysRequested: this.nbJours }
      }

      const usedRecipes = new Set()
      const plan = []

      for (let d = 0; d < this.nbJours; d += 1) {
        const day = emptyDay()
        const localUsed = new Set()

        for (const type of slots) {
          const picked = this._pickBest(type, d, localUsed, day)
          if (picked) {
            day[type] = picked.idRecette
            localUsed.add(picked.idRecette)
            usedRecipes.add(picked.idRecette)
          }
        }

        plan.push(day)
      }

      this.days = plan
      this.activeDay = 0
      this.phase = 'plan'

      const daysFilled = plan.filter((day) => dayIds(day).length > 0).length
      return {
        recipes: this.allSelectedIds.length,
        daysFilled,
        daysRequested: this.nbJours,
      }
    },
  },
})
