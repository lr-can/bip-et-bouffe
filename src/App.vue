<script setup>
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import { useThemeStore } from '@/stores/theme'
import { useSheetsStore } from '@/stores/sheets'
import AppSplash from '@/components/AppSplash.vue'

const theme = useThemeStore()
const route = useRoute()
const sheets = useSheetsStore()

const splashVisible = computed(() => sheets.loading && !sheets.lastFetchedAt)

const links = [
  { to: '/recherche', label: 'Recherche', icon: 'pi pi-search' },
  { to: '/menu', label: 'Planning', icon: 'pi pi-calendar' },
  { to: '/ajout', label: 'Ajout', icon: 'pi pi-plus' },
  { to: '/gerer', label: 'Gérer', icon: 'pi pi-pencil' },
]

const slogans = [
  'Bien manger pour mieux servir',
  'Sauver des vies, réussir des pâtes',
  'Unis par le feu, rassemblés par la table',
]

const sloganIndex = ref(0)
const sloganVisible = ref(true)
let sloganTimer = null
let fadeTimer = null

const currentSlogan = computed(() => slogans[sloganIndex.value])
const showBottomNav = computed(() => route.name !== 'sheet')

function rotateSlogan() {
  sloganVisible.value = false
  fadeTimer = setTimeout(() => {
    sloganIndex.value = (sloganIndex.value + 1) % slogans.length
    sloganVisible.value = true
  }, 380)
}

onMounted(() => {
  sloganTimer = setInterval(rotateSlogan, 5000)
  // Chargement initial des données (schéma + feuilles), quel que soit l'écran d'entrée
  ;(async () => {
    try {
      await sheets.syncSchema()
      await sheets.fetchAll()
    } catch {
      /* sheets.error géré par les vues */
    }
  })()
})

onUnmounted(() => {
  clearInterval(sloganTimer)
  clearTimeout(fadeTimer)
})
</script>

<template>
  <div class="app-root" :class="{ 'has-bottom-nav': showBottomNav }">
    <Transition name="splash-fade">
      <AppSplash v-if="splashVisible" />
    </Transition>
    <header class="topbar">
      <div class="cm-shell topbar-inner">
        <RouterLink to="/" class="brand">
          <img src="/logo.png" alt="Bip & Bouffe" class="brand-logo" width="40" height="40" />
          <span class="brand-text">
            <span class="cm-display brand-name">Bip &amp; Bouffe</span>
            <span class="slogan" :class="{ visible: sloganVisible }">{{ currentSlogan }}</span>
          </span>
        </RouterLink>

        <nav class="nav desktop-nav">
          <RouterLink to="/">Accueil</RouterLink>
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <Button
          :icon="theme.dark ? 'pi pi-sun' : 'pi pi-moon'"
          rounded
          text
          severity="secondary"
          :aria-label="theme.dark ? 'Passer en thème clair' : 'Passer en thème sombre'"
          @click="theme.toggle()"
        />
      </div>
    </header>

    <main>
      <RouterView />
    </main>

    <nav v-if="showBottomNav" class="bottom-nav" aria-label="Navigation principale">
      <RouterLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="bottom-link"
      >
        <i :class="link.icon" />
        <span>{{ link.label }}</span>
      </RouterLink>
    </nav>

    <Toast position="top-right" />
  </div>
</template>

<style scoped>
.splash-fade-leave-active {
  transition: opacity 0.45s ease;
}

.splash-fade-leave-to {
  opacity: 0;
}

.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-root.has-bottom-nav main {
  padding-bottom: 5.5rem;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  backdrop-filter: blur(14px);
  background: color-mix(in srgb, var(--cm-bg) 72%, transparent);
  border-bottom: 1px solid var(--cm-border);
}

.topbar-inner {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 4.5rem;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.brand-logo {
  width: 2.4rem;
  height: 2.4rem;
  object-fit: contain;
  border-radius: 0.65rem;
  flex-shrink: 0;
  box-shadow: 0 8px 20px var(--cm-glow);
}

.brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0.1rem;
}

.brand-name {
  font-size: 1.3rem;
  font-weight: 800;
  line-height: 1.1;
}

.slogan {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--cm-muted);
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: min(42vw, 28rem);
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.slogan.visible {
  opacity: 1;
  transform: translateY(0);
}

.nav {
  display: flex;
  gap: 1.1rem;
  margin-left: auto;
  margin-right: 0.5rem;
  color: var(--cm-muted);
  font-weight: 500;
}

.nav a.router-link-active {
  color: var(--cm-text);
}

.nav a:hover {
  color: var(--cm-text);
}

main {
  flex: 1;
  padding-bottom: 2rem;
}

.bottom-nav {
  display: none;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  padding: 0.55rem 0.75rem calc(0.55rem + env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--cm-bg) 88%, transparent);
  backdrop-filter: blur(16px);
  border-top: 1px solid var(--cm-border);
  grid-template-columns: repeat(4, 1fr);
  gap: 0.35rem;
}

.bottom-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.45rem 0.25rem;
  border-radius: 0.85rem;
  color: var(--cm-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.bottom-link i {
  font-size: 1.1rem;
}

.bottom-link.router-link-active {
  color: var(--cm-text);
  background: var(--cm-surface);
}

@media (max-width: 820px) {
  .desktop-nav {
    display: none;
  }

  .bottom-nav {
    display: grid;
  }

  .brand-name {
    font-size: 1.1rem;
  }

  .slogan {
    max-width: 52vw;
    font-size: 0.7rem;
  }
}
</style>
