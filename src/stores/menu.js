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
import { buildShoppingList, groupShoppingByCategory } from '@/composables/useShoppingList'

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

function cloneDay(day) {
  return {
    petit_dejeuner: day?.petit_dejeuner ?? null,
    entree: day?.entree ?? null,
    plat: day?.plat ?? null,
    dessert: day?.dessert ?? null,
    diner: day?.diner ?? null,
    extras: [...(day?.extras || [])],
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

function planSignature(plan) {
  return plan.map((d) => dayIds(d).join(',')).join('|')
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

/** Apports journaliers de référence, par personne et par jour. */
export const DAILY_TARGETS = {
  kcal: 2100,
  proteines: 50,
  glucides: 260,
  lipides: 70,
}

const MACRO_KEYS = ['kcal', 'proteines', 'glucides', 'lipides']

/**
 * Axes de dosage du menu. Chaque axe déforme les cibles nutritionnelles
 * et les poids du score (nutrition / budget / panier).
 */
export const BIAS_CONFIGS = {
  equilibre: {
    id: 'equilibre',
    label: 'Le plus équilibré',
    short: 'Équilibré',
    blurb: 'Au plus près des apports journaliers',
    targetMul: {},
    nutritionWeights: { kcal: 1.3, proteines: 1.6, glucides: 0.4, lipides: 0.5 },
    costWeight: 1,
    basketWeight: 1.2,
  },
  proteine: {
    id: 'proteine',
    label: 'Plus protéiné',
    short: 'Protéiné',
    blurb: 'Priorité aux protéines, sans exploser les calories',
    targetMul: { proteines: 1.6 },
    nutritionWeights: { kcal: 1, proteines: 3.4, glucides: 0.3, lipides: 0.4 },
    costWeight: 0.8,
    basketWeight: 1,
  },
  economique: {
    id: 'economique',
    label: 'Plus économique',
    short: 'Économique',
    blurb: 'Le meilleur prix par jour et un panier serré',
    targetMul: {},
    nutritionWeights: { kcal: 0.9, proteines: 1.1, glucides: 0.3, lipides: 0.35 },
    costWeight: 2.5,
    basketWeight: 2,
  },
  leger: {
    id: 'leger',
    label: 'Plus léger',
    short: 'Léger',
    blurb: 'Moins de calories, assiettes plus douces',
    targetMul: { kcal: 0.8, lipides: 0.8 },
    nutritionWeights: { kcal: 2.6, proteines: 1.3, glucides: 0.5, lipides: 1.3 },
    costWeight: 1,
    basketWeight: 1.1,
  },
}

export const BIAS_ORDER = ['equilibre', 'proteine', 'economique', 'leger']

function biasConfig(bias) {
  return BIAS_CONFIGS[bias] || BIAS_CONFIGS.equilibre
}

function targetsForBias(bias) {
  const cfg = biasConfig(bias)
  const targets = { ...DAILY_TARGETS }
  for (const [key, mul] of Object.entries(cfg.targetMul || {})) {
    targets[key] = Math.round(targets[key] * mul)
  }
  return targets
}

export const useMenuStore = defineStore('menu', {
  state: () => ({
    nbPersonnes: 4,
    nbJours: 3,
    /** Ambiances souhaitées (multi-sélection). */
    moods: [],
    allergies: '',
    budgetParJour: null,
    /** '' | vegetarien | vegan */
    diet: '',
    /** null = pas de limite, 0–3 = épice max acceptée */
    maxSpice: null,
    /** equilibre | proteine | economique | leger */
    menuBias: 'equilibre',
    activeDay: 0,
    days: [emptyDay(), emptyDay(), emptyDay()],
    includePetitDejeuner: true,
    includeDiner: true,
    includeCourses: {
      entree: true,
      plat: true,
      dessert: true,
    },
    /** Ids d’ingrédients déjà en frigo (vidés si fridgeEmpty). */
    fridgeIngredientIds: [],
    /** true = frigo vide, on n’utilise pas le stock. */
    fridgeEmpty: false,
    /** wizard | proposals | plan */
    phase: 'wizard',
    /** 3 propositions générées avant validation */
    proposals: [],
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

    fridgeSet() {
      if (this.fridgeEmpty) return new Set()
      return new Set((this.fridgeIngredientIds || []).filter(Boolean))
    },

    /** Liste complète avant retrait frigo. */
    shoppingListRaw() {
      return buildShoppingList(this.selectedRecipes)
    },

    /** Articles déjà couverts par le frigo. */
    shoppingFromFridge() {
      const fridge = this.fridgeSet
      if (!fridge.size) return []
      return this.shoppingListRaw.filter((item) => fridge.has(item.idIngr))
    },

    /** Liste à acheter (hors frigo) — se recalcule dès qu’un plat change. */
    shoppingList() {
      const fridge = this.fridgeSet
      if (!fridge.size) return this.shoppingListRaw
      return this.shoppingListRaw.filter((item) => !fridge.has(item.idIngr))
    },

    shoppingCost() {
      return (
        Math.round(
          this.shoppingList.reduce((sum, item) => sum + (item.cout || 0), 0) * 100,
        ) / 100
      )
    },

    shoppingText() {
      const lines = [`Liste de courses — ${this.nbJours} jour(s) · ${this.nbPersonnes} pers.`]
      if (this.shoppingFromFridge.length) {
        lines.push('')
        lines.push('▸ Déjà en frigo (non acheté)')
        for (const item of this.shoppingFromFridge) {
          const qty = Number.isInteger(item.quantite)
            ? item.quantite
            : Number(item.quantite.toFixed(2))
          lines.push(`✓ ${item.nomIngr} — ${qty} ${item.unite || ''}`.trim())
        }
      }
      for (const group of groupShoppingByCategory(this.shoppingList)) {
        lines.push('')
        lines.push(`▸ ${group.categorie}`)
        for (const item of group.items) {
          const qty = Number.isInteger(item.quantite)
            ? item.quantite
            : Number(item.quantite.toFixed(2))
          lines.push(`☐ ${item.nomIngr} — ${qty} ${item.unite || ''}`.trim())
        }
      }
      lines.push('')
      lines.push(`Total estimé courses : ${this.shoppingCost.toFixed(2)} €`)
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

    /** Ambiances normalisées (pour le scoring). */
    moodTokens() {
      return (this.moods || []).map((m) => normalize(m)).filter(Boolean)
    },

    /** Cibles nutritionnelles du jour selon le dosage choisi. */
    biasedTargets() {
      return targetsForBias(this.menuBias)
    },

    /**
     * Écarts du jour vs cibles (par personne).
     * Positif = excès, négatif = manque. `status` résume l'état.
     */
    dayBalance() {
      return (dayIndex) => {
        const n = this.dayNutrition(dayIndex)
        const targets = this.biasedTargets
        const diffs = {}
        let worstKey = null
        let worstRel = 0
        for (const key of MACRO_KEYS) {
          const target = targets[key] || 1
          const diff = Math.round((n[key] || 0) - target)
          diffs[key] = diff
          const rel = Math.abs(diff) / target
          if (rel > worstRel) {
            worstRel = rel
            worstKey = key
          }
        }
        let status = 'equilibre'
        if (!dayIds(this.days[dayIndex]).length) status = 'vide'
        else if (worstRel > 0.22 && worstKey) {
          status = diffs[worstKey] < 0 ? `manque-${worstKey}` : `exces-${worstKey}`
        }
        return { diffs, status, worstKey, worstRel, targets }
      }
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
      this.days.splice(dayIndex, 1, { ...cloneDay(day), [type]: id || null })
    },

    clearSlot(type, dayIndex = this.activeDay) {
      if (!MENU_SLOT_TYPES.includes(type)) return
      const day = this.days[dayIndex]
      if (!day) return
      this.days.splice(dayIndex, 1, { ...cloneDay(day), [type]: null })
    },

    addExtra(id, dayIndex = this.activeDay) {
      const day = this.days[dayIndex]
      if (!day || !id) return
      if (dayIds(day).includes(id)) return
      this.days.splice(dayIndex, 1, {
        ...cloneDay(day),
        extras: [...(day.extras || []), id],
      })
    },

    removeExtra(id, dayIndex = this.activeDay) {
      const day = this.days[dayIndex]
      if (!day) return
      this.days.splice(dayIndex, 1, {
        ...cloneDay(day),
        extras: (day.extras || []).filter((x) => x !== id),
      })
    },

    clearDay(dayIndex = this.activeDay) {
      this.days.splice(dayIndex, 1, emptyDay())
    },

    setFridgeEmpty(empty) {
      this.fridgeEmpty = Boolean(empty)
      if (this.fridgeEmpty) this.fridgeIngredientIds = []
    },

    toggleFridgeIngredient(idIngr) {
      if (!idIngr || this.fridgeEmpty) return
      const set = new Set(this.fridgeIngredientIds)
      if (set.has(idIngr)) set.delete(idIngr)
      else set.add(idIngr)
      this.fridgeIngredientIds = [...set]
    },

    setFridgeIngredients(ids) {
      if (this.fridgeEmpty) {
        this.fridgeIngredientIds = []
        return
      }
      this.fridgeIngredientIds = [...new Set((ids || []).filter(Boolean))]
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

      const shared = this._sharedIngredientsExcluding(dayIndex, type)

      const picked = this._pickBest(type, dayIndex, new Set(dayIds(day)), day, {
        excludeId: day[type],
        sharedIngredients: shared,
        overlapWeight: 8,
        novelPenalty: 3,
        reusePenalty: 75,
        globalUsed: new Set(
          this.days.flatMap((d, i) => (i === dayIndex ? [] : dayIds(d))),
        ),
      })
      if (!picked) return null
      this.setSlot(type, picked.idRecette, dayIndex)
      return picked
    },

    /**
     * Propose N alternatives scorées pour un slot (hors plat courant).
     */
    suggestAlternatives(type, count = 2, dayIndex = this.activeDay) {
      if (!MENU_SLOT_TYPES.includes(type)) return []
      const day = this.days[dayIndex]
      if (!day) return []

      const shared = this._sharedIngredientsExcluding(dayIndex, type)
      const globalUsed = new Set(
        this.days.flatMap((d, i) => (i === dayIndex ? [] : dayIds(d))),
      )
      const localUsed = new Set(dayIds(day))
      const ranked = this._rankCandidates(type, dayIndex, localUsed, day, {
        excludeId: day[type],
        sharedIngredients: shared,
        overlapWeight: 6,
        novelPenalty: 2,
        reusePenalty: 80,
        globalUsed,
        randomAmp: 2,
      })
      return ranked.slice(0, Math.max(0, count)).map((row) => row.r)
    },

    applyAlternative(type, recipeId, dayIndex = this.activeDay) {
      if (!recipeId) return
      this.setSlot(type, recipeId, dayIndex)
    },

    _sharedIngredientsExcluding(dayIndex, slotType) {
      const shared = new Set()
      for (const id of this.fridgeSet) shared.add(id)
      for (let i = 0; i < this.days.length; i += 1) {
        const d = this.days[i]
        for (const id of dayIds(d)) {
          if (i === dayIndex && id === d?.[slotType]) continue
          for (const ingId of this._ingredientIdsOf(id)) shared.add(ingId)
        }
      }
      return shared
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

    _ingredientIdsOf(recipeId) {
      const sheets = useSheetsStore()
      return (sheets.data.ingredientsRecette || [])
        .filter((l) => l.idRecette === recipeId)
        .map((l) => l.idIngr)
        .filter(Boolean)
    },

    /** Macros par personne d'un objet jour (pas forcément dans this.days). */
    _nutritionOfDayObj(day) {
      const recipes = useRecipesStore()
      const acc = { kcal: 0, proteines: 0, glucides: 0, lipides: 0 }
      for (const id of dayIds(day)) {
        const r = recipes.enriched(id, this.nbPersonnes)
        const n = r?.nutritionParPers || r?.nutrition
        if (!n) continue
        for (const key of MACRO_KEYS) acc[key] += n[key] || 0
      }
      return acc
    },

    /** Macros par personne d'une recette. */
    _macrosOf(recipeId) {
      const recipes = useRecipesStore()
      const r = recipes.enriched(recipeId, this.nbPersonnes)
      const n = r?.nutritionParPers || r?.nutrition
      return {
        kcal: n?.kcal || 0,
        proteines: n?.proteines || 0,
        glucides: n?.glucides || 0,
        lipides: n?.lipides || 0,
      }
    },

    /**
     * Score global d'un plan : proximité AJR par jour + budget + panier + diversité.
     * Plus haut = mieux. Sert à comparer des plans et à valider les swaps.
     */
    _scorePlan(plan, bias = this.menuBias) {
      const cfg = biasConfig(bias)
      const targets = targetsForBias(bias)
      let score = 0

      for (const day of plan) {
        if (!dayIds(day).length) continue
        const n = this._nutritionOfDayObj(day)
        for (const key of MACRO_KEYS) {
          const target = targets[key] || 1
          const relGap = Math.abs((n[key] || 0) - target) / target
          score -= relGap * (cfg.nutritionWeights[key] || 0.5) * 30
        }

        const recipes = useRecipesStore()
        const dayCost = dayIds(day).reduce(
          (sum, id) => sum + (recipes.enriched(id, this.nbPersonnes)?.cout || 0),
          0,
        )
        score -= (dayCost / Math.max(1, this.nbPersonnes)) * cfg.costWeight * 1.2
        if (this.budgetParJour != null && this.budgetParJour !== '') {
          const budget = toNumber(this.budgetParJour, Infinity)
          if (dayCost > budget) {
            score -= ((dayCost - budget) / Math.max(1, budget)) * 45 * cfg.costWeight
          }
        }
      }

      const stats = this._evaluatePlan(plan)
      score -= stats.ingredientCount * cfg.basketWeight
      score += stats.uniqueRecipes * 6

      return score
    },

    /**
     * Statistiques nutritionnelles moyennes par jour rempli (par personne).
     */
    _planNutritionStats(plan) {
      const filled = plan.filter((d) => dayIds(d).length > 0)
      const acc = { kcal: 0, proteines: 0, glucides: 0, lipides: 0 }
      for (const day of filled) {
        const n = this._nutritionOfDayObj(day)
        for (const key of MACRO_KEYS) acc[key] += n[key] || 0
      }
      const div = Math.max(1, filled.length)
      return {
        kcalParJour: Math.round(acc.kcal / div),
        proteinesParJour: Math.round((acc.proteines / div) * 10) / 10,
        glucidesParJour: Math.round(acc.glucides / div),
        lipidesParJour: Math.round(acc.lipides / div),
      }
    },

    /**
     * Optimisation locale : essaie de remplacer chaque slot par ses meilleurs
     * candidats et garde le swap si le score global du plan augmente.
     */
    _improvePlan(plan, bias = this.menuBias, iterations = 2) {
      const slots = this.activeSlots
      let bestScore = this._scorePlan(plan, bias)

      for (let iter = 0; iter < iterations; iter += 1) {
        let improved = false

        for (let d = 0; d < plan.length; d += 1) {
          const day = plan[d]
          for (const slot of slots) {
            if (!day[slot]) continue

            const globalUsed = new Set(
              plan.flatMap((dd, i) =>
                dayIds(dd).filter((id) => !(i === d && id === day[slot])),
              ),
            )
            const localUsed = new Set(dayIds(day).filter((id) => id !== day[slot]))
            const shared = new Set(this.fridgeSet)
            for (const dd of plan) {
              for (const id of dayIds(dd)) {
                if (id === day[slot]) continue
                for (const ingId of this._ingredientIdsOf(id)) shared.add(ingId)
              }
            }

            const ranked = this._rankCandidates(slot, d, localUsed, day, {
              excludeId: day[slot],
              sharedIngredients: shared,
              globalUsed,
              randomAmp: 0.5,
              bias,
              currentDayObj: day,
            })

            for (const cand of ranked.slice(0, 3)) {
              const prev = day[slot]
              day[slot] = cand.r.idRecette
              const newScore = this._scorePlan(plan, bias)
              if (newScore > bestScore + 0.5) {
                bestScore = newScore
                improved = true
                break
              }
              day[slot] = prev
            }
          }
        }

        if (!improved) break
      }

      return plan
    },

    _evaluatePlan(plan) {
      const recipes = useRecipesStore()
      const ids = plan.flatMap((d) => dayIds(d))
      const enriched = ids
        .map((id) => recipes.enriched(id, this.nbPersonnes))
        .filter(Boolean)
      const fridge = this.fridgeSet
      const shoppingRaw = buildShoppingList(enriched)
      const shopping = fridge.size
        ? shoppingRaw.filter((item) => !fridge.has(item.idIngr))
        : shoppingRaw
      const totalCost =
        Math.round(
          shopping.reduce((sum, item) => sum + (item.cout || 0), 0) * 100,
        ) / 100
      const uniqueRecipes = new Set(ids).size

      const highlights = []
      const highlightSlots = ['plat', 'diner', 'entree', 'petit_dejeuner', 'dessert']
      for (const day of plan) {
        for (const slot of highlightSlots) {
          const id = day?.[slot]
          if (!id) continue
          const name = recipes.byId(id)?.nomRecette
          if (name && !highlights.includes(name)) highlights.push(name)
          if (highlights.length >= 4) break
        }
        if (highlights.length >= 4) break
      }

      return {
        ingredientCount: shopping.length,
        totalCost,
        highlights,
        recipeCount: ids.length,
        uniqueRecipes,
        daysFilled: plan.filter((day) => dayIds(day).length > 0).length,
      }
    },

    _rankCandidates(type, dayIndex, localUsed, currentDay, {
      excludeId = null,
      sharedIngredients = null,
      overlapWeight = 5,
      novelPenalty = 2,
      costWeight = null,
      randomAmp = 3,
      globalUsed = null,
      reusePenalty = 55,
      usedNames = null,
      bias = this.menuBias,
      currentDayObj = null,
      slotsLeft = null,
      focusMacro = null,
    } = {}) {
      const recipes = useRecipesStore()
      const allOfType = this._candidatesForSlot(type)
      if (!allOfType.length) return []

      const cfg = biasConfig(bias)
      const targets = targetsForBias(bias)
      const effectiveCostWeight = costWeight ?? cfg.costWeight

      const withoutAllergy = allOfType.filter((r) => !this._conflictsAllergy(r))
      let safe = withoutAllergy.length ? withoutAllergy : allOfType
      if (excludeId) safe = safe.filter((r) => r.idRecette !== excludeId)

      let pool = safe.filter(
        (r) => !localUsed.has(r.idRecette) && !(globalUsed?.has(r.idRecette)),
      )
      let allowReuse = false
      if (!pool.length) {
        pool = safe.filter((r) => !localUsed.has(r.idRecette))
        allowReuse = true
      }
      if (!pool.length) {
        pool = safe.slice()
        allowReuse = true
      }
      if (!pool.length) return []

      const moodTokens = this.moodTokens
      if (moodTokens.length) {
        const matched = pool.filter((r) => moodTokens.includes(normalize(r.mood)))
        if (matched.length >= 2) pool = matched
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

      const shared = sharedIngredients || new Set()
      const namesSeen = usedNames || new Set()
      const fridge = this.fridgeSet

      // Contexte nutritionnel : cumul du jour + part idéale pour ce slot
      const dayObj = currentDayObj || currentDay
      const soFar = this._nutritionOfDayObj(dayObj)
      const totalSlots = this.activeSlots.length || 1
      const filledSlots = this.activeSlots.filter((s) => dayObj?.[s]).length
      const remaining =
        slotsLeft ?? Math.max(1, totalSlots - filledSlots)

      const scoreCandidate = (recipe) => {
        let score = 10 + Math.random() * randomAmp
        if (this._conflictsAllergy(recipe)) score -= 35
        if (moodTokens.length) {
          if (moodTokens.includes(normalize(recipe.mood))) score += 8
          else score -= 2
        }
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
        if (localUsed.has(recipe.idRecette)) score -= allowReuse ? reusePenalty * 0.6 : 70
        if (globalUsed?.has(recipe.idRecette)) score -= reusePenalty
        if (excludeId && recipe.idRecette === excludeId) score -= 100

        const nameKey = normalize(recipe.nomRecette)
        if (nameKey && namesSeen.has(nameKey)) score -= reusePenalty * 0.5
        else if (nameKey) {
          for (const seen of namesSeen) {
            if (seen.length >= 5 && (nameKey.includes(seen) || seen.includes(nameKey))) {
              score -= 12
              break
            }
          }
        }

        const ings = this._ingredientIdsOf(recipe.idRecette)
        if (ings.length) {
          let overlap = 0
          let fridgeHits = 0
          for (const id of ings) {
            if (shared.has(id)) overlap += 1
            if (fridge.has(id)) fridgeHits += 1
          }
          const novel = ings.length - overlap
          score += overlap * overlapWeight
          score -= novel * novelPenalty
          score += fridgeHits * 6
          if (ings.length > 0 && overlap / ings.length >= 0.5) score += 3
        }

        // —— Points nutrition : rapprocher le jour des cibles AJR ——
        const macros = this._macrosOf(recipe.idRecette)
        for (const key of MACRO_KEYS) {
          const target = targets[key] || 1
          const remainingTarget = Math.max(0, target - (soFar[key] || 0))
          const ideal = remainingTarget / remaining
          const relErr = Math.abs((macros[key] || 0) - ideal) / target
          score -= relErr * (cfg.nutritionWeights[key] || 0.5) * 12
        }
        // Focus explicite (rééquilibrage) : récompense la réduction du manque
        if (focusMacro && targets[focusMacro]) {
          const deficit = targets[focusMacro] - (soFar[focusMacro] || 0)
          if (deficit > 0) {
            score += Math.min(macros[focusMacro] || 0, deficit) /
              targets[focusMacro] * 40
          } else if (deficit < 0) {
            score -= ((macros[focusMacro] || 0) / targets[focusMacro]) * 30
          }
        }

        const cost = recipes.enriched(recipe.idRecette, this.nbPersonnes)?.cout || 0
        score -= (cost / Math.max(1, this.nbPersonnes)) * 0.2 * effectiveCostWeight

        if (this.budgetParJour != null && this.budgetParJour !== '') {
          const budget = toNumber(this.budgetParJour, Infinity)
          const daySoFar = this.activeSlots.reduce((sum, t) => {
            const id = dayObj?.[t]
            if (!id) return sum
            return sum + (recipes.enriched(id, this.nbPersonnes)?.cout || 0)
          }, 0)
          if (daySoFar + cost > budget) {
            score -= 20 * Math.max(1, effectiveCostWeight)
          }
        }
        return score
      }

      return pool
        .map((r) => ({ r, score: scoreCandidate(r) }))
        .sort((a, b) => b.score - a.score)
    },

    _pickBest(type, dayIndex, localUsed, currentDay, opts = {}) {
      const ranked = this._rankCandidates(type, dayIndex, localUsed, currentDay, opts)
      if (!ranked.length) return null

      const top = ranked.slice(0, Math.min(5, ranked.length))
      const weights = top.map((t, i) => Math.max(1, t.score + 20) * (6 - i))
      const total = weights.reduce((a, b) => a + b, 0) || 1
      let roll = Math.random() * total
      for (let i = 0; i < top.length; i += 1) {
        roll -= weights[i]
        if (roll <= 0) return top[i].r
      }
      return top[0]?.r || null
    },

    _buildPlan(strategy = {}) {
      const slots = this.activeSlots
      const shared = new Set(this.fridgeSet)
      const globalUsed = new Set()
      const usedNames = new Set()
      const bias = strategy.bias ?? this.menuBias
      const plan = []

      for (let d = 0; d < this.nbJours; d += 1) {
        const day = emptyDay()
        const localUsed = new Set()

        for (let s = 0; s < slots.length; s += 1) {
          const type = slots[s]
          const picked = this._pickBest(type, d, localUsed, day, {
            sharedIngredients: shared,
            overlapWeight: strategy.overlapWeight ?? 5,
            novelPenalty: strategy.novelPenalty ?? 2,
            randomAmp: strategy.randomAmp ?? 3,
            reusePenalty: strategy.reusePenalty ?? 70,
            globalUsed,
            usedNames,
            bias,
            currentDayObj: day,
            slotsLeft: slots.length - s,
          })
          if (picked) {
            day[type] = picked.idRecette
            localUsed.add(picked.idRecette)
            globalUsed.add(picked.idRecette)
            const nameKey = normalize(picked.nomRecette)
            if (nameKey) usedNames.add(nameKey)
            for (const id of this._ingredientIdsOf(picked.idRecette)) shared.add(id)
          }
        }

        plan.push(day)
      }

      return plan
    },

    /**
     * Construit le meilleur plan pour un axe donné : plusieurs tirages,
     * amélioration locale, et on garde le plan au meilleur score.
     */
    _bestPlanForBias(bias, attempts = 3) {
      let best = null
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const plan = this._improvePlan(
          this._buildPlan({ bias, randomAmp: attempt === 0 ? 1.5 : 4 }),
          bias,
        )
        const score = this._scorePlan(plan, bias)
        if (!best || score > best.score) best = { plan, score }
      }
      return best
    },

    /**
     * Génère les propositions : un plan optimisé par axe (équilibré,
     * protéiné, économique, léger), on présente l'équilibré + les 2 axes
     * les plus différenciés.
     */
    generateProposals() {
      this.setNbJours(this.nbJours)
      const slots = this.activeSlots
      if (!slots.length) {
        this.proposals = []
        return { count: 0, recipes: 0, daysFilled: 0, daysRequested: this.nbJours }
      }

      const candidates = []
      for (const bias of BIAS_ORDER) {
        const best = this._bestPlanForBias(bias)
        if (!best) continue
        const stats = this._evaluatePlan(best.plan)
        if (!stats.recipeCount) continue
        const nutrition = this._planNutritionStats(best.plan)
        candidates.push({
          bias,
          plan: best.plan,
          score: best.score,
          stats,
          nutrition,
          sig: planSignature(best.plan),
        })
      }

      if (!candidates.length) {
        this.proposals = []
        this.phase = 'wizard'
        return { count: 0, recipes: 0, daysFilled: 0, daysRequested: this.nbJours }
      }

      const equilibre = candidates.find((c) => c.bias === 'equilibre') || candidates[0]
      const others = candidates.filter((c) => c !== equilibre)

      // Différenciation vs équilibré : protéines, coût, kcal (relatifs)
      const distinctiveness = (c) => {
        const protRef = Math.max(1, equilibre.nutrition.proteinesParJour)
        const kcalRef = Math.max(1, equilibre.nutrition.kcalParJour)
        const costRef = Math.max(1, equilibre.stats.totalCost)
        let d =
          Math.abs(c.nutrition.proteinesParJour - equilibre.nutrition.proteinesParJour) / protRef +
          Math.abs(c.nutrition.kcalParJour - equilibre.nutrition.kcalParJour) / kcalRef +
          Math.abs(c.stats.totalCost - equilibre.stats.totalCost) / costRef
        if (c.sig !== equilibre.sig) d += 0.35
        return d
      }

      const picked = [
        equilibre,
        ...others.sort((a, b) => distinctiveness(b) - distinctiveness(a)).slice(0, 2),
      ]

      this.proposals = picked.map((c) => {
        const cfg = biasConfig(c.bias)
        return {
          id: c.bias,
          label: cfg.label,
          blurb: cfg.blurb,
          days: c.plan.map(cloneDay),
          ...c.stats,
          ...c.nutrition,
        }
      })

      this.phase = this.proposals.length ? 'proposals' : 'wizard'
      return {
        count: this.proposals.length,
        recipes: this.proposals[0]?.recipeCount || 0,
        daysFilled: this.proposals[0]?.daysFilled || 0,
        daysRequested: this.nbJours,
      }
    },

    selectProposal(proposalOrId) {
      const proposal =
        typeof proposalOrId === 'string'
          ? this.proposals.find((p) => p.id === proposalOrId)
          : proposalOrId
      if (!proposal?.days?.length) return false
      this.days = proposal.days.map(cloneDay)
      if (BIAS_CONFIGS[proposal.id]) this.menuBias = proposal.id
      this.activeDay = 0
      this.phase = 'plan'
      this.proposals = []
      return true
    },

    /**
     * Redose tout le planning courant selon un axe (phase plan).
     */
    applyBias(bias) {
      if (!BIAS_CONFIGS[bias]) return false
      this.menuBias = bias
      const best = this._bestPlanForBias(bias)
      if (!best) return false
      this.days = best.plan.map(cloneDay)
      if (this.activeDay >= this.days.length) this.activeDay = 0
      return true
    },

    /**
     * Suggestions de swaps pour ramener le jour vers les cibles AJR.
     * Retourne jusqu'à `max` suggestions { slot, recipe, macro, gain, label }.
     */
    suggestRebalance(dayIndex = this.activeDay, max = 2) {
      const day = this.days[dayIndex]
      if (!day || !dayIds(day).length) return []

      const balance = this.dayBalance(dayIndex)
      if (!balance.worstKey || balance.worstRel <= 0.12) return []

      const macro = balance.worstKey
      const deficit = -balance.diffs[macro] // >0 = manque
      const targets = balance.targets
      const macroLabel = {
        kcal: 'kcal',
        proteines: 'g de protéines',
        glucides: 'g de glucides',
        lipides: 'g de lipides',
      }[macro]

      const suggestions = []

      for (const slot of this.activeSlots) {
        const currentId = day[slot]
        if (!currentId) continue

        const globalUsed = new Set(
          this.days.flatMap((d, i) => (i === dayIndex ? [] : dayIds(d))),
        )
        const localUsed = new Set(dayIds(day).filter((id) => id !== currentId))
        const shared = this._sharedIngredientsExcluding(dayIndex, slot)

        const ranked = this._rankCandidates(slot, dayIndex, localUsed, day, {
          excludeId: currentId,
          sharedIngredients: shared,
          globalUsed,
          randomAmp: 0.5,
          focusMacro: macro,
          currentDayObj: day,
        })

        const currentMacros = this._macrosOf(currentId)
        for (const cand of ranked.slice(0, 4)) {
          const candMacros = this._macrosOf(cand.r.idRecette)
          const delta = (candMacros[macro] || 0) - (currentMacros[macro] || 0)
          // On veut réduire l'écart : delta > 0 si manque, < 0 si excès
          const gain = deficit > 0 ? delta : -delta
          if (gain <= 0) continue
          const newGap = Math.abs(balance.diffs[macro] + delta)
          if (newGap >= Math.abs(balance.diffs[macro])) continue
          suggestions.push({
            slot,
            recipe: cand.r,
            macro,
            gain: Math.round(delta * 10) / 10,
            label:
              deficit > 0
                ? `+${Math.round(Math.abs(delta))} ${macroLabel}`
                : `−${Math.round(Math.abs(delta))} ${macroLabel}`,
          })
          break
        }
      }

      return suggestions
        .sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain))
        .slice(0, max)
    },

    /**
     * Remplit tous les jours (compat) — délègue aux propositions puis prend la meilleure.
     */
    generate() {
      const result = this.generateProposals()
      if (!result.count) return result
      this.selectProposal(this.proposals[0])
      return {
        recipes: this.allSelectedIds.length,
        daysFilled: this.days.filter((day) => dayIds(day).length > 0).length,
        daysRequested: this.nbJours,
      }
    },
  },
})
