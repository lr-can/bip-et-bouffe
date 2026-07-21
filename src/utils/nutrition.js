import { toNumber } from '@/utils/recipe'

/**
 * Poids moyen d'une pièce (g) pour convertir vers les macros /100g.
 * Aligné sur le catalogue Mercurial.
 */
const PIECE_GRAMS = [
  { match: /\b[oœ]ufs?\b/i, g: 60 },
  { match: /feuilles?\s*de\s*brick/i, g: 20 },
  { match: /feuilles?\s*de\s*riz/i, g: 10 },
  { match: /wraps?/i, g: 60 },
  { match: /salade/i, g: 200 },
  { match: /concombre/i, g: 300 },
  { match: /avocat/i, g: 150 },
  { match: /kiwi/i, g: 80 },
  { match: /mangue/i, g: 350 },
  { match: /courgette/i, g: 200 },
  { match: /[eé]chalotte/i, g: 30 },
  { match: /ail/i, g: 5 },
  { match: /oignon/i, g: 100 },
  { match: /choux?\s*rouge/i, g: 800 },
  { match: /betternut|butternut/i, g: 1000 },
  { match: /potimaron/i, g: 1200 },
  { match: /potiron/i, g: 1500 },
  { match: /haricots?\s*verts/i, g: 500 },
  { match: /pois\s*chiche/i, g: 400 },
  { match: /lentilles?/i, g: 500 },
  { match: /menthe|ciboulette|basilic/i, g: 20 },
  { match: /banane/i, g: 120 },
  { match: /pomme\b(?!\s*de)/i, g: 150 },
  { match: /citron/i, g: 80 },
  { match: /tomate/i, g: 120 },
  { match: /carotte/i, g: 80 },
  { match: /pain|tranche/i, g: 40 },
]

function pieceWeightGrams(name) {
  const n = String(name || '')
  for (const row of PIECE_GRAMS) {
    if (row.match.test(n)) return row.g
  }
  return 100
}

function normalizeUnit(unite) {
  return String(unite || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

/** Quantité → grammes (base des macros kcal100). */
export function quantityToGrams(quantite, unite, nomIngr = '') {
  const q = toNumber(quantite, 0)
  const u = normalizeUnit(unite)

  if (!q) return 0
  if (!u || /^(g|gr|gramme|grammes)$/.test(u)) return q
  if (/^(kg|kilo)/.test(u)) return q * 1000
  if (/^mg/.test(u)) return q / 1000
  if (/^(ml|millilitre)/.test(u)) return q
  if (/^(cl|centilitre)/.test(u)) return q * 10
  if (/^(l|litre)$/.test(u) || u === 'l') return q * 1000
  if (/^(c\.?a\.?s|cas|cuillere.?a.?soupe)/.test(u)) return q * 15
  if (/^(c\.?a\.?c|cac|cuillere.?a.?cafe)/.test(u)) return q * 5
  if (/^(pce|pcs|piece|pi[eè]ce|unit[eé])/.test(u)) return q * pieceWeightGrams(nomIngr)
  return q
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10
}

export function macrosForQuantity(ingredient, quantite) {
  const grams = quantityToGrams(quantite, ingredient.unite, ingredient.nomIngr)
  const factor = grams / 100
  return {
    grams: round1(grams),
    kcal: round1((toNumber(ingredient.kcal100, 0) || 0) * factor),
    proteines: round1((toNumber(ingredient.proteines100, 0) || 0) * factor),
    glucides: round1((toNumber(ingredient.glucides100, 0) || 0) * factor),
    lipides: round1((toNumber(ingredient.lipides100, 0) || 0) * factor),
  }
}

export function sumMacros(items) {
  return items.reduce(
    (acc, m) => ({
      grams: round1(acc.grams + (m.grams || 0)),
      kcal: round1(acc.kcal + (m.kcal || 0)),
      proteines: round1(acc.proteines + (m.proteines || 0)),
      glucides: round1(acc.glucides + (m.glucides || 0)),
      lipides: round1(acc.lipides + (m.lipides || 0)),
    }),
    { grams: 0, kcal: 0, proteines: 0, glucides: 0, lipides: 0 },
  )
}

export function formatMacros(m) {
  if (!m) return ''
  return `${Math.round(m.kcal)} kcal · P ${m.proteines}g · G ${m.glucides}g · L ${m.lipides}g`
}

/** Quantité par défaut selon l'unité (évite 1 kg/pers par erreur). */
export function defaultQtyForUnit(unite) {
  const u = normalizeUnit(unite)
  if (/^(kg|kilo)/.test(u)) return 0.1
  if (/^(l|litre)$/.test(u) || u === 'l') return 0.1
  if (/^(cl|centilitre)/.test(u)) return 10
  if (/^(ml|millilitre)/.test(u)) return 100
  if (/^(pce|pcs|piece|pi[eè]ce)/.test(u)) return 1
  if (/^(g|gr|gramme)/.test(u) || !u) return 100
  if (/^(c\.?a\.?s|cas)/.test(u)) return 1
  if (/^(c\.?a\.?c|cac)/.test(u)) return 1
  return 1
}

/**
 * Convertit une quantité d'une unité source vers une unité cible.
 * Retourne null si la conversion est impossible (ex. g → pièce).
 */
export function convertQty(qty, fromUnit, toUnit, nomIngr = '') {
  if (fromUnit === toUnit) return toNumber(qty, 0)
  const fromG = quantityToGrams(qty, fromUnit, nomIngr)
  const u = normalizeUnit(toUnit)
  if (!u || /^(g|gr|gramme|grammes)$/.test(u)) return round1(fromG)
  if (/^(kg|kilo)/.test(u)) return round1(fromG / 1000)
  if (/^mg/.test(u)) return round1(fromG * 1000)
  if (/^(ml|millilitre)/.test(u)) return round1(fromG)
  if (/^(cl|centilitre)/.test(u)) return round1(fromG / 10)
  if (/^(l|litre)$/.test(u)) return round1(fromG / 1000)
  if (/^(c\.?a\.?s|cas|cuillere.?a.?soupe)/.test(u)) return round1(fromG / 15)
  if (/^(c\.?a\.?c|cac|cuillere.?a.?cafe)/.test(u)) return round1(fromG / 5)
  return null
}

export function isCatalogIngredient(ing) {
  if (!ing?.idIngr || !ing?.nomIngr) return false
  if (String(ing.categorie || '').trim()) return true
  if (String(ing.nutritionSource || '').trim()) return true
  return ['kcal100', 'proteines100', 'glucides100', 'lipides100'].some(
    (k) => String(ing[k] ?? '').trim() !== '',
  )
}
