<script setup>
/**
 * OAuth 回调页面（弹窗模式）
 * 
 * 此页面在 OAuth 弹窗中加载，用于：
 * 1. 确认登录状态（调用 fetchMe）
 * 2. 通知打开此弹窗的窗口（扩展）登录已完成
 * 3. 尝试关闭弹窗
 */
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore()
const message = ref('正在确认登录状态...')

onMounted(async () => {
  const success = route.query.success === '1'
  
  if (success) {
    // 调用 fetchMe 确认登录状态
    await authStore.fetchMe()
    
    if (authStore.isLoggedIn) {
      message.value = '登录成功！此窗口将自动关闭...'
      
      // 通知 opener（如果有）登录已完成
      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'oauth_login_complete', success: true }, '*')
        } catch (e) {
          console.warn('[OAuth] 无法通知 opener:', e)
        }
      }
    } else {
      message.value = '登录确认失败，请关闭此窗口后重试'
    }
  } else {
    message.value = '登录失败，请关闭此窗口后重试'
  }
  
  // 尝试关闭弹窗
  setTimeout(() => {
    try {
      window.close()
    } catch (e) {
      // 如果无法关闭，提示用户手动关闭
      message.value += '\n\n如果窗口没有自动关闭，请手动关闭此窗口。'
    }
  }, 800)
})
</script>

<template>
  <div class="oauth-callback">
    <div class="oauth-callback-card">
      <div class="oauth-callback-icon">
        <i class="fa-solid fa-circle-notch fa-spin"></i>
      </div>
      <p class="oauth-callback-message">{{ message }}</p>
    </div>
  </div>
</template>

<style scoped>
.oauth-callback {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #FFFBF0;
}

.oauth-callback-card {
  background: white;
  padding: 2rem 3rem;
  border-radius: 16px;
  box-shadow: 3px 3px 0 #F97316;
  border: 2px solid #F97316;
  text-align: center;
}

.oauth-callback-icon {
  font-size: 2rem;
  color: #F97316;
  margin-bottom: 1rem;
}

.oauth-callback-message {
  font-family: 'Nunito', sans-serif;
  font-size: 1rem;
  color: #374151;
}
</style>
