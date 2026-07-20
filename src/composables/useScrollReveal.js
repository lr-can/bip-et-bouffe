import { nextTick, onBeforeUnmount, watch } from 'vue'

/**
 * Observe des éléments et leur ajoute la classe `in` au scroll.
 * @param {import('vue').Ref<HTMLElement[]|null>} elementsRef
 * @param {object} options
 */
export function useScrollReveal(elementsRef, options = {}) {
  const {
    rootMargin = '0px 0px -10% 0px',
    threshold = 0.15,
    resetOn = null,
  } = options

  let observer = null

  function cleanup() {
    observer?.disconnect()
    observer = null
  }

  function observe() {
    cleanup()
    const els = (elementsRef.value || []).filter(Boolean)
    if (!els.length) return

    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('in'))
      return
    }

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            observer?.unobserve(entry.target)
          }
        }
      },
      { rootMargin, threshold },
    )

    for (const el of els) {
      el.classList.remove('in')
      // force reflow so the transition replays cleanly
      void el.offsetWidth
      observer.observe(el)
    }
  }

  async function refresh() {
    await nextTick()
    requestAnimationFrame(() => observe())
  }

  if (resetOn) {
    watch(resetOn, () => refresh(), { flush: 'post' })
  }

  watch(elementsRef, () => refresh(), { flush: 'post' })

  onBeforeUnmount(cleanup)

  return { refresh, cleanup }
}
