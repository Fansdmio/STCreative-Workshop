import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const initialized = ref(false)
  const loading = ref(false)

  const isLoggedIn = computed(() => !!user.value)
  // 是否具有创作者权限（creator 或 admin 均可发布模组）
  const isCreator = computed(() => user.value?.role === 'creator' || user.value?.role === 'admin')

  async function fetchMe() {
    loading.value = true
    try {
      const res = await fetch('/auth/me', { credentials: 'include' })
      if (!res.ok) throw new Error('Not authenticated')
      const data = await res.json()
      user.value = data
    } catch {
      user.value = null
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  function loginWithDiscord() {
    window.location.href = '/auth/discord'
  }

  async function logout() {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      user.value = null
    }
  }

  return { user, initialized, loading, isLoggedIn, isCreator, fetchMe, loginWithDiscord, logout }
})
