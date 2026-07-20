import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    dark: localStorage.getItem('cm-theme') === 'dark',
  }),
  actions: {
    apply() {
      document.documentElement.classList.toggle('dark', this.dark)
      localStorage.setItem('cm-theme', this.dark ? 'dark' : 'light')
    },
    toggle() {
      this.dark = !this.dark
      this.apply()
    },
    init() {
      this.apply()
    },
  },
})
