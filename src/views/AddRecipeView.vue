<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import AutoComplete from 'primevue/autocomplete'
import Steps from 'primevue/steps'
import Message from 'primevue/message'
import { useSheetsStore } from '@/stores/sheets'
import { useRecipesStore } from '@/stores/recipes'
import { sheetsApi } from '@/services/sheetsApi'
import { RECIPE_TYPES, fuzzyMatch, newId, toNumber } from '@/utils/recipe'
import {
  macrosForQuantity,
  formatMacros,
  defaultQtyForUnit,
  convertQty,
} from '@/utils/nutrition'

const UNIT_OPTIONS = [
  { label: 'g', value: 'g' },
  { label: 'kg', value: 'kg' },
  { label: 'mg', value: 'mg' },
  { label: 'L', value: 'l' },
  { label: 'cL', value: 'cl' },
  { label: 'mL', value: 'ml' },
  { label: 'pièce', value: 'pièce' },
  { label: 'CàS', value: 'CàS' },
  { label: 'Càc', value: 'Càc' },
]

const sheets = useSheetsStore()
const recipes = useRecipesStore()
const toast = useToast()
const router = useRouter()
const route = useRoute()

const editId = computed(() => route.params.id || null)
const isEdit = computed(() => Boolean(editId.value))
const loadingRecipe = ref(false)

const step = ref(0)
const stepItems = [
  { label: 'Infos' },
  { label: 'Ingrédients' },
  { label: 'Étapes' },
  { label: 'Récap' },
]

const form = reactive({
  nomRecette: '',
  type: 'plat',
  mood: '',
  difficulte: 'facile',
  tps: '',
  nbPerso: 4,
  allergie: '',
  imageUrl: '',
})

const difficulteOptions = [
  { label: 'Facile', value: 'facile' },
  { label: 'Moyen', value: 'moyen' },
  { label: 'Difficile', value: 'difficile' },
]

const links = ref([])
const stepsList = ref([{ texte: '', ordre: 1 }])
const ingredientQuery = ref(null)
const ingredientSuggestions = ref([])
const showNewIngredient = ref(false)
const lookingUp = ref(false)
const savingCatalog = ref(false)
const nutritionPreview = ref(null)
const catalogFilter = ref('')
const openCategories = ref({})
const newIngredient = reactive({
  nomIngr: '',
  unite: 'g',
  prixUnitaire: 0,
  saison: 'toute',
  idAllergie: null,
  categorie: '',
})

const allergenSelectOptions = computed(() => [
  { label: 'Aucune', value: null },
  ...recipes.allergenOptions.map((a) => ({
    label: a.nomAllergie,
    value: a.idAllergie,
  })),
])

/** Allergies recette = liste issue de la feuille allergenes */
const recipeAllergyOptions = computed(() =>
  recipes.allergenOptions.map((a) => ({
    label: a.nomAllergie,
    value: a.nomAllergie,
  })),
)

const selectedRecipeAllergies = computed({
  get() {
    return String(form.allergie || '')
      .split(/[,;/|]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  },
  set(values) {
    form.allergie = (values || []).join(', ')
  },
})

const categorySelectOptions = computed(() => {
  const fromData = recipes.categoryOptions
  const extras = [
    'Produits laitiers',
    'Fromage',
    'Œuf',
    'Féculents & Céréales',
    'Légumes',
    'Fruits',
    'Légumineuses',
    'Viande',
    'Poisson & Fruits de mer',
    'Fruits secs & Oléagineux',
    'Matières grasses',
    'Épicerie sucrée & Pâtisserie',
    'Condiments & Sauces',
    'Épices & Aromates',
    'Boissons végétales',
    'Vins & Alcools',
  ]
  return [...new Set([...fromData, ...extras])].sort((a, b) => a.localeCompare(b, 'fr'))
})

const catalogCount = computed(() => recipes.catalogIngredients.length)

const nestedCatalog = computed(() => {
  const selected = new Set(links.value.map((l) => l.idIngr))
  const q = catalogFilter.value
  return recipes.catalogByCategory
    .map((group) => ({
      name: group.name,
      items: group.items.filter(
        (i) => !selected.has(i.idIngr) && (!q || fuzzyMatch(i.nomIngr, q) || fuzzyMatch(group.name, q)),
      ),
    }))
    .filter((g) => g.items.length > 0)
})

const recipeMacrosPreview = computed(() => {
  const parts = links.value.map((l) =>
    macrosForQuantity(l, Number(l.qteParPersonne) || 0),
  )
  const perPerson = parts.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      proteines: acc.proteines + m.proteines,
      glucides: acc.glucides + m.glucides,
      lipides: acc.lipides + m.lipides,
    }),
    { kcal: 0, proteines: 0, glucides: 0, lipides: 0 },
  )
  const n = Number(form.nbPerso) || 1
  const r = (v) => Math.round(v * 10) / 10
  return {
    perPerson: {
      kcal: r(perPerson.kcal),
      proteines: r(perPerson.proteines),
      glucides: r(perPerson.glucides),
      lipides: r(perPerson.lipides),
    },
    total: {
      kcal: r(perPerson.kcal * n),
      proteines: r(perPerson.proteines * n),
      glucides: r(perPerson.glucides * n),
      lipides: r(perPerson.lipides * n),
    },
  }
})

/** qteTotal = quantité saisie pour nbPerso personnes → retourne qteParPersonne */
function totalToPerPers(total) {
  const n = Number(form.nbPerso) || 1
  return Math.round((total / n) * 1000) / 1000
}

function perPersToTotal(link) {
  const n = Number(form.nbPerso) || 1
  return Math.round(Number(link.qteParPersonne) * n * 1000) / 1000
}

function onTotalChange(link, newTotal) {
  link.qteParPersonne = totalToPerPers(newTotal)
}

function changeUnit(link, newUnit) {
  const converted = convertQty(link.qteParPersonne, link.unite, newUnit, link.nomIngr)
  link.unite = newUnit
  if (converted !== null) {
    link.qteParPersonne = converted
  }
}

const suggestions = computed(() => {
  const selected = new Set(links.value.map((l) => l.idIngr))
  return recipes
    .suggestedIngredients({
      type: form.type,
      mood: form.mood,
      limit: 10,
    })
    .filter((ing) => !selected.has(ing.idIngr))
})

const canNext = computed(() => {
  if (step.value === 0) return Boolean(form.nomRecette.trim() && form.type)
  if (step.value === 1) return links.value.length > 0
  if (step.value === 2) return stepsList.value.some((s) => s.texte.trim())
  return true
})

function macrosLabel(ing) {
  if (!ing) return ''
  const kcal = Number(ing.kcal100)
  const hasAny =
    String(ing.kcal100 ?? '').trim() !== '' ||
    String(ing.proteines100 ?? '').trim() !== '' ||
    String(ing.nutritionSource || '').trim()
  if (!hasAny) return ''
  return `${Math.round(kcal || 0)} kcal/100g · P${ing.proteines100 || 0} G${ing.glucides100 || 0} L${ing.lipides100 || 0}`
}

function linkMacros(link) {
  return macrosForQuantity(link, Number(link.qteParPersonne) || 0)
}

function toggleCategory(name) {
  openCategories.value = {
    ...openCategories.value,
    [name]: !openCategories.value[name],
  }
}

function ensureCategoriesOpen() {
  if (catalogFilter.value.trim()) {
    const next = { ...openCategories.value }
    for (const g of nestedCatalog.value) next[g.name] = true
    openCategories.value = next
  }
}

watch(catalogFilter, () => ensureCategoriesOpen())

function searchIngredients(event) {
  const q = event.query || ''
  const selected = new Set(links.value.map((l) => l.idIngr))
  ingredientSuggestions.value = recipes.catalogIngredients
    .filter((i) => !selected.has(i.idIngr) && fuzzyMatch(i.nomIngr, q))
    .slice(0, 20)
}

function addExistingIngredient(ing) {
  if (!ing?.idIngr) return
  if (links.value.some((l) => l.idIngr === ing.idIngr)) return
  links.value.push({
    idIngr: ing.idIngr,
    nomIngr: ing.nomIngr,
    unite: ing.unite,
    categorie: ing.categorie || '',
    idAllergie: ing.idAllergie || '',
    nomAllergie: recipes.allergenName(ing.idAllergie),
    kcal100: ing.kcal100 || '',
    proteines100: ing.proteines100 || '',
    glucides100: ing.glucides100 || '',
    lipides100: ing.lipides100 || '',
    nutritionSource: ing.nutritionSource || '',
    qteParPersonne: defaultQtyForUnit(ing.unite),
    isNew: false,
  })
  ingredientQuery.value = null
}

function addSuggested(ing) {
  addExistingIngredient(ing)
}

async function lookupCatalogNutrition() {
  const nomIngr = newIngredient.nomIngr.trim()
  if (!nomIngr) return
  lookingUp.value = true
  nutritionPreview.value = null
  try {
    const looked = await sheetsApi.lookupNutrition(nomIngr)
    if (!looked?.found) {
      toast.add({
        severity: 'warn',
        summary: 'Introuvable',
        detail: 'Pas de macros trouvées pour ce nom — essaie un autre libellé.',
        life: 3500,
      })
      return
    }
    nutritionPreview.value = looked
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: err.message || 'Recherche nutrition impossible',
      life: 3500,
    })
  } finally {
    lookingUp.value = false
  }
}

async function addToCatalogAndRecipe() {
  const nomIngr = newIngredient.nomIngr.trim()
  if (!nomIngr) return
  if (!nutritionPreview.value?.found) {
    await lookupCatalogNutrition()
    if (!nutritionPreview.value?.found) return
  }

  savingCatalog.value = true
  try {
    const idAllergie = newIngredient.idAllergie || ''
    const nutrition = {
      kcal100: nutritionPreview.value.kcal100 || '',
      proteines100: nutritionPreview.value.proteines100 || '',
      glucides100: nutritionPreview.value.glucides100 || '',
      lipides100: nutritionPreview.value.lipides100 || '',
      nutritionSource: nutritionPreview.value.nutritionSource || '',
    }
    const idIngr = newId('ing')
    await sheets.addRow('ingredients', {
      idIngr,
      nomIngr,
      unite: newIngredient.unite || 'g',
      prixUnitaire: String(newIngredient.prixUnitaire ?? 0),
      saison: newIngredient.saison || 'toute',
      idAllergie,
      categorie: newIngredient.categorie || '',
      ...nutrition,
    })
    addExistingIngredient({
      idIngr,
      nomIngr,
      unite: newIngredient.unite || 'g',
      idAllergie,
      categorie: newIngredient.categorie || '',
      ...nutrition,
    })
    Object.assign(newIngredient, {
      nomIngr: '',
      unite: 'g',
      prixUnitaire: 0,
      saison: 'toute',
      idAllergie: null,
      categorie: '',
    })
    nutritionPreview.value = null
    showNewIngredient.value = false
    toast.add({
      severity: 'success',
      summary: 'Ajouté au catalogue',
      detail: `${nomIngr} · ${macrosLabel(nutrition)}`,
      life: 2800,
    })
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: err.message || 'Impossible d’enregistrer',
      life: 3500,
    })
  } finally {
    savingCatalog.value = false
  }
}

function removeLink(idIngr) {
  links.value = links.value.filter((l) => l.idIngr !== idIngr)
}

function addStep() {
  stepsList.value.push({ texte: '', ordre: stepsList.value.length + 1 })
}

function removeStep(index) {
  stepsList.value.splice(index, 1)
  reindexSteps()
}

function moveStep(index, dir) {
  const target = index + dir
  if (target < 0 || target >= stepsList.value.length) return
  const copy = stepsList.value.slice()
  const [item] = copy.splice(index, 1)
  copy.splice(target, 0, item)
  stepsList.value = copy
  reindexSteps()
}

function reindexSteps() {
  stepsList.value.forEach((s, i) => {
    s.ordre = i + 1
  })
}

function next() {
  if (!canNext.value) return
  step.value = Math.min(step.value + 1, 3)
}

function prev() {
  step.value = Math.max(step.value - 1, 0)
}

async function submit() {
  const idRecette = isEdit.value ? editId.value : newId('rec')
  const fromIngredients = [
    ...new Set(links.value.map((l) => l.nomAllergie || recipes.allergenName(l.idAllergie)).filter(Boolean)),
  ]
  const allergieManual = form.allergie.trim()
  const allergie = allergieManual
    || fromIngredients.join(', ')

  const recipe = {
    idRecette,
    nomRecette: form.nomRecette.trim(),
    type: form.type,
    mood: form.mood.trim(),
    difficulte: form.difficulte,
    tps: form.tps.trim(),
    nbPerso: String(form.nbPerso || 2),
    allergie,
    imageUrl: form.imageUrl.trim(),
  }

  const newIngredients = links.value
    .filter((l) => l.isNew)
    .map((l) => ({
      idIngr: l.idIngr,
      nomIngr: l.nomIngr,
      unite: l.unite || '',
      prixUnitaire: String(l.prixUnitaire ?? 0),
      saison: l.saison || 'toute',
      idAllergie: l.idAllergie || '',
      kcal100: l.kcal100 || '',
      proteines100: l.proteines100 || '',
      glucides100: l.glucides100 || '',
      lipides100: l.lipides100 || '',
      nutritionSource: l.nutritionSource || '',
      categorie: l.categorie || '',
    }))

  const payloadLinks = links.value.map((l) => ({
    idIngr: l.idIngr,
    idRecette,
    qteParPersonne: String(l.qteParPersonne ?? 0),
  }))

  const payloadSteps = stepsList.value
    .filter((s) => s.texte.trim())
    .map((s, i) => ({
      idEtape: s.idEtape || newId('etp'),
      idRecette,
      texte: s.texte.trim(),
      ordre: String(i + 1),
    }))

  try {
    if (isEdit.value) {
      await sheets.updateRecipe(idRecette, {
        recipe,
        newIngredients,
        links: payloadLinks,
        steps: payloadSteps,
      })
      toast.add({
        severity: 'success',
        summary: 'Recette mise à jour',
        detail: 'Modifications enregistrées',
        life: 3000,
      })
    } else {
      await sheets.createRecipe({
        recipe,
        newIngredients,
        links: payloadLinks,
        steps: payloadSteps,
      })
      toast.add({
        severity: 'success',
        summary: 'Recette ajoutée',
        detail: 'Recette enregistrée',
        life: 3000,
      })
    }
    router.push(`/recette/${idRecette}`)
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible d’enregistrer. Réessaie dans un instant.',
      life: 4200,
    })
  }
}

function loadRecipeForEdit(id) {
  const enriched = recipes.enriched(id)
  if (!enriched) return false
  Object.assign(form, {
    nomRecette: enriched.nomRecette || '',
    type: enriched.type || 'plat',
    mood: enriched.mood || '',
    difficulte: enriched.difficulte || 'facile',
    tps: enriched.tps || '',
    nbPerso: toNumber(enriched.nbPerso, 4) || 4,
    allergie: enriched.allergie || '',
    imageUrl: enriched.imageUrl || '',
  })
  links.value = (enriched.ingredients || []).map((ing) => ({
    idIngr: ing.idIngr,
    nomIngr: ing.nomIngr,
    unite: ing.unite,
    categorie: ing.categorie || '',
    idAllergie: ing.idAllergie || '',
    nomAllergie: ing.nomAllergie || recipes.allergenName(ing.idAllergie),
    kcal100: ing.kcal100 || '',
    proteines100: ing.proteines100 || '',
    glucides100: ing.glucides100 || '',
    lipides100: ing.lipides100 || '',
    nutritionSource: ing.nutritionSource || '',
    qteParPersonne: toNumber(ing.qteParPersonne, 1) || 1,
    isNew: false,
  }))
  stepsList.value = (enriched.etapes || []).length
    ? enriched.etapes.map((e, i) => ({
        idEtape: e.idEtape,
        texte: e.texte || '',
        ordre: toNumber(e.ordre, i + 1) || i + 1,
      }))
    : [{ texte: '', ordre: 1 }]
  return true
}

async function bootstrap() {
  loadingRecipe.value = true
  try {
    await sheets.ensureLoaded()
    const next = {}
    for (const g of recipes.catalogByCategory.slice(0, 2)) next[g.name] = true
    openCategories.value = next
    if (isEdit.value) {
      const ok = loadRecipeForEdit(editId.value)
      if (!ok) {
        toast.add({
          severity: 'warn',
          summary: 'Introuvable',
          detail: 'Cette recette n’existe plus.',
          life: 3000,
        })
        router.replace('/gerer')
      }
    }
  } catch {
    /* message store */
  } finally {
    loadingRecipe.value = false
  }
}

watch(
  () => route.params.id,
  () => {
    step.value = 0
    if (!isEdit.value) {
      Object.assign(form, {
        nomRecette: '',
        type: 'plat',
        mood: '',
        difficulte: 'facile',
        tps: '',
        nbPerso: 4,
        allergie: '',
        imageUrl: '',
      })
      links.value = []
      stepsList.value = [{ texte: '', ordre: 1 }]
    }
    bootstrap()
  },
)

onMounted(bootstrap)
</script>

<template>
  <section class="cm-shell page">
    <header class="head cm-rise">
      <div>
        <p class="eyebrow">{{ isEdit ? 'Modification' : 'Nouveau plat' }}</p>
        <h1 class="cm-display cm-grad-text">
          {{ isEdit ? 'Modifier la recette' : 'Ajouter une recette' }}
        </h1>
      </div>
    </header>

    <Message v-if="sheets.error" severity="error">
      Impossible de charger les données. Réessaie dans un instant.
    </Message>

    <div v-if="loadingRecipe" class="loading-edit">
      <span>Chargement…</span>
    </div>

    <template v-else>
    <Steps :model="stepItems" :activeStep="step" class="steps cm-rise" />

    <div class="panel cm-rise cm-rise-delay-1">
      <div v-if="step === 0" class="form">
        <div class="field">
          <label>Nom</label>
          <InputText v-model="form.nomRecette" fluid placeholder="Ex. Tarte citron" />
        </div>
        <div class="grid-2">
          <div class="field">
            <label>Type</label>
            <Select v-model="form.type" :options="RECIPE_TYPES" optionLabel="label" optionValue="value" fluid />
          </div>
          <div class="field">
            <label>Difficulté</label>
            <Select v-model="form.difficulte" :options="difficulteOptions" optionLabel="label" optionValue="value" fluid />
          </div>
        </div>
        <div class="grid-3">
          <div class="field">
            <label>Ambiance</label>
            <InputText v-model="form.mood" fluid placeholder="Ex. cosy, été…" list="mood-list" />
            <datalist id="mood-list">
              <option v-for="m in recipes.moods" :key="m" :value="m" />
            </datalist>
          </div>
          <div class="field">
            <label>Temps</label>
            <InputText v-model="form.tps" fluid placeholder="Ex. 35 min" />
          </div>
          <div class="field">
            <label>Pers. de référence</label>
            <InputNumber v-model="form.nbPerso" :min="1" :max="30" fluid />
          </div>
        </div>
        <div class="field">
          <label>Allergies (feuille allergènes)</label>
          <MultiSelect
            v-model="selectedRecipeAllergies"
            :options="recipeAllergyOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Choisir dans la liste…"
            display="chip"
            filter
            showClear
            fluid
          />
          <p class="hint" style="margin-top: 0.35rem">
            Complété aussi automatiquement via les allergènes des ingrédients.
          </p>
        </div>
        <div class="field">
          <label>Image URL (optionnel)</label>
          <InputText v-model="form.imageUrl" fluid placeholder="https://…" />
        </div>
      </div>

      <div v-else-if="step === 1" class="form">
        <p class="catalog-hint">
          Catalogue ({{ catalogCount }}) — choisis par catégorie. Les quantités sont
          <strong>par personne</strong> ; les kcal s’ajustent automatiquement (pour 100&nbsp;g de référence).
        </p>

        <div class="field">
          <label>Filtrer le catalogue</label>
          <InputText v-model="catalogFilter" fluid placeholder="Ex. fromage, poulet, tomate…" />
        </div>

        <div class="nested-catalog">
          <div v-for="group in nestedCatalog" :key="group.name" class="cat-block">
            <button type="button" class="cat-head" @click="toggleCategory(group.name)">
              <i class="pi" :class="openCategories[group.name] ? 'pi-chevron-down' : 'pi-chevron-right'" />
              <span>{{ group.name }}</span>
              <span class="cat-count">{{ group.items.length }}</span>
            </button>
            <ul v-show="openCategories[group.name]" class="cat-list">
              <li v-for="ing in group.items" :key="ing.idIngr">
                <button type="button" class="cat-item" @click="addExistingIngredient(ing)">
                  <span class="cat-item-name">{{ ing.nomIngr }}</span>
                  <span class="cat-item-meta">{{ ing.unite }} · {{ macrosLabel(ing) }}</span>
                </button>
              </li>
            </ul>
          </div>
          <p v-if="!nestedCatalog.length" class="empty-links">Aucun ingrédient trouvé.</p>
        </div>

        <div class="field" style="margin-top: 1rem">
          <label>Recherche rapide</label>
          <AutoComplete
            v-model="ingredientQuery"
            optionLabel="nomIngr"
            :suggestions="ingredientSuggestions"
            placeholder="Tape un nom…"
            forceSelection
            dropdown
            fluid
            @complete="searchIngredients"
            @item-select="(e) => addExistingIngredient(e.value)"
          >
            <template #option="{ option }">
              <div class="ing-option">
                <div class="ing-option-top">
                  <strong>{{ option.nomIngr }}</strong>
                  <span class="ing-unit">{{ option.categorie || option.unite }}</span>
                </div>
                <span class="ing-macros">{{ macrosLabel(option) }}</span>
              </div>
            </template>
          </AutoComplete>
        </div>

        <div v-if="suggestions.length" class="suggestions">
          <p class="hint">Suggestions (même type / ambiance)</p>
          <div class="chips">
            <button
              v-for="ing in suggestions"
              :key="ing.idIngr"
              type="button"
              class="suggest"
              @click="addSuggested(ing)"
            >
              {{ ing.nomIngr }}
              <small v-if="ing.kcal100 !== '' && ing.kcal100 != null">
                {{ Math.round(Number(ing.kcal100) || 0) }} kcal/100g
              </small>
            </button>
          </div>
        </div>

        <p class="hint" style="margin-bottom:0.2rem">
          Saisir les quantités <strong>pour {{ form.nbPerso }} personne{{ form.nbPerso > 1 ? 's' : '' }}</strong> — la quantité par personne est calculée automatiquement.
        </p>
        <div class="links">
          <div v-for="link in links" :key="link.idIngr" class="link-row">
            <div class="link-info">
              <strong>{{ link.nomIngr }}</strong>
              <span class="muted">
                <template v-if="link.categorie">{{ link.categorie }}</template>
                <template v-if="link.nomAllergie"> · ⚠ {{ link.nomAllergie }}</template>
              </span>
              <span class="ing-macros">
                {{ formatMacros(linkMacros(link)) }}
                <span class="muted"> / pers</span>
              </span>
            </div>
            <div class="link-actions">
              <InputNumber
                :modelValue="perPersToTotal(link)"
                :min="0"
                :minFractionDigits="0"
                :maxFractionDigits="3"
                :step="['kg','l','cl'].includes(link.unite) ? 0.05 : 1"
                :placeholder="`${form.nbPerso} pers.`"
                class="qty-input"
                @update:modelValue="(v) => onTotalChange(link, v)"
              />
              <Select
                :modelValue="link.unite"
                :options="UNIT_OPTIONS"
                optionLabel="label"
                optionValue="value"
                class="unit-select"
                @update:modelValue="(v) => changeUnit(link, v)"
              />
              <Button icon="pi pi-trash" rounded text severity="danger" @click="removeLink(link.idIngr)" />
            </div>
          </div>
          <p v-if="!links.length" class="empty-links">Aucun ingrédient pour l'instant.</p>
        </div>

        <div v-if="links.length" class="nutrition-preview recipe-macros">
          <strong>Estimation nutrition</strong>
          <span>
            / pers : {{ formatMacros(recipeMacrosPreview.perPerson) }}
          </span>
          <span>
            total ({{ form.nbPerso }} pers.) : {{ formatMacros(recipeMacrosPreview.total) }}
          </span>
        </div>

        <Button
          v-if="!showNewIngredient"
          label="Ajouter un produit au catalogue"
          icon="pi pi-plus"
          text
          @click="showNewIngredient = true"
        />

        <div v-else class="new-ing">
          <p class="hint">
            Recherche macros (Open Food Facts) → enregistrement catalogue → ajout à la recette.
          </p>
          <div class="grid-2">
            <div class="field">
              <label>Nom</label>
              <InputText
                v-model="newIngredient.nomIngr"
                fluid
                placeholder="Ex. Farine T55"
                @keyup.enter="lookupCatalogNutrition"
              />
            </div>
            <div class="field">
              <label>Catégorie</label>
              <Select
                v-model="newIngredient.categorie"
                :options="categorySelectOptions"
                placeholder="Choisir…"
                editable
                fluid
              />
            </div>
            <div class="field">
              <label>Unité</label>
              <Select v-model="newIngredient.unite" :options="UNIT_OPTIONS" optionLabel="label" optionValue="value" editable fluid placeholder="g, kg, CàS…" />            </div>
            <div class="field">
              <label>Prix unitaire</label>
              <InputNumber
                v-model="newIngredient.prixUnitaire"
                mode="decimal"
                :minFractionDigits="0"
                :maxFractionDigits="4"
                fluid
              />
            </div>
            <div class="field">
              <label>Saison</label>
              <InputText v-model="newIngredient.saison" fluid placeholder="toute, été…" />
            </div>
            <div class="field">
              <label>Type d’allergie</label>
              <Select
                v-model="newIngredient.idAllergie"
                :options="allergenSelectOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Aucune"
                showClear
                fluid
              />
            </div>
          </div>

          <div v-if="nutritionPreview?.found" class="nutrition-preview">
            <strong>{{ nutritionPreview.productName || newIngredient.nomIngr }}</strong>
            <span>{{ macrosLabel(nutritionPreview) }}</span>
            <span class="muted">source : {{ nutritionPreview.nutritionSource }}</span>
          </div>

          <div class="new-ing-actions">
            <Button
              label="Chercher les macros"
              outlined
              rounded
              :loading="lookingUp"
              @click="lookupCatalogNutrition"
            />
            <Button
              label="Enregistrer et ajouter"
              class="cm-btn-cool"
              rounded
              :loading="savingCatalog"
              :disabled="!nutritionPreview?.found"
              @click="addToCatalogAndRecipe"
            />
            <Button
              label="Annuler"
              text
              severity="secondary"
              @click=";(showNewIngredient = false), (nutritionPreview = null)"
            />
          </div>
        </div>
      </div>

      <div v-else-if="step === 2" class="form">
        <div v-for="(etape, index) in stepsList" :key="index" class="step-row">
          <span class="ordre">{{ index + 1 }}</span>
          <Textarea v-model="etape.texte" rows="2" autoResize class="w-full" placeholder="Décris l’étape…" />
          <div class="step-actions">
            <Button icon="pi pi-arrow-up" rounded text :disabled="index === 0" @click="moveStep(index, -1)" />
            <Button icon="pi pi-arrow-down" rounded text :disabled="index === stepsList.length - 1" @click="moveStep(index, 1)" />
            <Button icon="pi pi-trash" rounded text severity="danger" :disabled="stepsList.length === 1" @click="removeStep(index)" />
          </div>
        </div>
        <Button label="Ajouter une étape" icon="pi pi-plus" outlined rounded @click="addStep" />
      </div>

      <div v-else class="recap">
        <h2 class="cm-display">{{ form.nomRecette }}</h2>
        <p class="muted">
          {{ RECIPE_TYPES.find((t) => t.value === form.type)?.label }}
          · {{ form.mood || 'sans ambiance' }}
          · {{ form.difficulte }}
          · {{ form.tps || 'temps —' }}
        </p>
        <h3>Ingrédients ({{ links.length }})</h3>
        <ul>
          <li v-for="l in links" :key="l.idIngr">
            {{ l.nomIngr }} — {{ l.qteParPersonne }} {{ l.unite }}/pers
            <span v-if="l.nomAllergie" class="muted"> ({{ l.nomAllergie }})</span>
            <span v-if="macrosLabel(l)" class="muted"> · {{ macrosLabel(l) }}</span>
          </li>
        </ul>
        <h3>Étapes ({{ stepsList.filter((s) => s.texte.trim()).length }})</h3>
        <ol>
          <li v-for="(s, i) in stepsList.filter((x) => x.texte.trim())" :key="i">{{ s.texte }}</li>
        </ol>
      </div>
    </div>

    <div class="footer-actions">
      <Button v-if="step > 0" label="Retour" text severity="secondary" @click="prev" />
      <div class="spacer" />
      <Button
        v-if="step < 3"
        label="Continuer"
        class="cm-btn-warm"
        rounded
        :disabled="!canNext"
        @click="next"
      />
      <Button
        v-else
        :label="isEdit ? 'Enregistrer' : 'Enregistrer'"
        icon="pi pi-check"
        class="cm-btn-cool"
        rounded
        :loading="sheets.saving"
        @click="submit"
      />
    </div>
    </template>
  </section>
</template>

<style scoped>
.loading-edit {
  padding: 2rem;
  text-align: center;
  color: var(--cm-muted);
}

.page {
  padding-top: 1.5rem;
  padding-bottom: 2rem;
}

.head {
  margin-bottom: 1rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--cm-muted);
}

h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3rem);
}

.steps {
  margin-bottom: 1rem;
}

.panel {
  padding: 1.2rem;
  border-radius: 1.15rem;
  border: 1px solid var(--cm-border);
  background: var(--cm-surface);
}

.form {
  display: grid;
  gap: 0.95rem;
}

.field {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.field label {
  font-size: 0.82rem;
  font-weight: 600;
}

.grid-2,
.grid-3 {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}

.grid-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.grid-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/* PrimeVue : forcer la largeur des composants imbriqués */
.field :deep(.p-inputtext),
.field :deep(.p-select),
.field :deep(.p-autocomplete),
.field :deep(.p-inputnumber),
.field :deep(.p-inputnumber-input) {
  width: 100%;
}

.field :deep(.p-inputnumber) {
  display: flex;
}

.hint,
.muted {
  color: var(--cm-muted);
  margin: 0;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.45rem;
}

.suggest {
  border: 1px solid var(--cm-border);
  background: transparent;
  color: var(--cm-text);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.suggest small {
  font-weight: 600;
  color: var(--cm-muted);
  font-size: 0.75rem;
}

.catalog-hint {
  margin: 0 0 0.75rem;
  color: var(--cm-muted);
  font-size: 0.92rem;
}

.nested-catalog {
  display: grid;
  gap: 0.35rem;
  max-height: 22rem;
  overflow: auto;
  padding: 0.35rem;
  border: 1px solid var(--cm-border);
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--cm-bg) 45%, transparent);
}

.cat-block {
  border-bottom: 1px solid color-mix(in srgb, var(--cm-border) 70%, transparent);
}

.cat-block:last-child {
  border-bottom: 0;
}

.cat-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border: 0;
  background: transparent;
  color: var(--cm-text);
  font-weight: 700;
  padding: 0.55rem 0.45rem;
  cursor: pointer;
  text-align: left;
}

.cat-count {
  margin-left: auto;
  font-size: 0.78rem;
  color: var(--cm-muted);
  font-weight: 600;
}

.cat-list {
  list-style: none;
  margin: 0 0 0.45rem;
  padding: 0 0.25rem 0.35rem 1.5rem;
  display: grid;
  gap: 0.2rem;
}

.cat-item {
  width: 100%;
  display: grid;
  gap: 0.1rem;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 0.4rem 0.45rem;
  border-radius: 0.55rem;
  cursor: pointer;
}

.cat-item:hover {
  background: color-mix(in srgb, var(--cm-warm, #e8a87c) 12%, transparent);
}

.cat-item-name {
  font-weight: 650;
}

.cat-item-meta {
  font-size: 0.75rem;
  color: var(--cm-muted);
}

.qty-unit {
  font-size: 0.82rem;
  color: var(--cm-muted);
  min-width: 1.5rem;
}

.unit-select {
  width: 6rem;
  flex-shrink: 0;
}

.unit-select :deep(.p-select) {
  width: 100%;
}

.link-info {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 0.1rem;
}

.recipe-macros {
  margin-top: 0.75rem;
}

.ing-option {
  display: grid;
  gap: 0.15rem;
  padding: 0.15rem 0;
}

.ing-option-top {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.ing-unit {
  color: var(--cm-muted);
  font-size: 0.85rem;
}

.ing-macros {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.78rem;
  color: var(--cm-muted);
  font-weight: 600;
}

.empty-links {
  margin: 0.5rem 0 0;
  color: var(--cm-muted);
}

.nutrition-preview {
  display: grid;
  gap: 0.2rem;
  padding: 0.75rem 0.9rem;
  border-radius: 0.75rem;
  border: 1px solid var(--cm-border);
  background: color-mix(in srgb, var(--cm-bg) 50%, transparent);
}

.links {
  display: grid;
  gap: 0.55rem;
}

.link-row,
.step-row {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
}

.link-row {
  justify-content: space-between;
  align-items: center;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--cm-border);
  gap: 0.85rem;
}

.link-row > div:first-child {
  min-width: 0;
  flex: 1;
}

.link-actions,
.step-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.qty-input {
  width: 7.5rem;
}

.qty-input :deep(.p-inputnumber),
.qty-input :deep(.p-inputnumber-input) {
  width: 100%;
}

.ordre {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-weight: 700;
  background: var(--cm-grad-warm);
  color: #fff;
  flex-shrink: 0;
  margin-top: 0.35rem;
}

.new-ing {
  padding: 1rem;
  border-radius: 0.9rem;
  border: 1px dashed var(--cm-border);
  display: grid;
  gap: 0.9rem;
}

.new-ing-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.recap h2 {
  margin: 0 0 0.35rem;
}

.recap h3 {
  margin: 1rem 0 0.4rem;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.spacer {
  flex: 1;
}

@media (max-width: 720px) {
  .grid-2,
  .grid-3 {
    grid-template-columns: 1fr;
  }

  .link-row {
    flex-direction: column;
    align-items: stretch;
  }

  .link-actions {
    justify-content: space-between;
  }

  .qty-input {
    width: 100%;
    flex: 1;
  }

  .step-row {
    flex-wrap: wrap;
  }
}
</style>
