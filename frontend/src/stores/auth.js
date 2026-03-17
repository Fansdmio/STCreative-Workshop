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
    // iframe 模式：在新窗口中完成 OAuth，避免 Discord 的 X-Frame-Options 阻止
    const inIframe = window.parent && window.parent !== window
    if (inIframe) {
      const authUrl = '/auth/discord?popup=1'
      const w = 500
      const h = 700
      const left = Math.max(0, (window.screen.width - w) / 2)
      const top = Math.max(0, (window.screen.height - h) / 2)
      const authWindow = window.open(
        authUrl,
        'DiscordAuth',
        `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
      )
      // 轮询检测弹窗关闭，然后刷新登录状态
      if (authWindow) {
        const pollTimer = setInterval(() => {
          if (authWindow.closed) {
            clearInterval(pollTimer)
            fetchMe()
          }
        }, 500)
      }
    } else {
      window.location.href = '/auth/discord'
    }
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
