export const RECIPE_TYPES = [
  { value: 'petit_dejeuner', label: 'Petit-déjeuner' },
  { value: 'entree', label: 'Entrée' },
  { value: 'plat', label: 'Plat' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'diner', label: 'Dîner' },
  { value: 'accompagnement', label: 'Accompagnement' },
  { value: 'boisson', label: 'Boisson' },
]

/** Slots d’un jour de planning (ordre d’affichage). */
export const MENU_SLOT_TYPES = ['petit_dejeuner', 'entree', 'plat', 'dessert', 'diner']

/** Cours du déjeuner que l’on peut activer/désactiver. */
export const LUNCH_COURSE_TYPES = ['entree', 'plat', 'dessert']

export const MENU_CORE_TYPES = MENU_SLOT_TYPES

export const SLOT_META = {
  petit_dejeuner: { label: 'Petit-déjeuner', short: 'Matin', icon: 'pi-sun', tone: 0 },
  entree: { label: 'Entrée', short: 'Entrée', icon: 'pi-circle', tone: 1 },
  plat: { label: 'Plat', short: 'Plat', icon: 'pi-stop', tone: 2 },
  dessert: { label: 'Dessert', short: 'Dessert', icon: 'pi-heart', tone: 3 },
  diner: { label: 'Dîner', short: 'Soir', icon: 'pi-moon', tone: 4 },
}

export function typeLabel(value) {
  return (
    SLOT_META[value]?.label ||
    RECIPE_TYPES.find((t) => t.value === value)?.label ||
    value ||
    '—'
  )
}

/** Types catalogue utilisés pour remplir un slot (avec fallbacks). */
export function recipeTypesForSlot(slot) {
  if (slot === 'petit_dejeuner') return ['petit_dejeuner', 'plat', 'boisson']
  if (slot === 'diner') return ['diner', 'plat']
  return [slot]
}

export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function toNumber(value, fallback = 0) {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function fuzzyMatch(haystack, needle) {
  const h = normalizeText(haystack)
  const n = normalizeText(needle)
  if (!n) return true
  return h.includes(n)
}

export function pickRandom(list) {
  if (!list?.length) return null
  return list[Math.floor(Math.random() * list.length)]
}
