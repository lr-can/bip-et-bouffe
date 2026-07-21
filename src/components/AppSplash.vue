<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const PHRASES = [
  'On sort les recettes du four…',
  'On fait chauffer le carnet…',
  'On épluche les ingrédients…',
  'On dresse la table…',
  'On goûte, on ajuste…',
]

const phraseIndex = ref(0)
let timer = null

const phrase = computed(() => PHRASES[phraseIndex.value % PHRASES.length])

onMounted(() => {
  timer = window.setInterval(() => {
    phraseIndex.value += 1
  }, 900)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="splash" role="status" aria-live="polite">
    <div class="splash-stage">
      <div class="splash-orb splash-orb--a" aria-hidden="true" />
      <div class="splash-orb splash-orb--b" aria-hidden="true" />
      <div class="splash-orb splash-orb--c" aria-hidden="true" />
      <div class="splash-core">
        <img src="/logo.png" alt="Bip & Bouffe" class="splash-logo" width="96" height="96" />
      </div>
      <p class="splash-brand cm-display">Bip &amp; Bouffe</p>
      <Transition name="splash-phrase" mode="out-in">
        <p :key="phraseIndex" class="splash-phrase">{{ phrase }}</p>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: var(--cm-bg);
}

.splash-stage {
  position: relative;
  display: grid;
  place-items: center;
  gap: 0.6rem;
  padding: 3rem;
}

.splash-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(38px);
  opacity: 0.5;
  animation: splash-float 3.4s ease-in-out infinite;
}

.splash-orb--a {
  width: 15rem;
  height: 15rem;
  background: #ff6b35;
  top: -2rem;
  left: -4rem;
}

.splash-orb--b {
  width: 12rem;
  height: 12rem;
  background: #14b8a6;
  bottom: -2rem;
  right: -3rem;
  animation-delay: 0.6s;
}

.splash-orb--c {
  width: 9rem;
  height: 9rem;
  background: #a78bfa;
  bottom: 1rem;
  left: 0;
  animation-delay: 1.2s;
}

.splash-core {
  position: relative;
  display: grid;
  place-items: center;
  width: 7.5rem;
  height: 7.5rem;
  border-radius: 2rem;
  background: var(--cm-surface);
  box-shadow: 0 20px 50px var(--cm-glow);
  animation: splash-pulse 1.8s ease-in-out infinite;
}

.splash-logo {
  width: 5.5rem;
  height: 5.5rem;
  object-fit: contain;
  border-radius: 1.2rem;
}

.splash-brand {
  position: relative;
  margin: 0.9rem 0 0;
  font-size: 1.6rem;
  font-weight: 800;
}

.splash-phrase {
  position: relative;
  margin: 0;
  min-height: 1.4em;
  font-size: 0.95rem;
  color: var(--cm-muted);
  font-weight: 600;
}

.splash-phrase-enter-active,
.splash-phrase-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.splash-phrase-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.splash-phrase-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@keyframes splash-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}

@keyframes splash-float {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-14px) scale(1.08);
  }
}
</style>
