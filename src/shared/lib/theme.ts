import { ref } from 'vue'

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null
const prefersDark =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false

const isDark = ref(stored ? stored === 'dark' : prefersDark)

function apply(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem('theme', dark ? 'dark' : 'light')
}

// Apply immediately on module load (before first render)
apply(isDark.value)

export function useTheme() {
  function toggleTheme() {
    isDark.value = !isDark.value
    apply(isDark.value)
  }

  return { isDark, toggleTheme }
}
