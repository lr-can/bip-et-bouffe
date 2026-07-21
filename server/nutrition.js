/**
 * Nutrition : Open Food Facts (prioritaire) + USDA + estimations locales.
 * Valeurs stockées pour 100 g (ou 100 ml).
 */

const USER_AGENT = 'BipEtBouffe/0.1 (https://github.com/lr-can/bip-et-bouffe)'

/** Estimations pour ingrédients cuisine courants (pour 100 g). */
const FALLBACKS = [
  { match: /farine/, kcal: 364, proteines: 10, glucides: 76, lipides: 1 },
  { match: /sucre/, kcal: 400, proteines: 0, glucides: 100, lipides: 0 },
  { match: /beurre/, kcal: 745, proteines: 0.7, glucides: 0.5, lipides: 82 },
  { match: /huile\s*(d['’])?olive|olive/, kcal: 884, proteines: 0, glucides: 0, lipides: 100 },
  { match: /huile/, kcal: 884, proteines: 0, glucides: 0, lipides: 100 },
  { match: /lait\b(?!ue)/, kcal: 46, proteines: 3.3, glucides: 4.8, lipides: 1.6 },
  { match: /cr[eè]me\s*(fra[iî]che|liquide)/, kcal: 292, proteines: 2.4, glucides: 3.2, lipides: 30 },
  { match: /\b[oœ]uf/, kcal: 140, proteines: 12.6, glucides: 0.8, lipides: 9.5 },
  { match: /fromage|emmental|comt[eé]|cheddar|mozarella|mozzarella/, kcal: 350, proteines: 25, glucides: 1, lipides: 27 },
  { match: /yaourt|yogourt/, kcal: 70, proteines: 4, glucides: 6, lipides: 3 },
  { match: /riz\b/, kcal: 350, proteines: 7, glucides: 78, lipides: 0.6 },
  { match: /p[aâ]tes|spaghetti|penne|nouille/, kcal: 350, proteines: 12, glucides: 71, lipides: 1.5 },
  { match: /pomme\s*de\s*terre|patate/, kcal: 77, proteines: 2, glucides: 17, lipides: 0.1 },
  { match: /tomate/, kcal: 18, proteines: 0.9, glucides: 3.9, lipides: 0.2 },
  { match: /oignon/, kcal: 40, proteines: 1.1, glucides: 9, lipides: 0.1 },
  { match: /ail/, kcal: 149, proteines: 6.4, glucides: 33, lipides: 0.5 },
  { match: /carotte/, kcal: 41, proteines: 0.9, glucides: 10, lipides: 0.2 },
  { match: /courgette/, kcal: 17, proteines: 1.2, glucides: 3.1, lipides: 0.3 },
  { match: /poulet|volaille/, kcal: 165, proteines: 31, glucides: 0, lipides: 3.6 },
  { match: /b[oœ]uf|steak|viande\s*hach[eée]/, kcal: 250, proteines: 26, glucides: 0, lipides: 17 },
  { match: /porc|jambon/, kcal: 145, proteines: 21, glucides: 1, lipides: 6 },
  { match: /saumon|poisson/, kcal: 180, proteines: 20, glucides: 0, lipides: 11 },
  { match: /pain|baguette/, kcal: 265, proteines: 9, glucides: 49, lipides: 3.2 },
  { match: /chocolat|nutella/, kcal: 545, proteines: 5, glucides: 60, lipides: 31 },
  { match: /banane/, kcal: 89, proteines: 1.1, glucides: 23, lipides: 0.3 },
  { match: /pomme\b(?!\s*de)/, kcal: 52, proteines: 0.3, glucides: 14, lipides: 0.2 },
  { match: /citron/, kcal: 29, proteines: 1.1, glucides: 9, lipides: 0.3 },
  { match: /sel|poivre|herbe|basilic|persil|thym|cumin|paprika/, kcal: 0, proteines: 0, glucides: 0, lipides: 0 },
]

const FR_TO_EN = [
  [/farine( de bl[eé])?/i, 'wheat flour'],
  [/sucre/i, 'sugar'],
  [/beurre/i, 'butter'],
  [/huile d['’]?olive/i, 'olive oil'],
  [/lait/i, 'milk'],
  [/[oœ]uf/i, 'egg'],
  [/riz/i, 'rice'],
  [/p[aâ]tes/i, 'pasta'],
  [/poulet/i, 'chicken'],
  [/tomate/i, 'tomato'],
  [/oignon/i, 'onion'],
  [/carotte/i, 'carrot'],
  [/pomme de terre|patate/i, 'potato'],
  [/fromage/i, 'cheese'],
  [/pain/i, 'bread'],
  [/yaourt/i, 'yogurt'],
]

const PIECE_GRAMS = [
  { match: /\boeufs?\b/i, g: 60 },
  { match: /feuilles?\s*de\s*brick/i, g: 20 },
  { match: /feuilles?\s*de\s*riz/i, g: 10 },
  { match: /wraps?/i, g: 60 },
  { match: /salade/i, g: 200 },
  { match: /concombre/i, g: 300 },
  { match: /avocat/i, g: 150 },
  { match: /kiwi/i, g: 80 },
  { match: /mangue/i, g: 350 },
  { match: /courgette/i, g: 200 },
  { match: /echalotte|[eé]chalotte/i, g: 30 },
  { match: /\bail\b/i, g: 5 },
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
  { match: /patate\s*douce|patates?\s*douces?/i, g: 200 },
]

function num(v, fallback = null) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

const CATEGORY_HINTS = [
  { match: /^beurre(\s|$)/i, categories: ['en:butters', 'en:dairy-butters'] },
  { match: /^farine/i, categories: ['en:flours', 'en:wheat-flours'] },
  { match: /^lait(\s|$)/i, categories: ['en:milks', 'en:cow-milks'] },
  { match: /^cr[eè]me/i, categories: ['en:creams'] },
  { match: /^huile/i, categories: ['en:vegetable-oils', 'en:olive-oils'] },
  { match: /^riz(\s|$)/i, categories: ['en:rices'] },
  { match: /^p[aâ]tes|^spaghetti|^penne/i, categories: ['en:pastas'] },
  { match: /^sucre/i, categories: ['en:sugars'] },
  { match: /^oeuf|^œuf/i, categories: ['en:eggs'] },
  { match: /^fromage/i, categories: ['en:cheeses'] },
  { match: /^yaourt|^yogourt/i, categories: ['en:yogurts'] },
  { match: /^tomate/i, categories: ['en:tomatoes'] },
  { match: /^oignon/i, categories: ['en:onions'] },
  { match: /^carotte/i, categories: ['en:carrots'] },
  { match: /^pomme\s*de\s*terre|^patate/i, categories: ['en:potatoes'] },
  { match: /^poulet/i, categories: ['en:chickens', 'en:poultries', 'en:cooked-chicken'] },
  { match: /^pain|^baguette/i, categories: ['en:breads'] },
]

/** Mots qui indiquent un produit composé, pas l’ingrédient brut. */
const COMPOUND_NOISE =
  /cacahuete|arachide|noisette|amande|cajou|coco|chocolat|cacao|biscuit|brioche|pain\b|gateau|gâteau|sauce|tartine|gache|gâche|pizza|nugget|cereale|céréale/

function scoreName(query, candidate) {
  const q = normalizeName(query)
  const c = normalizeName(candidate)
  if (!q || !c) return 0
  if (c === q) return 120

  const qTokens = q.split(/[\s,/()-]+/).filter((t) => t.length > 1)
  const cTokens = c.split(/[\s,/()-]+/).filter((t) => t.length > 1)
  if (!qTokens.length || !cTokens.length) return 0

  // Le nom produit doit contenir la requête comme suite de mots
  const qJoined = qTokens.join(' ')
  if (!c.includes(qJoined) && !qTokens.every((t) => cTokens.includes(t))) return 0

  // Produits composés (beurre de cacahuète, etc.)
  if (qTokens.length <= 2 && COMPOUND_NOISE.test(c.replace(qJoined, ' '))) return 0

  if (c === q || c.startsWith(`${qJoined} `) || c.startsWith(`${qJoined},`)) return 100
  if (cTokens[0] === qTokens[0] && qTokens.length === 1) {
    // « Beurre doux » ok ; « Beurre de X » déjà filtré si noise
    return 90
  }

  const hits = qTokens.filter((t) => cTokens.includes(t)).length
  const coverage = hits / qTokens.length
  if (coverage < 0.8) return 0

  let score = Math.round(coverage * 70)
  const extra = Math.max(0, cTokens.length - qTokens.length)
  score -= extra * 8
  if (hits === qTokens.length) score += 15
  return Math.max(0, score)
}

function englishQuery(name) {
  for (const [re, en] of FR_TO_EN) {
    if (re.test(name)) return en
  }
  return name
}

export function nutritionFromNutriments(nutriments = {}) {
  const kcal =
    num(nutriments['energy-kcal_100g']) ??
    (num(nutriments['energy_100g']) != null
      ? round1(num(nutriments['energy_100g']) / 4.184)
      : null)
  return {
    kcal100: kcal != null ? String(round1(kcal)) : '',
    proteines100: num(nutriments.proteins_100g) != null ? String(round1(nutriments.proteins_100g)) : '',
    glucides100:
      num(nutriments.carbohydrates_100g) != null
        ? String(round1(nutriments.carbohydrates_100g))
        : '',
    lipides100: num(nutriments.fat_100g) != null ? String(round1(nutriments.fat_100g)) : '',
  }
}

export function lookupFallback(name) {
  const n = normalizeName(name)
  for (const row of FALLBACKS) {
    if (row.match.test(n)) {
      return {
        kcal100: String(row.kcal),
        proteines100: String(row.proteines),
        glucides100: String(row.glucides),
        lipides100: String(row.lipides),
        nutritionSource: 'estimation',
        productName: name,
      }
    }
  }
  return null
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (text.trimStart().startsWith('<')) throw new Error('HTML response')
  return JSON.parse(text)
}

function rankProducts(query, products) {
  return (products || [])
    .filter((p) => {
      const n = p?.nutriments || {}
      return n['energy-kcal_100g'] != null || n.proteins_100g != null || n.fat_100g != null
    })
    .map((p) => {
      const nameScore = Math.max(
        scoreName(query, p.product_name || ''),
        scoreName(query, p.generic_name || ''),
      )
      const frBonus =
        Array.isArray(p.countries_tags) && p.countries_tags.includes('en:france') ? 5 : 0
      const completeness = Number(p.completeness || 0) * 5
      return { ...p, _score: nameScore + frBonus + completeness }
    })
    .filter((p) => p._score >= 30)
    .sort((a, b) => b._score - a._score)
}

function pickBestProduct(query, products) {
  return rankProducts(query, products)[0] || null
}

function toNutritionResult(product) {
  if (!product) return null
  const macros = nutritionFromNutriments(product.nutriments || {})
  if (!macros.kcal100 && !macros.proteines100) return null
  return {
    ...macros,
    nutritionSource: 'openfoodfacts',
    productName: [product.product_name, product.brands].filter(Boolean).join(' — '),
    barcode: product.code || '',
  }
}

/** Liste de résultats OFF pour la barre de recherche UI. */
export async function searchOpenFoodFactsList(query, limit = 8) {
  const q = String(query || '').trim()
  if (!q) return []

  const results = []
  const seen = new Set()

  const pushUnique = (item) => {
    if (!item) return
    const key = item.barcode || item.productName
    if (!key || seen.has(key)) return
    seen.add(key)
    results.push(item)
  }

  const hint = CATEGORY_HINTS.find((h) => h.match.test(q))
  if (hint) {
    try {
      for (const cat of hint.categories.slice(0, 2)) {
        const url = new URL('https://world.openfoodfacts.org/api/v2/search')
        url.searchParams.set('categories_tags', cat)
        url.searchParams.set('page_size', '20')
        url.searchParams.set(
          'fields',
          'product_name,generic_name,brands,nutriments,code,completeness,countries_tags',
        )
        const data = await fetchJson(url)
        for (const p of rankProducts(q, data.products).slice(0, limit)) {
          pushUnique(toNutritionResult(p))
          if (results.length >= limit) return results
        }
      }
    } catch {
      /* continue text search */
    }
  }

  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
  url.searchParams.set('search_terms', q)
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('action', 'process')
  url.searchParams.set('json', '1')
  url.searchParams.set('page_size', '40')
  url.searchParams.set(
    'fields',
    'product_name,generic_name,brands,nutriments,code,completeness,countries_tags',
  )

  try {
    const data = await fetchJson(url)
    for (const p of rankProducts(q, data.products)) {
      pushUnique(toNutritionResult(p))
      if (results.length >= limit) break
    }
  } catch {
    /* empty */
  }

  return results
}

async function searchOffByCategory(query, categories) {
  for (const cat of categories) {
    const url = new URL('https://world.openfoodfacts.org/api/v2/search')
    url.searchParams.set('categories_tags', cat)
    url.searchParams.set('page_size', '20')
    url.searchParams.set(
      'fields',
      'product_name,generic_name,brands,nutriments,code,completeness,countries_tags',
    )
    try {
      const data = await fetchJson(url)
      const best = pickBestProduct(query, data.products)
      const result = toNutritionResult(best)
      if (result) return result
      // Si aucun nom ne matche bien, prendre le 1er produit FR de la catégorie
      const frFirst = (data.products || []).find(
        (p) =>
          Array.isArray(p.countries_tags) &&
          p.countries_tags.includes('en:france') &&
          (p.nutriments?.['energy-kcal_100g'] != null || p.nutriments?.fat_100g != null),
      )
      const fallbackCat = toNutritionResult(frFirst || data.products?.[0])
      if (fallbackCat) return fallbackCat
    } catch {
      // try next category
    }
  }
  return null
}

/** Open Food Facts — recherche par nom (prioritaire). */
export async function searchOpenFoodFacts(query) {
  const q = String(query || '').trim()
  if (!q) return null

  // 1) Catégorie OFF si l’ingrédient est générique
  const hint = CATEGORY_HINTS.find((h) => h.match.test(q))
  if (hint) {
    const byCat = await searchOffByCategory(q, hint.categories)
    if (byCat) return byCat
  }

  // 2) Recherche texte, filtrée sur le nom produit
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
  url.searchParams.set('search_terms', q)
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('action', 'process')
  url.searchParams.set('json', '1')
  url.searchParams.set('page_size', '40')
  url.searchParams.set(
    'fields',
    'product_name,generic_name,brands,nutriments,code,completeness,countries_tags',
  )

  const data = await fetchJson(url)
  return toNutritionResult(pickBestProduct(q, data.products))
}

/** Open Food Facts par code-barres. */
export async function lookupOpenFoodFactsBarcode(barcode) {
  const code = String(barcode || '').replace(/\D/g, '')
  if (code.length < 8) return null
  const data = await fetchJson(
    `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments,code`,
  )
  if (data.status !== 1 || !data.product) return null
  const macros = nutritionFromNutriments(data.product.nutriments || {})
  if (!macros.kcal100 && !macros.proteines100) return null
  return {
    ...macros,
    nutritionSource: 'openfoodfacts',
    productName: [data.product.product_name, data.product.brands].filter(Boolean).join(' — '),
    barcode: data.code || code,
  }
}

/** USDA FoodData Central (secours). */
export async function searchUsda(query) {
  const q = englishQuery(String(query || '').trim())
  if (!q) return null
  const key = process.env.USDA_API_KEY || 'DEMO_KEY'
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
  url.searchParams.set('api_key', key)
  url.searchParams.set('query', q)
  url.searchParams.set('pageSize', '5')
  url.searchParams.set('dataType', 'Foundation,SR Legacy,Survey (FNDDS)')

  const data = await fetchJson(url)
  const foods = data.foods || []
  if (!foods.length) return null

  const best = foods[0]
  const nutrients = Object.fromEntries(
    (best.foodNutrients || []).map((n) => [n.nutrientName || n.nutrientNumber, n.value]),
  )
  const kcal =
    num(nutrients.Energy) ??
    num(nutrients['Energy (Atwater General Factors)']) ??
    num(nutrients['Energy (Atwater Specific Factors)'])
  const proteines = num(nutrients.Protein)
  const glucides =
    num(nutrients['Carbohydrate, by difference']) ?? num(nutrients.Carbohydrate)
  const lipides = num(nutrients['Total lipid (fat)']) ?? num(nutrients.Fat)

  if (kcal == null && proteines == null) return null
  return {
    kcal100: kcal != null ? String(round1(kcal)) : '',
    proteines100: proteines != null ? String(round1(proteines)) : '',
    glucides100: glucides != null ? String(round1(glucides)) : '',
    lipides100: lipides != null ? String(round1(lipides)) : '',
    nutritionSource: 'usda',
    productName: best.description || q,
  }
}

/**
 * Résolution nutrition : Open Food Facts (nom / barcode) en priorité.
 */
export async function resolveNutrition(name, { preferApi = true, barcode = '' } = {}) {
  if (barcode) {
    try {
      const byCode = await lookupOpenFoodFactsBarcode(barcode)
      if (byCode) return byCode
    } catch {
      // continue
    }
  }

  if (preferApi) {
    try {
      const off = await searchOpenFoodFacts(name)
      if (off) return off
    } catch {
      // continue
    }
    try {
      const usda = await searchUsda(name)
      if (usda) return usda
    } catch {
      // continue
    }
  }

  return lookupFallback(name)
}

export function pieceWeightGrams(name) {
  const n = normalizeName(name)
  for (const row of PIECE_GRAMS) {
    if (row.match.test(n)) return row.g
  }
  return 50
}

export function quantityToGrams(quantite, unite, nomIngr = '') {
  const q = Number(quantite) || 0
  const u = String(unite || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()

  if (!q) return 0
  if (!u || /^(g|gr|gramme|grammes)$/.test(u)) return q
  if (/^(kg|kilo)/.test(u)) return q * 1000
  if (/^mg/.test(u)) return q / 1000
  if (/^(ml|millilitre)/.test(u)) return q
  if (/^(cl|centilitre)/.test(u)) return q * 10
  if (/^(l|litre)$/.test(u) || u === 'l') return q * 1000
  if (/^(c\s*\.?\s*a\s*\.?\s*s|cas|cuillere\s*a\s*soupe)/.test(u)) return q * 15
  if (/^(c\s*\.?\s*a\s*\.?\s*c|cac|cuillere\s*a\s*cafe)/.test(u)) return q * 5
  if (/^(pce|pcs|piece|pi[eè]ce|unit[eé])/.test(u)) return q * pieceWeightGrams(nomIngr)
  return q
}

export function macrosForQuantity(ingredient, quantite) {
  const grams = quantityToGrams(quantite, ingredient.unite, ingredient.nomIngr)
  const factor = grams / 100
  return {
    grams: round1(grams),
    kcal: round1((Number(ingredient.kcal100) || 0) * factor),
    proteines: round1((Number(ingredient.proteines100) || 0) * factor),
    glucides: round1((Number(ingredient.glucides100) || 0) * factor),
    lipides: round1((Number(ingredient.lipides100) || 0) * factor),
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

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
