export const RECIPE_TYPES = [
  { value: 'entree', label: 'Entrée' },
  { value: 'plat', label: 'Plat' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'accompagnement', label: 'Accompagnement' },
  { value: 'boisson', label: 'Boisson' },
]

export const MENU_CORE_TYPES = ['entree', 'plat', 'dessert']

export function typeLabel(value) {
  return RECIPE_TYPES.find((t) => t.value === value)?.label || value || '—'
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
