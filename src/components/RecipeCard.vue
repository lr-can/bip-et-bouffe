<script setup>
import { RouterLink } from 'vue-router'
import { typeLabel, dietLabels, spiceLevel } from '@/utils/recipe'
import SpicePeppers from '@/components/SpicePeppers.vue'

defineProps({
  recipe: { type: Object, required: true },
  cost: { type: Number, default: null },
})
</script>

<template>
  <RouterLink :to="`/recette/${recipe.idRecette}`" class="recipe-card">
    <div class="card-top">
      <span class="type-pill">{{ typeLabel(recipe.type) }}</span>
      <span v-if="recipe.mood" class="mood">{{ recipe.mood }}</span>
    </div>
    <h3 class="cm-display">{{ recipe.nomRecette }}</h3>
    <div
      v-if="spiceLevel(recipe.spiceLevel) > 0 || dietLabels(recipe).length"
      class="badges"
    >
      <SpicePeppers v-if="spiceLevel(recipe.spiceLevel) > 0" :level="recipe.spiceLevel" size="sm" />
      <span
        v-for="d in dietLabels(recipe)"
        :key="d"
        class="diet-pill"
        :class="d === 'Vegan' ? 'diet-pill--vegan' : 'diet-pill--veggie'"
      >
        {{ d }}
      </span>
    </div>
    <p class="meta">
      <span v-if="recipe.tps"><i class="pi pi-clock" /> {{ recipe.tps }}</span>
      <span v-if="recipe.difficulte"><i class="pi pi-bolt" /> {{ recipe.difficulte }}</span>
      <span v-if="cost != null"><i class="pi pi-wallet" /> {{ cost.toFixed(2) }} €</span>
    </p>
  </RouterLink>
</template>

<style scoped>
.recipe-card {
  display: block;
  padding: 1.15rem 1.2rem;
  border-radius: 1.15rem;
  border: 1px solid var(--cm-border);
  background: var(--cm-surface);
  backdrop-filter: blur(8px);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.recipe-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 32px var(--cm-glow);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.55rem;
}

.type-pill {
  display: inline-flex;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  background: var(--cm-grad-warm);
}

.mood {
  color: var(--cm-muted);
  font-size: 0.85rem;
  font-weight: 500;
}

h3 {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.2;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.55rem;
  min-height: 0;
}

.diet-pill {
  display: inline-flex;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.diet-pill--veggie {
  color: #166534;
  background: color-mix(in srgb, #22c55e 18%, transparent);
}

.diet-pill--vegan {
  color: #115e59;
  background: color-mix(in srgb, #14b8a6 20%, transparent);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0.7rem 0 0;
  color: var(--cm-muted);
  font-size: 0.88rem;
}

.meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
</style>
