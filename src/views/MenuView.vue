<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import Dialog from 'primevue/dialog'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useSheetsStore } from '@/stores/sheets'
import { useRecipesStore } from '@/stores/recipes'
import { useMenuStore } from '@/stores/menu'
import { MENU_CORE_TYPES, RECIPE_TYPES, typeLabel } from '@/utils/recipe'
import { copyShoppingList } from '@/composables/useShoppingList'
import { downloadMenuPdf } from '@/composables/useRecipePdf'
import { useScrollReveal } from '@/composables/useScrollReveal'

const sheets = useSheetsStore()
const recipes = useRecipesStore()
const menu = useMenuStore()
const toast = useToast()

const addOpen = ref(false)
const pickType = ref(null)
const pickRecipe = ref(null)
const replaceType = ref(null)
const generating = ref(false)
const mealRowEls = ref([])

const { refresh: refreshReveal } = useScrollReveal(mealRowEls, {
  resetOn: () => [menu.activeDay, menu.allSelectedIds.join('|'), menu.nbJours],
})

function onMealTimelineMounted(el) {
  if (!el) {
    mealRowEls.value = []
    return
  }
  mealRowEls.value = [...el.querySelectorAll('.meal-row')]
}

const moodOptions = computed(() =>
  [{ label: 'Toutes les ambiances', value: '' }].concat(
    recipes.moods.map((m) => ({ label: m, value: m })),
  ),
)

const allergyAvoidOptions = computed(() =>
  recipes.allergenOptions.map((a) => ({
    label: a.nomAllergie,
    value: a.nomAllergie,
  })),
)

const selectedAllergies = computed({
  get() {
    return String(menu.allergies || '')
      .split(/[,;/|]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  },
  set(values) {
    menu.allergies = (values || []).join(', ')
  },
})

const activeDay = computed(() => menu.currentDay)

const pickPool = computed(() => {
  let list = recipes.all
  if (pickType.value) list = list.filter((r) => r.type === pickType.value)
  const dayIds = [
    activeDay.value.entree,
    activeDay.value.plat,
    activeDay.value.dessert,
    ...(activeDay.value.extras || []),
  ]
  return list.filter((r) => !dayIds.includes(r.idRecette))
})

watch(
  () => menu.nbJours,
  (n) => {
    if (menu.days.length !== Number(n)) menu.setNbJours(n)
  },
)

function openReplace(type) {
  replaceType.value = type
  pickType.value = type
  pickRecipe.value = null
  addOpen.value = true
}

function openAddExtra() {
  replaceType.value = null
  pickType.value = null
  pickRecipe.value = null
  addOpen.value = true
}

function confirmPick() {
  if (!pickRecipe.value) return
  if (replaceType.value) {
    menu.setSlot(replaceType.value, pickRecipe.value.idRecette)
  } else {
    menu.addExtra(pickRecipe.value.idRecette)
  }
  addOpen.value = false
}

async function generate() {
  generating.value = true
  await new Promise((r) => setTimeout(r, 220))
  const result = menu.generate()
  generating.value = false

  if (!result.recipes) {
    toast.add({
      severity: 'warn',
      summary: 'Pas assez de recettes',
      detail: 'Il faut au moins une entrée, un plat et un dessert dans le carnet.',
      life: 4000,
    })
    return
  }

  if (result.daysFilled < result.daysRequested) {
    toast.add({
      severity: 'warn',
      summary: 'Planning partiel',
      detail: `${result.daysFilled}/${result.daysRequested} jour(s) remplis — ajoute plus de recettes par type.`,
      life: 4200,
    })
    return
  }

  toast.add({
    severity: 'success',
    summary: 'Planning prêt',
    detail: `${result.daysRequested} jour(s) couverts · ${result.recipes} recettes`,
    life: 3200,
  })
}

async function copyList() {
  try {
    await copyShoppingList(menu.shoppingText)
    toast.add({
      severity: 'success',
      summary: 'Liste copiée',
      detail: 'Colle-la où tu veux (WhatsApp, Notes…)',
      life: 2500,
    })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Copie impossible', life: 3000 })
  }
}

async function exportPdf() {
  if (!menu.allSelectedIds.length) return
  await downloadMenuPdf({
    title: `Planning — ${menu.nbJours} jour(s)`,
    personnes: menu.nbPersonnes,
    days: menu.planSummary,
    shoppingList: menu.shoppingList,
    totalCost: menu.totalCost,
    allergies: menu.allergies,
    collectedAllergies: menu.collectedAllergies,
  })
}

function slotRecipe(type) {
  const id = activeDay.value?.[type]
  return id ? recipes.enriched(id, menu.nbPersonnes) : null
}

onMounted(() => {
  sheets.ensureLoaded().catch(() => {})
  menu.setNbJours(menu.nbJours)
  refreshReveal()
})
</script>

<template>
  <section class="cm-shell page">
    <header class="hero-band cm-rise">
      <div>
        <p class="eyebrow">Planning entre amis</p>
        <h1 class="cm-display">
          <span class="cm-grad-text">Menus sur {{ menu.nbJours }} jour{{ menu.nbJours > 1 ? 's' : '' }}</span>
        </h1>
        <p class="lede">
          Indique tes préférences, les allergies à éviter, puis génère un planning varié.
        </p>
      </div>
    </header>

    <Message v-if="sheets.error" severity="error">
      Impossible de charger le planning. Réessaie dans un instant.
    </Message>

    <div v-if="sheets.loading && !sheets.lastFetchedAt" class="loading">
      <ProgressSpinner :strokeWidth="3" />
    </div>

    <template v-else>
      <div class="control-bar cm-rise cm-rise-delay-1">
        <div class="field">
          <label>Jours</label>
          <InputNumber v-model="menu.nbJours" :min="1" :max="14" showButtons fluid />
        </div>
        <div class="field">
          <label>Personnes</label>
          <InputNumber v-model="menu.nbPersonnes" :min="1" :max="30" showButtons fluid />
        </div>
        <div class="field">
          <label>Ambiance</label>
          <Select
            v-model="menu.mood"
            :options="moodOptions"
            optionLabel="label"
            optionValue="value"
            fluid
            placeholder="Tous"
          />
        </div>
        <div class="field">
          <label>Budget / jour (€)</label>
          <InputNumber
            v-model="menu.budgetParJour"
            :min="0"
            mode="decimal"
            :minFractionDigits="0"
            :maxFractionDigits="2"
            placeholder="Libre"
            fluid
          />
        </div>
        <div class="field allergies-field">
          <label>Allergies à éviter</label>
          <MultiSelect
            v-model="selectedAllergies"
            :options="allergyAvoidOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Choisir dans la liste allergènes…"
            display="chip"
            filter
            fluid
          />
        </div>
        <div class="generate-row">
          <Button
            label="Générer le planning"
            icon="pi pi-bolt"
            class="cm-btn-warm gen-btn"
            rounded
            size="large"
            :loading="generating"
            @click="generate"
          />
        </div>
      </div>

      <div class="day-rail cm-rise cm-rise-delay-2" role="tablist" aria-label="Jours du planning">
        <button
          v-for="(day, i) in menu.planSummary"
          :key="i"
          type="button"
          class="day-chip"
          :class="{ active: menu.activeDay === i, filled: day.filled > 0 }"
          role="tab"
          :aria-selected="menu.activeDay === i"
          @click="menu.setActiveDay(i)"
        >
          <span class="day-num">J{{ i + 1 }}</span>
          <span class="day-meta">
            <template v-if="day.filled">
              {{ day.cost.toFixed(0) }}€
              <template v-if="day.nutrition?.kcal"> · {{ Math.round(day.nutrition.kcal) }} kcal/pers</template>
            </template>
            <template v-else>—</template>
          </span>
        </button>
      </div>

      <article class="day-panel cm-rise">
        <div class="day-panel-head">
          <div>
            <h2 class="cm-display">Jour {{ menu.activeDay + 1 }}</h2>
            <p class="muted">
              {{ menu.dayCost(menu.activeDay).toFixed(2) }} € estimés
              <template v-if="menu.dayNutrition(menu.activeDay).kcal">
                · {{ Math.round(menu.dayNutrition(menu.activeDay).kcal) }} kcal/pers
                (P {{ menu.dayNutrition(menu.activeDay).proteines }}g /
                G {{ menu.dayNutrition(menu.activeDay).glucides }}g /
                L {{ menu.dayNutrition(menu.activeDay).lipides }}g)
              </template>
            </p>
          </div>
          <div class="day-panel-actions">
            <Button icon="pi pi-trash" rounded text severity="secondary" aria-label="Vider le jour" @click="menu.clearDay()" />
            <Button label="Ajouter" icon="pi pi-plus" rounded outlined @click="openAddExtra" />
          </div>
        </div>

        <div :key="menu.activeDay" :ref="onMealTimelineMounted" class="meal-timeline">
          <div
            v-for="(type, idx) in MENU_CORE_TYPES"
            :key="`${menu.activeDay}-${type}`"
            class="meal-row cm-reveal"
            :class="`cm-reveal-delay-${idx + 1}`"
          >
            <div class="meal-marker" :class="`tone-${idx}`" />
            <div class="meal-body">
              <div class="meal-label">{{ typeLabel(type) }}</div>
              <template v-if="slotRecipe(type)">
                <RouterLink :to="`/recette/${slotRecipe(type).idRecette}`" class="meal-card filled">
                  <div>
                    <strong>{{ slotRecipe(type).nomRecette }}</strong>
                    <p>
                      <Tag v-if="slotRecipe(type).mood" :value="slotRecipe(type).mood" severity="secondary" rounded />
                      <Tag v-if="slotRecipe(type).allergie" :value="slotRecipe(type).allergie" severity="warn" rounded />
                      <span>{{ slotRecipe(type).tps || '—' }}</span>
                      <span>{{ slotRecipe(type).cout.toFixed(2) }} €</span>
                    </p>
                  </div>
                </RouterLink>
                <div class="meal-actions">
                  <Button icon="pi pi-refresh" rounded text @click="openReplace(type)" />
                  <Button icon="pi pi-times" rounded text severity="danger" @click="menu.clearSlot(type)" />
                </div>
              </template>
              <button v-else type="button" class="meal-card empty" @click="openReplace(type)">
                Choisir une {{ typeLabel(type).toLowerCase() }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="activeDay.extras?.length" class="extras">
          <h3>Extras</h3>
          <div v-for="id in activeDay.extras" :key="id" class="extra-row">
            <RouterLink :to="`/recette/${id}`">
              {{ recipes.byId(id)?.nomRecette }}
              <span class="muted">· {{ typeLabel(recipes.byId(id)?.type) }}</span>
            </RouterLink>
            <Button icon="pi pi-times" rounded text severity="danger" @click="menu.removeExtra(id)" />
          </div>
        </div>
      </article>

      <section class="shopping-dock cm-rise">
        <div v-if="menu.allergies || menu.collectedAllergies.length" class="allergy-banner">
          <strong>Allergies</strong>
          <span v-if="menu.allergies">À éviter : {{ menu.allergies }}</span>
          <span v-if="menu.collectedAllergies.length">
            Dans le menu : {{ menu.collectedAllergies.join(', ') }}
          </span>
        </div>
        <div class="dock-stats">
          <div>
            <span class="stat-label">Total</span>
            <strong class="stat-value">{{ menu.totalCost.toFixed(2) }} €</strong>
          </div>
          <div>
            <span class="stat-label">Courses</span>
            <strong class="stat-value">{{ menu.shoppingList.length }}</strong>
          </div>
        </div>
        <div class="dock-actions">
          <Button
            label="Copier la liste"
            icon="pi pi-copy"
            class="cm-btn-cool"
            rounded
            :disabled="!menu.shoppingList.length"
            @click="copyList"
          />
          <Button
            label="PDF"
            icon="pi pi-file-pdf"
            outlined
            rounded
            :disabled="!menu.allSelectedIds.length"
            @click="exportPdf"
          />
        </div>

        <ul v-if="menu.shoppingList.length" class="shop-preview">
          <li v-for="item in menu.shoppingList.slice(0, 8)" :key="item.idIngr">
            <span>{{ item.nomIngr }}</span>
            <span class="muted">
              {{ Number.isInteger(item.quantite) ? item.quantite : item.quantite.toFixed(1) }}
              {{ item.unite }}
            </span>
          </li>
          <li v-if="menu.shoppingList.length > 8" class="muted">
            + {{ menu.shoppingList.length - 8 }} autres (copie ou PDF)
          </li>
        </ul>
      </section>
    </template>

    <Dialog
      v-model:visible="addOpen"
      modal
      :header="replaceType ? `Remplacer — ${typeLabel(replaceType)}` : 'Ajouter au jour'"
      :style="{ width: 'min(460px, 94vw)' }"
    >
      <div class="dialog-form">
        <div class="field">
          <label>Type</label>
          <Select
            v-model="pickType"
            :options="[{ label: 'Tous', value: null }, ...RECIPE_TYPES]"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            :disabled="Boolean(replaceType)"
          />
        </div>
        <div class="field">
          <label>Recette</label>
          <Select
            v-model="pickRecipe"
            :options="pickPool"
            optionLabel="nomRecette"
            placeholder="Choisir…"
            class="w-full"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Annuler" text severity="secondary" @click="addOpen = false" />
        <Button label="Valider" class="cm-btn-warm" :disabled="!pickRecipe" @click="confirmPick" />
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.page {
  padding-top: 1.25rem;
  padding-bottom: 3rem;
}

.hero-band {
  display: flex;
  justify-content: space-between;
  gap: 1.25rem;
  align-items: flex-end;
  margin-bottom: 1.25rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--cm-muted);
}

h1 {
  margin: 0;
  font-size: clamp(1.85rem, 4vw, 2.8rem);
  line-height: 1.05;
}

.lede {
  margin: 0.55rem 0 0;
  max-width: 34rem;
  color: var(--cm-muted);
  line-height: 1.45;
}

.gen-btn {
  flex-shrink: 0;
}

.control-bar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem 0.75rem;
  align-items: end;
  padding: 1.1rem 1.15rem;
  border-radius: 1.25rem;
  border: 1px solid var(--cm-border);
  background: var(--cm-surface);
  backdrop-filter: blur(10px);
  margin-bottom: 1rem;
}

.field {
  display: grid;
  gap: 0.28rem;
  min-width: 0;
}

.field.grow,
.allergies-field {
  grid-column: 1 / -1;
}

.field label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--cm-muted);
}

.field :deep(.p-inputtext),
.field :deep(.p-select),
.field :deep(.p-inputnumber),
.field :deep(.p-inputnumber-input) {
  width: 100%;
}

.field :deep(.p-inputnumber) {
  display: flex;
}

.generate-row {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  padding-top: 0.25rem;
}

.gen-btn {
  min-width: min(100%, 240px);
}

.w-full {
  width: 100%;
}

@media (max-width: 900px) {
  .control-bar {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 560px) {
  .control-bar {
    grid-template-columns: 1fr;
  }

  .gen-btn {
    width: 100%;
  }
}

.day-rail {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.35rem;
  margin-bottom: 0.85rem;
  scrollbar-width: thin;
}

.day-chip {
  flex: 0 0 auto;
  min-width: 4.4rem;
  padding: 0.65rem 0.75rem;
  border-radius: 1rem;
  border: 1px solid var(--cm-border);
  background: var(--cm-surface);
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.day-chip:hover {
  transform: translateY(-2px);
}

.day-chip.active {
  border-color: transparent;
  background: var(--cm-grad-warm);
  color: #fff;
  box-shadow: 0 12px 28px var(--cm-glow);
}

.day-chip.active .day-meta {
  color: rgba(255, 255, 255, 0.85);
}

.day-num {
  display: block;
  font-weight: 800;
  font-size: 0.95rem;
}

.day-meta {
  font-size: 0.75rem;
  color: var(--cm-muted);
}

.day-panel {
  padding: 1.2rem 1.25rem 1.35rem;
  border-radius: 1.4rem;
  border: 1px solid var(--cm-border);
  background: var(--cm-surface);
  backdrop-filter: blur(10px);
  margin-bottom: 1rem;
}

.day-panel-head {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}

.day-panel-head h2 {
  margin: 0;
  font-size: 1.45rem;
}

.day-panel-actions {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.muted {
  color: var(--cm-muted);
  margin: 0.2rem 0 0;
}

.meal-timeline {
  display: grid;
  gap: 1.35rem;
  padding-block: 0.35rem 0.75rem;
}

.meal-row {
  display: grid;
  grid-template-columns: 1rem 1fr auto;
  gap: 0.85rem;
  align-items: stretch;
  min-height: 7.5rem;
}

.meal-marker {
  width: 0.7rem;
  border-radius: 999px;
  background: var(--cm-grad-warm);
  min-height: 100%;
  transform-origin: top center;
  transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}

.meal-row.cm-reveal.in .meal-marker {
  transform: scaleY(1);
}

.meal-row.cm-reveal:not(.in) .meal-marker {
  transform: scaleY(0.35);
}

.meal-marker.tone-1 {
  background: var(--cm-grad-cool);
}

.meal-marker.tone-2 {
  background: linear-gradient(180deg, #ff4d8d, #06b6d4);
}

.meal-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--cm-muted);
  margin-bottom: 0.45rem;
}

.meal-card {
  display: flex;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: 1.15rem 1.2rem;
  border-radius: 1.15rem;
  border: 1px solid var(--cm-border);
  background: color-mix(in srgb, var(--cm-bg) 55%, transparent);
  min-height: 5.5rem;
  transition: box-shadow 0.35s ease, transform 0.35s ease;
}

.meal-row.cm-reveal.in .meal-card.filled:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px var(--cm-glow);
}

.meal-card.filled strong {
  font-size: 1.05rem;
}

.meal-card.filled p {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
  margin: 0.4rem 0 0;
  color: var(--cm-muted);
  font-size: 0.88rem;
}

.meal-card.empty {
  border-style: dashed;
  color: var(--cm-muted);
  cursor: pointer;
  min-height: 3.4rem;
}

.meal-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.extras {
  margin-top: 1.1rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--cm-border);
}

.extras h3 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}

.extra-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.shopping-dock {
  padding: 1.15rem 1.2rem;
  border-radius: 1.35rem;
  border: 1px solid var(--cm-border);
  background:
    linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(6, 182, 212, 0.1)),
    var(--cm-surface);
}

.allergy-banner {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.9rem;
  padding: 0.75rem 0.9rem;
  border-radius: 0.9rem;
  background: rgba(255, 107, 53, 0.12);
  font-size: 0.9rem;
}

.dock-stats {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 0.85rem;
}

.stat-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--cm-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1.45rem;
  font-family: var(--font-display);
}

.dock-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-bottom: 0.85rem;
}

.shop-preview {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}

.shop-preview li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.92rem;
}

.dialog-form {
  display: grid;
  gap: 0.9rem;
}

.loading {
  display: grid;
  place-items: center;
  padding: 3rem;
}

@media (max-width: 820px) {
  .hero-band {
    flex-direction: column;
    align-items: stretch;
  }

  .meal-row {
    grid-template-columns: 0.55rem 1fr;
  }

  .meal-actions {
    grid-column: 2;
    flex-direction: row;
    justify-content: flex-end;
  }
}
</style>
