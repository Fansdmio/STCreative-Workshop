import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// localStorage 键名
const TOKEN_KEY = 'workshop_auth_token'
const USER_KEY = 'workshop_auth_user'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(null)
  const initialized = ref(false)
  const loading = ref(false)

  const isLoggedIn = computed(() => !!user.value)
  // 是否具有创作者权限（creator 或 admin 均可发布模组）
  const isCreator = computed(() => user.value?.role === 'creator' || user.value?.role === 'admin')

  /**
   * 从 localStorage 恢复认证状态
   */
  function loadFromStorage() {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      const storedUser = localStorage.getItem(USER_KEY)
      if (storedToken && storedUser) {
        token.value = storedToken
        user.value = JSON.parse(storedUser)
        console.log('[Auth] 从 localStorage 恢复登录状态:', user.value?.username)
      }
    } catch (err) {
      console.error('[Auth] 读取 localStorage 失败:', err)
      clearStorage()
    }
  }

  /**
   * 保存认证状态到 localStorage
   */
  function saveToStorage(newToken, newUser) {
    try {
      localStorage.setItem(TOKEN_KEY, newToken)
      localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    } catch (err) {
      console.error('[Auth] 保存到 localStorage 失败:', err)
    }
  }

  /**
   * 清除 localStorage 中的认证状态
   */
  function clearStorage() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  /**
   * 获取当前 token（供其他模块使用）
   */
  function getToken() {
    return token.value
  }

  /**
   * 获取带认证的 fetch 选项
   */
  function getAuthHeaders() {
    if (token.value) {
      return { 'Authorization': `Bearer ${token.value}` }
    }
    return {}
  }

  /**
   * 验证当前 token 是否有效，并刷新用户信息
   */
  async function fetchMe() {
    loading.value = true
    console.log('[Auth] fetchMe 开始')
    try {
      const headers = getAuthHeaders()
      const res = await fetch('/auth/me', {
        credentials: 'include',
        headers,
      })
      console.log('[Auth] fetchMe 响应状态:', res.status)
      if (!res.ok) throw new Error('Not authenticated')
      const data = await res.json()
      console.log('[Auth] fetchMe 响应数据:', data)
      if (data) {
        user.value = data
        // 如果是 JWT 模式，更新缓存的用户信息
        if (token.value) {
          saveToStorage(token.value, data)
        }
      } else {
        // 服务器返回 null，清除本地状态
        user.value = null
        token.value = null
        clearStorage()
      }
    } catch (err) {
      console.error('[Auth] fetchMe 错误:', err)
      user.value = null
      token.value = null
      clearStorage()
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  /**
   * 使用 Discord 登录
   * 在 iframe 模式下使用 JWT Token 流程
   */
  function loginWithDiscord() {
    const inIframe = window.parent && window.parent !== window
    if (inIframe) {
      // iframe 模式：使用 JWT Token 流程
      // 生成唯一的 authKey
      const authKey = 'ws_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
      const origin = window.location.origin
      const authUrl = `${origin}/auth/discord?authKey=${encodeURIComponent(authKey)}`
      console.log('[Auth] iframe 模式，请求扩展打开 OAuth 弹窗:', authUrl)
      console.log('[Auth] authKey:', authKey)

      // 开始轮询 /auth/poll 获取 token
      let pollCount = 0
      const maxPolls = 60 // 最多轮询 60 次（约 2 分钟）
      const pollInterval = 2000 // 每 2 秒轮询一次

      function pollForToken() {
        pollCount++
        console.log(`[Auth] 轮询 token (${pollCount}/${maxPolls})...`)

        fetch(`/auth/poll?key=${encodeURIComponent(authKey)}`)
          .then(res => res.json())
          .then(async data => {
            if (data.token && data.user) {
              // 成功获取 token
              console.log('[Auth] 获取到 token，用户:', data.user.username)
              token.value = data.token
              user.value = data.user
              saveToStorage(data.token, data.user)
              initialized.value = true
            } else if (pollCount < maxPolls) {
              // 继续轮询
              setTimeout(pollForToken, pollInterval)
            } else {
              // 超时
              console.warn('[Auth] 轮询超时，未获取到 token')
            }
          })
          .catch(err => {
            console.error('[Auth] 轮询错误:', err)
            if (pollCount < maxPolls) {
              setTimeout(pollForToken, pollInterval)
            }
          })
      }

      // 延迟开始轮询，给 OAuth 流程一些时间
      setTimeout(pollForToken, pollInterval)

      // 发送请求给扩展，让扩展（父页面）打开 OAuth 弹窗
      window.parent.postMessage({
        type: 'workshop_open_oauth',
        payload: { authUrl }
      }, '*')
    } else {
      // 非 iframe 模式：直接跳转
      window.location.href = '/auth/discord'
    }
  }

  /**
   * 登出
   */
  async function logout() {
    try {
      // 尝试调用服务端登出（清除 session）
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
      })
    } catch (err) {
      console.error('[Auth] 登出请求失败:', err)
    } finally {
      // 无论如何都清除本地状态
      user.value = null
      token.value = null
      clearStorage()
    }
  }

  /**
   * 初始化：从 localStorage 恢复状态并验证
   */
  async function init() {
    if (initialized.value) return
    loadFromStorage()
    // 如果有 token，验证其有效性
    if (token.value) {
      await fetchMe()
    } else {
      // 没有 token，尝试用 session（非 iframe 模式）
      await fetchMe()
    }
  }

  return {
    user,
    token,
    initialized,
    loading,
    isLoggedIn,
    isCreator,
    getToken,
    getAuthHeaders,
    fetchMe,
    loginWithDiscord,
    logout,
    init,
  }
})
