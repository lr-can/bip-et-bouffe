export function buildShoppingList(enrichedRecipes = []) {
  const map = new Map()

  for (const recipe of enrichedRecipes) {
    for (const ing of recipe.ingredients || []) {
      const key = ing.idIngr || ing.nomIngr
      if (!key) continue
      const existing = map.get(key)
      if (existing) {
        existing.quantite += ing.quantite || 0
        existing.cout += ing.cout || 0
        if (!existing.sources.includes(recipe.nomRecette)) {
          existing.sources.push(recipe.nomRecette)
        }
      } else {
        map.set(key, {
          idIngr: ing.idIngr,
          nomIngr: ing.nomIngr,
          unite: ing.unite || '',
          quantite: ing.quantite || 0,
          cout: ing.cout || 0,
          categorie: String(ing.categorie || '').trim() || 'Divers',
          sources: [recipe.nomRecette],
        })
      }
    }
  }

  return [...map.values()].sort((a, b) =>
    String(a.nomIngr).localeCompare(String(b.nomIngr), 'fr'),
  )
}

/** Groupe la liste de courses par catégorie (tri FR). */
export function groupShoppingByCategory(shoppingList = []) {
  const groups = new Map()
  for (const item of shoppingList) {
    const cat = String(item.categorie || '').trim() || 'Divers'
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat).push(item)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
    .map(([categorie, items]) => ({
      categorie,
      items: items
        .slice()
        .sort((a, b) => String(a.nomIngr).localeCompare(String(b.nomIngr), 'fr')),
    }))
}

export async function copyShoppingList(text) {
  if (!text) return false
  await navigator.clipboard.writeText(text)
  return true
}
