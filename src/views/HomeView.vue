<script setup>
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { useSheetsStore } from '@/stores/sheets'
import { useRecipesStore } from '@/stores/recipes'

const store = useSheetsStore()
const recipes = useRecipesStore()
const router = useRouter()

const modes = [
  {
    to: '/recherche',
    title: 'Une idée',
    blurb: 'Ambiance, ingrédient ou roulette.',
    tone: 'warm',
    icon: 'pi pi-search',
  },
  {
    to: '/menu',
    title: 'Un planning',
    blurb: 'Plusieurs jours, courses prêtes.',
    tone: 'cool',
    icon: 'pi pi-calendar',
  },
  {
    to: '/ajout',
    title: 'Une recette',
    blurb: 'Étapes, quantités, c’est noté.',
    tone: 'warm',
    icon: 'pi pi-plus',
  },
  {
    to: '/gerer',
    title: 'Le carnet',
    blurb: 'Modifier ou supprimer une recette.',
    tone: 'cool',
    icon: 'pi pi-pencil',
  },
]

const recipeCount = computed(() => recipes.all.length)

onMounted(async () => {
  try {
    await store.syncSchema()
    await store.fetchAll()
  } catch {
    /* store.error */
  }
})
</script>

<template>
  <section class="hero">
    <div class="hero-glow" aria-hidden="true" />
    <div class="cm-shell hero-inner">
      <div class="hero-brand cm-rise">
        <img src="/logo.png" alt="Bip & Bouffe" class="hero-logo" width="160" height="160" />
        <p class="hero-kicker">Cuisine du groupe</p>
        <h1 class="cm-display hero-title">
          Entre potes,<br />
          <span class="cm-grad-text">autour de la table</span>
        </h1>
        <p class="lede">
          Trouve une idée, planifie la semaine, partage la liste de courses.
        </p>

        <div class="hero-actions">
          <Button
            label="Générer un planning"
            icon="pi pi-bolt"
            class="cm-btn-warm hero-cta"
            rounded
            @click="router.push('/menu')"
          />
          <Button
            label="Trouver une recette"
            icon="pi pi-search"
            class="hero-cta-ghost"
            rounded
            outlined
            @click="router.push('/recherche')"
          />
        </div>

        <p class="count">
          <span class="count-dot" />
          {{ recipeCount }} recette{{ recipeCount > 1 ? 's' : '' }} dans le carnet
        </p>
      </div>
    </div>
  </section>

  <section class="cm-shell paths">
    <Message v-if="store.error" severity="error">
      Impossible de charger les recettes. Réessaie dans un instant.
    </Message>

    <div v-if="store.loading && !store.lastFetchedAt" class="loading">
      <ProgressSpinner :strokeWidth="3" />
    </div>

    <div v-else class="path-list">
      <p class="paths-label cm-rise">Par où commencer ?</p>
      <button
        v-for="(mode, i) in modes"
        :key="mode.to"
        type="button"
        class="path-item cm-rise"
        :class="[`tone-${mode.tone}`, `cm-rise-delay-${i + 1}`]"
        @click="router.push(mode.to)"
      >
        <span class="path-index">0{{ i + 1 }}</span>
        <span class="path-icon" :class="`tone-${mode.tone}`">
          <i :class="mode.icon" />
        </span>
        <span class="path-copy">
          <strong>{{ mode.title }}</strong>
          <span>{{ mode.blurb }}</span>
        </span>
        <i class="pi pi-arrow-right path-arrow" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  isolation: isolate;
  min-height: min(88vh, 760px);
  display: grid;
  align-items: center;
  padding: 2rem 0 1.5rem;
  overflow: hidden;
}

.hero-glow {
  position: absolute;
  inset: -10% -5% auto;
  height: 70%;
  background:
    radial-gradient(ellipse 55% 70% at 20% 40%, rgba(255, 107, 53, 0.35), transparent 70%),
    radial-gradient(ellipse 50% 60% at 85% 30%, rgba(6, 182, 212, 0.28), transparent 65%),
    radial-gradient(ellipse 40% 50% at 55% 90%, rgba(255, 77, 141, 0.18), transparent 70%);
  filter: blur(8px);
  animation: glow-shift 10s ease-in-out infinite alternate;
  pointer-events: none;
  z-index: -1;
}

.hero-inner {
  display: grid;
  justify-items: center;
  text-align: center;
}

.hero-brand {
  display: grid;
  justify-items: center;
  gap: 0;
  max-width: 36rem;
}

.hero-logo {
  width: clamp(7.5rem, 28vw, 10.5rem);
  height: auto;
  object-fit: contain;
  border-radius: 1.5rem;
  margin-bottom: 1.35rem;
  background: rgba(255, 255, 255, 0.96);
  padding: 0.55rem;
  box-shadow:
    0 20px 50px var(--cm-glow),
    0 0 0 1px rgba(255, 255, 255, 0.08);
  animation: logo-float 5.5s ease-in-out infinite;
}

.hero-kicker {
  margin: 0 0 0.55rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--cm-muted);
}

.hero-title {
  margin: 0;
  font-size: clamp(2.35rem, 8vw, 3.75rem);
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.lede {
  margin: 1rem 0 1.5rem;
  font-size: 1.08rem;
  line-height: 1.55;
  color: var(--cm-muted);
  max-width: 28rem;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  justify-content: center;
}

.hero-cta,
.hero-cta-ghost {
  min-height: 2.85rem;
  padding-inline: 1.25rem !important;
  font-weight: 700 !important;
}

.hero-cta-ghost {
  border-color: color-mix(in srgb, var(--cm-turquoise) 55%, transparent) !important;
  color: var(--cm-text) !important;
  background: color-mix(in srgb, var(--cm-surface) 70%, transparent) !important;
  backdrop-filter: blur(8px);
}

.count {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 1.35rem 0 0;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--cm-muted);
  background: var(--cm-surface);
  border: 1px solid var(--cm-border);
}

.count-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--cm-grad-cool);
  box-shadow: 0 0 10px rgba(45, 212, 191, 0.7);
}

.paths {
  padding: 0.5rem 0 2.5rem;
}

.paths-label {
  margin: 0 0 0.85rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--cm-muted);
}

.path-list {
  display: grid;
  gap: 0.65rem;
}

.path-item {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  text-align: left;
  padding: 1rem 1.15rem;
  border: 1px solid var(--cm-border);
  border-radius: 1.2rem;
  background: var(--cm-surface);
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
}

.path-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 16px 36px var(--cm-glow);
}

.path-item.tone-warm:hover {
  border-color: color-mix(in srgb, var(--cm-orange) 45%, transparent);
}

.path-item.tone-cool:hover {
  border-color: color-mix(in srgb, var(--cm-turquoise) 45%, transparent);
}

.path-index {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--cm-muted);
  opacity: 0.7;
}

.path-icon {
  display: grid;
  place-items: center;
  width: 2.55rem;
  height: 2.55rem;
  border-radius: 0.85rem;
  color: #fff;
  background: var(--cm-grad-warm);
  font-size: 1rem;
}

.path-icon.tone-cool {
  background: var(--cm-grad-cool);
  color: #0b1220;
}

.path-copy {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.path-copy strong {
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.path-copy span {
  color: var(--cm-muted);
  font-size: 0.9rem;
  line-height: 1.35;
}

.path-arrow {
  color: var(--cm-muted);
  transition: transform 0.2s ease, color 0.2s ease;
}

.path-item:hover .path-arrow {
  transform: translateX(4px);
  color: var(--cm-text);
}

.loading {
  display: grid;
  place-items: center;
  padding: 2.5rem;
}

@keyframes logo-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes glow-shift {
  from {
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    transform: translate3d(2%, 3%, 0) scale(1.05);
  }
}

@media (min-width: 900px) {
  .path-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .path-item {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr auto;
    align-items: start;
    min-height: 11.5rem;
    padding: 1.25rem 1.3rem;
  }

  .path-index {
    justify-self: end;
  }

  .path-arrow {
    justify-self: end;
  }

  .path-copy strong {
    font-size: 1.35rem;
  }
}

@media (max-width: 560px) {
  .hero {
    min-height: auto;
    padding-top: 1.25rem;
  }

  .hero-actions {
    width: 100%;
    flex-direction: column;
  }

  .hero-cta,
  .hero-cta-ghost {
    width: 100%;
  }

  .path-item {
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
  }

  .path-index {
    display: none;
  }
}
</style>
