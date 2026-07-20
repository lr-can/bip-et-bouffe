<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import AutoComplete from 'primevue/autocomplete'
import Steps from 'primevue/steps'
import Message from 'primevue/message'
import { useSheetsStore } from '@/stores/sheets'
import { useRecipesStore } from '@/stores/recipes'
import { RECIPE_TYPES, fuzzyMatch, newId, toNumber } from '@/utils/recipe'

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
const newIngredient = reactive({
  nomIngr: '',
  unite: 'g',
  prixUnitaire: 0,
  saison: 'toute',
  idAllergie: null,
})

const allergenSelectOptions = computed(() => [
  { label: 'Aucune', value: null },
  ...recipes.allergenOptions.map((a) => ({
    label: a.nomAllergie,
    value: a.idAllergie,
  })),
])

const suggestions = computed(() =>
  recipes.suggestedIngredients({
    type: form.type,
    mood: form.mood,
    limit: 8,
  }),
)

const canNext = computed(() => {
  if (step.value === 0) return Boolean(form.nomRecette.trim() && form.type)
  if (step.value === 1) return links.value.length > 0
  if (step.value === 2) return stepsList.value.some((s) => s.texte.trim())
  return true
})

function searchIngredients(event) {
  const q = event.query || ''
  const selected = new Set(links.value.map((l) => l.idIngr))
  ingredientSuggestions.value = (sheets.data.ingredients || [])
    .filter((i) => !selected.has(i.idIngr) && fuzzyMatch(i.nomIngr, q))
}

function addExistingIngredient(ing) {
  if (!ing?.idIngr) return
  if (links.value.some((l) => l.idIngr === ing.idIngr)) return
  links.value.push({
    idIngr: ing.idIngr,
    nomIngr: ing.nomIngr,
    unite: ing.unite,
    idAllergie: ing.idAllergie || '',
    nomAllergie: recipes.allergenName(ing.idAllergie),
    qteParPersonne: 1,
    isNew: false,
  })
  ingredientQuery.value = null
}

function addSuggested(ing) {
  addExistingIngredient(ing)
}

function createIngredient() {
  if (!newIngredient.nomIngr.trim()) return
  const id = newId('ing')
  const idAllergie = newIngredient.idAllergie || ''
  links.value.push({
    idIngr: id,
    nomIngr: newIngredient.nomIngr.trim(),
    unite: newIngredient.unite || '',
    prixUnitaire: newIngredient.prixUnitaire ?? 0,
    saison: newIngredient.saison || 'toute',
    idAllergie,
    nomAllergie: recipes.allergenName(idAllergie),
    qteParPersonne: 1,
    isNew: true,
  })
  Object.assign(newIngredient, {
    nomIngr: '',
    unite: 'g',
    prixUnitaire: 0,
    saison: 'toute',
    idAllergie: null,
  })
  showNewIngredient.value = false
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
    idAllergie: ing.idAllergie || '',
    nomAllergie: ing.nomAllergie || recipes.allergenName(ing.idAllergie),
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
          <label>Allergies (recette)</label>
          <InputText
            v-model="form.allergie"
            fluid
            placeholder="Optionnel — sinon déduit des ingrédients"
          />
        </div>
        <div class="field">
          <label>Image URL (optionnel)</label>
          <InputText v-model="form.imageUrl" fluid placeholder="https://…" />
        </div>
      </div>

      <div v-else-if="step === 1" class="form">
        <div class="field">
          <label>Rechercher un ingrédient existant</label>
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
          />
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
            </button>
          </div>
        </div>

        <div class="links">
          <div v-for="link in links" :key="link.idIngr" class="link-row">
            <div>
              <strong>{{ link.nomIngr }}</strong>
              <span class="muted">
                {{ link.unite }}{{ link.isNew ? ' · nouveau' : '' }}
                <template v-if="link.nomAllergie"> · ⚠ {{ link.nomAllergie }}</template>
              </span>
            </div>
            <div class="link-actions">
              <InputNumber
                v-model="link.qteParPersonne"
                :min="0"
                :minFractionDigits="0"
                :maxFractionDigits="2"
                placeholder="qté/pers"
                class="qty-input"
              />
              <Button icon="pi pi-trash" rounded text severity="danger" @click="removeLink(link.idIngr)" />
            </div>
          </div>
        </div>

        <Button
          v-if="!showNewIngredient"
          label="Créer un nouvel ingrédient"
          icon="pi pi-plus"
          text
          @click="showNewIngredient = true"
        />

        <div v-else class="new-ing">
          <div class="grid-2">
            <div class="field">
              <label>Nom</label>
              <InputText v-model="newIngredient.nomIngr" fluid placeholder="Ex. Farine" />
            </div>
            <div class="field">
              <label>Unité</label>
              <InputText v-model="newIngredient.unite" fluid placeholder="g, ml…" />
            </div>
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
          <div class="new-ing-actions">
            <Button label="Ajouter l’ingrédient" class="cm-btn-cool" rounded @click="createIngredient" />
            <Button label="Annuler" text severity="secondary" @click="showNewIngredient = false" />
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
