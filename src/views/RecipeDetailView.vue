<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import MultiSelect from 'primevue/multiselect'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useSheetsStore } from '@/stores/sheets'
import { useRecipesStore } from '@/stores/recipes'
import { typeLabel, toNumber } from '@/utils/recipe'
import { costForQuantity } from '@/utils/nutrition'
import { downloadRecipePdf } from '@/composables/useRecipePdf'

const props = defineProps({
  id: { type: String, required: true },
})

const sheets = useSheetsStore()
const recipes = useRecipesStore()
const router = useRouter()
const toast = useToast()
const personnes = ref(2)
const selectedAdaptationIds = ref([])
const priceDrafts = reactive({})
const savingPriceId = ref(null)

const recipe = computed(() => recipes.enriched(props.id, personnes.value))
const allergenAdaptationOptions = computed(() =>
  recipes.allergenOptions.map((a) => ({
    label: a.nomAllergie,
    value: a.idAllergie,
  })),
)
const recipeSubstitutionPreview = computed(() => {
  if (!recipe.value || !selectedAdaptationIds.value.length) return []
  return recipe.value.ingredients
    .map((ing) => {
      const substitutions = recipes.ingredientSubstitutions(ing, selectedAdaptationIds.value)
      if (!substitutions.length) return null
      return {
        ingredient: ing,
        substitutions: substitutions.map((row) => ({
          ...row,
          allergenName: recipes.allergenName(row.idAllergie),
        })),
      }
    })
    .filter(Boolean)
})

function syncPriceDrafts() {
  for (const ing of recipe.value?.ingredients || []) {
    if (priceDrafts[ing.idIngr] === undefined) {
      priceDrafts[ing.idIngr] = toNumber(ing.prixUnitaire, 0)
    }
  }
}

function priceDirty(ing) {
  return toNumber(priceDrafts[ing.idIngr], 0) !== toNumber(ing.prixUnitaire, 0)
}

/** Coût estimé avec le prix catalogue en cours d'édition (aperçu live). */
function ingredientCostPreview(ing) {
  const priced = {
    ...ing,
    unite: ing.uniteCatalogue || ing.unite,
    prixUnitaire: toNumber(priceDrafts[ing.idIngr], toNumber(ing.prixUnitaire, 0)),
  }
  const perPers = costForQuantity(priced, Number(ing.qteParPersonne) || 0, ing.unite)
  const total = costForQuantity(priced, Number(ing.quantite) || 0, ing.unite)
  return { perPers, total }
}

const recipeCostPreview = computed(() => {
  const ings = recipe.value?.ingredients || []
  const total = ings.reduce((sum, ing) => sum + ingredientCostPreview(ing).total, 0)
  const nb = Number(personnes.value) || 1
  return {
    total: Math.round(total * 100) / 100,
    perPers: Math.round((total / nb) * 100) / 100,
  }
})

async function saveIngredientPrice(ing) {
  const row = sheets.data.ingredients?.find((r) => r.idIngr === ing.idIngr)
  if (!row?._row) {
    toast.add({
      severity: 'warn',
      summary: 'Introuvable',
      detail: 'Impossible de retrouver cet ingrédient dans le catalogue.',
      life: 3000,
    })
    return
  }
  savingPriceId.value = ing.idIngr
  try {
    const prixUnitaire = String(toNumber(priceDrafts[ing.idIngr], 0))
    await sheets.updateRow('ingredients', row._row, { prixUnitaire })
    priceDrafts[ing.idIngr] = toNumber(prixUnitaire, 0)
    toast.add({
      severity: 'success',
      summary: 'Prix mis à jour',
      detail: `${ing.nomIngr} · ${toNumber(prixUnitaire, 0).toFixed(2)} € / ${ing.uniteCatalogue || ing.unite}`,
      life: 2500,
    })
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: err.message || 'Enregistrement impossible',
      life: 3500,
    })
  } finally {
    savingPriceId.value = null
  }
}

watch(
  () => props.id,
  () => {
    const base = recipes.byId(props.id)
    personnes.value = toNumber(base?.nbPerso, 2) || 2
    selectedAdaptationIds.value = []
    Object.keys(priceDrafts).forEach((k) => delete priceDrafts[k])
  },
  { immediate: true },
)

watch(
  () => recipe.value?.ingredients?.map((i) => `${i.idIngr}:${i.prixUnitaire}`).join('|'),
  () => syncPriceDrafts(),
  { immediate: true },
)

onMounted(() => {
  sheets.ensureLoaded().catch(() => {})
})
</script>

<template>
  <section class="cm-shell page">
    <Button
      icon="pi pi-arrow-left"
      label="Retour"
      text
      severity="secondary"
      class="back"
      @click="router.back()"
    />

    <div v-if="sheets.loading && !recipe" class="loading">
      <ProgressSpinner :strokeWidth="3" />
    </div>

    <Message v-else-if="!recipe" severity="warn">Recette introuvable.</Message>

    <template v-else>
      <header class="head cm-rise">
        <div>
          <div class="tags">
            <Tag :value="typeLabel(recipe.type)" rounded />
            <Tag v-if="recipe.mood" :value="recipe.mood" severity="secondary" rounded />
          </div>
          <h1 class="cm-display cm-grad-text">{{ recipe.nomRecette }}</h1>
          <p class="meta">
            <span v-if="recipe.tps"><i class="pi pi-clock" /> {{ recipe.tps }}</span>
            <span v-if="recipe.difficulte"><i class="pi pi-bolt" /> {{ recipe.difficulte }}</span>
            <span v-if="recipe.allergie"><i class="pi pi-exclamation-triangle" /> {{ recipe.allergie }}</span>
            <span>
              <i class="pi pi-wallet" />
              {{ recipeCostPreview.total.toFixed(2) }} €
              <span class="muted"> ({{ personnes }} pers.)</span>
              <span class="muted"> · {{ recipeCostPreview.perPers.toFixed(2) }} €/pers</span>
            </span>
          </p>
          <div v-if="recipe.nutritionParPers?.kcal" class="macros-card">
            <p class="macros-title">
              Nutrition <strong>par personne</strong>
              <span class="muted">({{ personnes }} pers. · AJR recommandés)</span>
            </p>
            <div class="macros-bars">
              <div class="macro-row">
                <span class="macro-label">Calories</span>
                <div class="macro-track">
                  <div
                    class="macro-fill macro-fill--kcal"
                    :style="{ width: Math.min(100, recipe.nutritionParPers.kcal / 20) + '%' }"
                  />
                </div>
                <span class="macro-val">{{ Math.round(recipe.nutritionParPers.kcal) }} kcal</span>
                <span class="macro-ajr">/ 2000</span>
              </div>
              <div class="macro-row">
                <span class="macro-label">Protéines</span>
                <div class="macro-track">
                  <div
                    class="macro-fill macro-fill--prot"
                    :style="{ width: Math.min(100, recipe.nutritionParPers.proteines / 0.5) + '%' }"
                  />
                </div>
                <span class="macro-val">{{ recipe.nutritionParPers.proteines }} g</span>
                <span class="macro-ajr">/ 50 g</span>
              </div>
              <div class="macro-row">
                <span class="macro-label">Glucides</span>
                <div class="macro-track">
                  <div
                    class="macro-fill macro-fill--gluc"
                    :style="{ width: Math.min(100, recipe.nutritionParPers.glucides / 2.6) + '%' }"
                  />
                </div>
                <span class="macro-val">{{ recipe.nutritionParPers.glucides }} g</span>
                <span class="macro-ajr">/ 260 g</span>
              </div>
              <div class="macro-row">
                <span class="macro-label">Lipides</span>
                <div class="macro-track">
                  <div
                    class="macro-fill macro-fill--lip"
                    :style="{ width: Math.min(100, recipe.nutritionParPers.lipides / 0.7) + '%' }"
                  />
                </div>
                <span class="macro-val">{{ recipe.nutritionParPers.lipides }} g</span>
                <span class="macro-ajr">/ 70 g</span>
              </div>
            </div>
          </div>
        </div>
        <div class="actions">
          <div class="perso">
            <label>Personnes</label>
            <InputNumber v-model="personnes" :min="1" :max="30" showButtons />
          </div>
          <Button
            icon="pi pi-pencil"
            label="Modifier"
            outlined
            rounded
            @click="router.push(`/ajout/${recipe.idRecette}`)"
          />
          <Button
            icon="pi pi-file-pdf"
            label="PDF"
            class="cm-btn-cool"
            rounded
            @click="downloadRecipePdf(recipe, personnes)"
          />
        </div>
      </header>

      <div class="panels">
        <section class="panel cm-rise cm-rise-delay-1">
          <div class="panel-head">
            <h2 class="cm-display">Ingrédients</h2>
            <span class="panel-count">{{ recipe.ingredients.length }}</span>
          </div>
          <div class="adapt-box">
            <label>Adapter la recette pour…</label>
            <MultiSelect
              v-model="selectedAdaptationIds"
              :options="allergenAdaptationOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Ex. sans lactose, sans œuf…"
              display="chip"
              filter
              showClear
            />
            <p class="adapt-hint">
              Sélectionne un allergène pour afficher les remplacements conseillés ingrédient par ingrédient.
            </p>
          </div>
          <ul class="ing-list">
            <li v-for="ing in recipe.ingredients" :key="ing.idIngr" class="ing-item">
              <span class="ing-dot" aria-hidden="true" />
              <div class="ing-main">
                <strong>{{ ing.nomIngr }}</strong>
                <span v-if="ing.nomAllergie" class="ing-allergy">⚠ {{ ing.nomAllergie }}</span>
                <span v-if="ing.macrosParPers?.kcal" class="ing-macros">
                  {{ Math.round(ing.macrosParPers.kcal) }} kcal/pers
                </span>
                <div class="ing-cost-row">
                  <span class="ing-cost">
                    <strong>{{ ingredientCostPreview(ing).perPers.toFixed(2) }} €</strong>
                    <span class="muted">/pers</span>
                  </span>
                  <span class="ing-cost">
                    <strong>{{ ingredientCostPreview(ing).total.toFixed(2) }} €</strong>
                    <span class="muted">recette ({{ personnes }} pers.)</span>
                  </span>
                </div>
                <div class="ing-price-edit">
                  <label>Prix catalogue</label>
                  <InputNumber
                    v-model="priceDrafts[ing.idIngr]"
                    mode="decimal"
                    :min="0"
                    :minFractionDigits="0"
                    :maxFractionDigits="4"
                    class="price-input"
                  />
                  <span class="price-unit">€ / {{ ing.uniteCatalogue || ing.unite }}</span>
                  <Button
                    icon="pi pi-check"
                    rounded
                    text
                    severity="success"
                    :disabled="!priceDirty(ing)"
                    :loading="savingPriceId === ing.idIngr"
                    aria-label="Enregistrer le prix"
                    @click="saveIngredientPrice(ing)"
                  />
                </div>
              </div>
              <span class="ing-qty">
                {{ Number.isInteger(ing.quantite) ? ing.quantite : ing.quantite.toFixed(2) }}
                {{ ing.unite }}
              </span>
            </li>
          </ul>
          <div v-if="selectedAdaptationIds.length" class="subs-panel">
            <p class="subs-title">
              <i class="pi pi-sparkles" />
              Remplacements proposés
            </p>
            <ul v-if="recipeSubstitutionPreview.length" class="subs-list">
              <li v-for="row in recipeSubstitutionPreview" :key="row.ingredient.idIngr" class="subs-item">
                <div class="subs-item-head">
                  <strong>{{ row.ingredient.nomIngr }}</strong>
                  <span class="subs-qty">
                    {{ Number.isInteger(row.ingredient.quantite) ? row.ingredient.quantite : row.ingredient.quantite.toFixed(2) }}
                    {{ row.ingredient.unite }}
                  </span>
                </div>
                <div class="subs-chips">
                  <span
                    v-for="sub in row.substitutions"
                    :key="sub.idSubstitution"
                    class="subs-chip"
                  >
                    <i class="pi pi-refresh" />
                    <span class="subs-chip-allergen">{{ sub.allergenName }}</span>
                    <span>{{ sub.ingredientSubstitut }}</span>
                    <small v-if="sub.notes">{{ sub.notes }}</small>
                  </span>
                </div>
              </li>
            </ul>
            <p v-else class="empty">Aucun substitut enregistré pour les ingrédients de cette recette.</p>
          </div>
          <p v-if="!recipe.ingredients.length" class="empty">Aucun ingrédient lié.</p>
        </section>

        <section class="panel panel-steps cm-rise cm-rise-delay-2">
          <div class="panel-head">
            <h2 class="cm-display">Étapes</h2>
            <span class="panel-count">{{ recipe.etapes.length }}</span>
          </div>
          <ol v-if="recipe.etapes.length" class="steps-timeline">
            <li
              v-for="(etape, index) in recipe.etapes"
              :key="etape.idEtape"
              class="step-item"
              :style="{ '--i': index }"
            >
              <div class="step-rail" aria-hidden="true">
                <span class="step-num">{{ index + 1 }}</span>
                <span v-if="index < recipe.etapes.length - 1" class="step-line" />
              </div>
              <div class="step-card">
                <p>{{ etape.texte }}</p>
              </div>
            </li>
          </ol>
          <p v-else class="empty">Aucune étape.</p>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.page {
  padding-top: 1rem;
}

.back {
  margin-bottom: 0.5rem;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1.25rem;
}

.tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.05;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  margin: 0.7rem 0 0;
  color: var(--cm-muted);
}

.meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.macros-card {
  margin-top: 0.9rem;
  padding: 0.85rem 1rem;
  border-radius: 1rem;
  border: 1px solid var(--cm-border);
  background: color-mix(in srgb, var(--cm-bg) 40%, transparent);
}

.macros-title {
  margin: 0 0 0.7rem;
  font-size: 0.88rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.5rem;
  align-items: baseline;
}

.macros-title .muted {
  font-size: 0.78rem;
}

.macros-bars {
  display: grid;
  gap: 0.5rem;
}

.macro-row {
  display: grid;
  grid-template-columns: 6.5rem 1fr auto auto;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.macro-label {
  font-weight: 600;
  color: var(--cm-text);
  white-space: nowrap;
}

.macro-track {
  height: 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cm-border) 80%, transparent);
  overflow: hidden;
}

.macro-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.macro-fill--kcal {
  background: linear-gradient(90deg, var(--cm-orange, #f97316), #fbbf24);
}

.macro-fill--prot {
  background: linear-gradient(90deg, #6366f1, #a78bfa);
}

.macro-fill--gluc {
  background: linear-gradient(90deg, #10b981, #34d399);
}

.macro-fill--lip {
  background: linear-gradient(90deg, var(--cm-turquoise, #2dd4bf), #22d3ee);
}

.macro-val {
  font-weight: 700;
  white-space: nowrap;
  min-width: 4rem;
  text-align: right;
}

.macro-ajr {
  color: var(--cm-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}

.ing-macros {
  font-size: 0.78rem;
  color: var(--cm-muted);
  font-weight: 600;
}

.ing-cost-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 0.9rem;
  margin-top: 0.35rem;
}

.ing-cost {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  font-size: 0.84rem;
}

.ing-cost strong {
  font-weight: 750;
}

.ing-price-edit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.45rem;
}

.ing-price-edit label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--cm-muted);
  width: 100%;
}

.price-input {
  width: 7rem;
}

.price-input :deep(.p-inputnumber),
.price-input :deep(.p-inputnumber-input) {
  width: 100%;
}

.price-unit {
  font-size: 0.78rem;
  color: var(--cm-muted);
  font-weight: 600;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
}

.perso {
  display: grid;
  gap: 0.3rem;
}

.perso label {
  font-size: 0.8rem;
  font-weight: 600;
}

.panels {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 1rem;
  align-items: start;
}

.panel {
  padding: 1.25rem 1.3rem 1.4rem;
  border-radius: 1.35rem;
  border: 1px solid var(--cm-border);
  background: var(--cm-surface);
  backdrop-filter: blur(10px);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.1rem;
}

.panel h2 {
  margin: 0;
  font-size: 1.35rem;
}

.panel-count {
  display: inline-grid;
  place-items: center;
  min-width: 1.85rem;
  height: 1.85rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 800;
  color: #fff;
  background: var(--cm-grad-warm);
}

.panel-steps .panel-count {
  background: var(--cm-grad-cool);
  color: #0b1220;
}

.adapt-box {
  display: grid;
  gap: 0.45rem;
  margin-bottom: 1rem;
}

.adapt-box label {
  font-size: 0.82rem;
  font-weight: 700;
}

.adapt-hint {
  margin: 0;
  color: var(--cm-muted);
  font-size: 0.8rem;
}

.ing-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.45rem;
}

.ing-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem 0.85rem;
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--cm-bg) 55%, transparent);
  border: 1px solid var(--cm-border);
}

.ing-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: var(--cm-grad-warm);
  box-shadow: 0 0 10px var(--cm-glow);
}

.ing-main {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.65rem;
  min-width: 0;
}

.ing-allergy {
  font-size: 0.78rem;
  font-weight: 600;
  color: color-mix(in srgb, #b45309 80%, var(--cm-text));
}

.subs-panel {
  margin-top: 1rem;
  padding-top: 0.9rem;
  border-top: 1px dashed var(--cm-border);
  display: grid;
  gap: 0.8rem;
}

.subs-title {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 800;
}

.subs-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.subs-item {
  display: grid;
  gap: 0.45rem;
  padding: 0.8rem 0.9rem;
  border-radius: 0.95rem;
  border: 1px solid var(--cm-border);
  background: color-mix(in srgb, var(--cm-bg) 58%, transparent);
}

.subs-item-head {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}

.subs-qty {
  color: var(--cm-muted);
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
}

.subs-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.subs-chip {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.4rem 0.65rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cm-turquoise) 14%, transparent);
  color: var(--cm-text);
  font-size: 0.76rem;
  font-weight: 700;
}

.subs-chip small {
  font-weight: 500;
  color: var(--cm-muted);
}

.subs-chip-allergen {
  color: color-mix(in srgb, var(--cm-orange) 85%, #374151);
}

.ing-qty {
  color: var(--cm-muted);
  font-weight: 600;
  font-size: 0.92rem;
  white-space: nowrap;
}

.steps-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
}

.step-item {
  display: grid;
  grid-template-columns: 2.4rem 1fr;
  gap: 0.85rem;
  opacity: 0;
  transform: translateY(14px);
  animation: step-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(var(--i) * 0.08s + 0.05s);
}

.step-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 0.15rem;
}

.step-num {
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 0.85rem;
  font-weight: 800;
  color: #fff;
  background: var(--cm-grad-hero);
  background-size: 180% 180%;
  box-shadow: 0 8px 18px var(--cm-glow);
  flex-shrink: 0;
  z-index: 1;
}

.step-line {
  flex: 1;
  width: 2px;
  min-height: 1.1rem;
  margin-top: 0.35rem;
  margin-bottom: 0.15rem;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--cm-orange) 55%, transparent),
    color-mix(in srgb, var(--cm-turquoise) 45%, transparent)
  );
  opacity: 0.55;
}

.step-card {
  margin-bottom: 0.75rem;
  padding: 0.95rem 1.05rem;
  border-radius: 1rem;
  border: 1px solid var(--cm-border);
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--cm-orange) 7%, transparent),
      color-mix(in srgb, var(--cm-turquoise) 8%, transparent)
    ),
    color-mix(in srgb, var(--cm-bg) 50%, transparent);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.step-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px var(--cm-glow);
}

.step-card p {
  margin: 0;
  line-height: 1.5;
  font-size: 1rem;
  font-weight: 500;
}

.empty,
.loading {
  color: var(--cm-muted);
  text-align: center;
  padding: 1rem 0;
}

@keyframes step-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .step-item {
    opacity: 1;
    transform: none;
    animation: none;
  }
}

@media (max-width: 820px) {
  .head,
  .panels {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .panels {
    display: grid;
  }

  .subs-item-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
