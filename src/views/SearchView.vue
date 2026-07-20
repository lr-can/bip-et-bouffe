<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import AutoComplete from 'primevue/autocomplete'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Dialog from 'primevue/dialog'
import { useSheetsStore } from '@/stores/sheets'
import { useRecipesStore } from '@/stores/recipes'
import { pickRandom, fuzzyMatch } from '@/utils/recipe'
import RecipeCard from '@/components/RecipeCard.vue'

const sheets = useSheetsStore()
const recipes = useRecipesStore()
const router = useRouter()

const mood = ref('')
const query = ref('')
const ingredient = ref(null)
const ingredientSuggestions = ref([])
const spinning = ref(false)
const rouletteOpen = ref(false)
const rouletteName = ref('')

const results = computed(() =>
  recipes.search({
    mood: mood.value,
    ingredientId: ingredient.value?.idIngr || '',
    query: query.value,
  }),
)

function searchIngredients(event) {
  const q = event.query || ''
  ingredientSuggestions.value = (sheets.data.ingredients || []).filter((i) =>
    fuzzyMatch(i.nomIngr, q),
  )
}

function toggleMood(value) {
  mood.value = mood.value === value ? '' : value
}

function clearFilters() {
  mood.value = ''
  query.value = ''
  ingredient.value = null
}

async function spinRoulette() {
  const pool = results.value.length ? results.value : recipes.all
  if (!pool.length) return

  spinning.value = true
  rouletteOpen.value = true
  let ticks = 0
  const timer = setInterval(() => {
    const candidate = pickRandom(pool)
    rouletteName.value = candidate?.nomRecette || '…'
    ticks += 1
    if (ticks > 14) {
      clearInterval(timer)
      const finalPick = pickRandom(pool)
      rouletteName.value = finalPick.nomRecette
      spinning.value = false
      setTimeout(() => {
        rouletteOpen.value = false
        router.push(`/recette/${finalPick.idRecette}`)
      }, 650)
    }
  }, 90)
}

onMounted(() => {
  sheets.ensureLoaded().catch(() => {})
})
</script>

<template>
  <section class="cm-shell page">
    <header class="head cm-rise">
      <div>
        <p class="eyebrow">Trouve une idée vite</p>
        <h1 class="cm-display cm-grad-text">Quelle bouffe ce soir ?</h1>
      </div>
      <Button
        label="Roulette russe"
        icon="pi pi-sync"
        class="cm-btn-warm"
        rounded
        :disabled="!recipes.all.length"
        :loading="spinning"
        @click="spinRoulette"
      />
    </header>

    <Message v-if="sheets.error" severity="error">
      Impossible de charger les recettes. Réessaie dans un instant.
    </Message>

    <div class="filters cm-rise cm-rise-delay-1">
      <div class="field grow">
        <label>Recherche</label>
        <InputText v-model="query" placeholder="Nom, ambiance, allergie…" class="w-full" />
      </div>
      <div class="field grow">
        <label>Ingrédient</label>
        <AutoComplete
          v-model="ingredient"
          optionLabel="nomIngr"
          :suggestions="ingredientSuggestions"
          placeholder="Ex. Farine"
          forceSelection
          dropdown
          class="w-full"
          @complete="searchIngredients"
        />
      </div>
      <Button label="Réinitialiser" text severity="secondary" @click="clearFilters" />
    </div>

    <div v-if="recipes.moods.length" class="moods cm-rise cm-rise-delay-2">
      <Chip
        v-for="m in recipes.moods"
        :key="m"
        :label="m"
        :class="{ active: mood === m }"
        @click="toggleMood(m)"
      />
    </div>

    <div v-if="sheets.loading && !sheets.lastFetchedAt" class="loading">
      <ProgressSpinner :strokeWidth="3" />
    </div>

    <p v-else class="count">{{ results.length }} résultat(s)</p>

    <div class="grid">
      <RecipeCard
        v-for="(recipe, i) in results"
        :key="recipe.idRecette"
        :recipe="recipe"
        :cost="recipes.enriched(recipe.idRecette)?.cout"
        class="cm-rise"
        :class="`cm-rise-delay-${(i % 3) + 1}`"
      />
    </div>

    <p v-if="!sheets.loading && !results.length" class="empty">
      Aucune recette pour l’instant — ajoute-en une, ou relance la roulette plus tard.
    </p>

    <Dialog
      v-model:visible="rouletteOpen"
      modal
      :closable="!spinning"
      header="Roulette russe"
      :style="{ width: 'min(420px, 92vw)' }"
    >
      <div class="roulette">
        <p class="roulette-label">Et la recette est…</p>
        <p class="cm-display roulette-name">{{ rouletteName }}</p>
      </div>
    </Dialog>
  </section>
</template>

<style scoped>
.page {
  padding-top: 1.5rem;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-end;
  margin-bottom: 1.25rem;
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

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  align-items: end;
  margin-bottom: 1rem;
}

.field {
  display: grid;
  gap: 0.35rem;
  min-width: min(100%, 220px);
}

.field.grow {
  flex: 1;
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
}

.w-full {
  width: 100%;
}

.moods {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.moods :deep(.p-chip) {
  cursor: pointer;
}

.moods :deep(.p-chip.active) {
  background: var(--cm-grad-cool);
  color: #0b1220;
}

.count {
  color: var(--cm-muted);
  margin: 0 0 0.85rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.9rem;
}

.loading,
.empty {
  text-align: center;
  color: var(--cm-muted);
  padding: 2rem 0;
}

.roulette {
  text-align: center;
  padding: 0.5rem 0 1rem;
}

.roulette-label {
  margin: 0;
  color: var(--cm-muted);
}

.roulette-name {
  margin: 0.75rem 0 0;
  font-size: 1.8rem;
  font-weight: 800;
}

@media (max-width: 720px) {
  .head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
