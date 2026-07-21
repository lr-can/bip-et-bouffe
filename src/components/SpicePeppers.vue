<script setup>
import { computed } from 'vue'
import { spiceLabel, spiceLevel } from '@/utils/recipe'

const props = defineProps({
  level: { type: [Number, String], default: 0 },
  showLabel: { type: Boolean, default: false },
  size: { type: String, default: 'md' }, // sm | md
})

const n = computed(() => spiceLevel(props.level))
const label = computed(() => spiceLabel(props.level))
</script>

<template>
  <span
    class="spice"
    :class="[`spice--${size}`, { 'spice--hot': n > 0 }]"
    :title="label"
    :aria-label="label"
  >
    <span class="peppers" aria-hidden="true">
      <svg
        v-for="i in 3"
        :key="i"
        class="pepper"
        :class="{ filled: i <= n }"
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
      >
        <!-- Chili pepper icon -->
        <path
          d="M12.2 3.1c.4-.7 1.2-1 1.9-.7.3.1.5.3.7.5 1.6 2.1 2.4 4.4 2.2 6.8-.2 2.4-1.4 4.6-3.3 6.1-1.1.9-2.4 1.4-3.8 1.5-.4 0-.7-.3-.7-.7v-.2c.1-1.3.5-2.5 1.2-3.6.2-.3.1-.7-.2-.9-.9-.6-1.6-1.5-2-2.5-.5-1.2-.5-2.5.1-3.7.2-.5.8-.7 1.3-.5.2.1.4.2.5.4.4.7.9 1.2 1.5 1.6.3.2.7.1.9-.2.2-.4.3-.8.3-1.2 0-.7.2-1.3.4-1.7z"
          fill="currentColor"
        />
        <path
          d="M13.8 2.6c.5.2.8.7.7 1.2-.1.4-.3.7-.6.9-.4.3-.9.2-1.2-.2-.2-.3-.2-.7 0-1 .3-.5.7-.9 1.1-.9z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>
    </span>
    <span v-if="showLabel" class="spice-label">{{ label }}</span>
  </span>
</template>

<style scoped>
.spice {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--cm-muted);
  line-height: 1;
}

.spice--hot {
  color: #c2410c;
}

.spice--sm {
  font-size: 0.85rem;
}

.spice--md {
  font-size: 1rem;
}

.peppers {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
}

.pepper {
  opacity: 0.28;
  transform: rotate(-18deg);
}

.pepper.filled {
  opacity: 1;
}

.spice-label {
  font-size: 0.85em;
  font-weight: 600;
  color: inherit;
}
</style>
