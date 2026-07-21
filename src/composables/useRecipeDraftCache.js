/**
 * Brouillon local (localStorage) pour le formulaire d’ajout / édition de recette.
 * Effacé après enregistrement réussi.
 */
const PREFIX = 'bip-bouffe:recipe-draft:'

export function draftKey(editId) {
  return `${PREFIX}${editId || 'new'}`
}

export function readDraft(editId) {
  try {
    const raw = localStorage.getItem(draftKey(editId))
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return data
  } catch {
    return null
  }
}

export function writeDraft(editId, payload) {
  try {
    localStorage.setItem(
      draftKey(editId),
      JSON.stringify({
        ...payload,
        savedAt: Date.now(),
      }),
    )
  } catch {
    /* quota / private mode */
  }
}

export function clearDraft(editId) {
  try {
    localStorage.removeItem(draftKey(editId))
  } catch {
    /* ignore */
  }
}

export function draftHasContent(data) {
  if (!data) return false
  const form = data.form || {}
  if (String(form.nomRecette || '').trim()) return true
  if (String(form.mood || '').trim()) return true
  if (String(form.tps || '').trim()) return true
  if (String(form.imageUrl || '').trim()) return true
  if ((data.links || []).length) return true
  if ((data.stepsList || []).some((s) => String(s?.texte || '').trim())) return true
  if (Number(data.step) > 0) return true
  return false
}
