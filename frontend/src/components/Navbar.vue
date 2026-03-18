<template>
  <!-- 手绘风格导航栏：奶油背景 + 橙色笔触底部边框 -->
  <header
    class="sticky top-0 z-50 backdrop-blur-md"
    style="background: rgba(255, 251, 240, 0.93); border-bottom: 3px solid #FDBA74; box-shadow: 0 3px 0 0 #FDBA74;"
  >
    <div class="page-container">
      <div class="flex items-center justify-between min-h-[52px] sm:h-16">
        <!-- Logo：手绘铅笔图标 + 标题 -->
        <RouterLink
          to="/"
          class="flex items-center gap-2.5 transition-transform duration-200 hover:scale-105"
          style="text-decoration: none;"
        >
          <svg class="w-8 h-8" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 26 L8 18 L22 4 Q25 1 28 4 Q31 7 28 10 L14 24 Z" stroke="#EA580C" stroke-width="2.5" fill="#FFF7ED" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 18 L14 24" stroke="#EA580C" stroke-width="2" stroke-linecap="round"/>
            <path d="M5 26 L6 23 L9 26 Z" fill="#EAB308" stroke="#CA8A04" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19 7 L25 13" stroke="#F97316" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span
            style="font-family: 'Fredoka', sans-serif; font-size: clamp(0.9rem, 3.5vw, 1.35rem); font-weight: 700; color: #EA580C; letter-spacing: 0.01em; white-space: nowrap;"
          >SillyTavern创意工坊</span>
        </RouterLink>

        <!-- 导航操作区 -->
        <div class="flex items-center gap-3">

          <!-- 用户菜单（已登录） -->
          <div v-if="authStore.isLoggedIn" class="relative" ref="menuRef">
            <button
              @click="menuOpen = !menuOpen"
              class="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all duration-200"
              style="border-radius: 999px; border: 2.5px solid #FDBA74; background: #FFFBF0; box-shadow: 2px 2px 0 #FDBA74;"
              aria-label="用户菜单"
            >
              <img
                :src="authStore.user.avatar"
                :alt="authStore.user.username"
                class="w-7 h-7 rounded-full object-cover"
                style="border: 2px solid #F97316;"
              />
              <span class="hidden sm:block text-sm font-bold max-w-[100px] truncate" style="font-family: 'Nunito', sans-serif; color: #EA580C;">
                {{ authStore.user.display_name || authStore.user.username }}
              </span>
              <svg
                class="w-4 h-4 transition-transform duration-200"
                :class="{ 'rotate-180': menuOpen }"
                viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="2.5"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            <!-- 下拉菜单：手绘便签风格 -->
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 scale-95 -translate-y-2"
              enter-to-class="opacity-100 scale-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100 scale-100 translate-y-0"
              leave-to-class="opacity-0 scale-95 -translate-y-2"
            >
              <div
                v-if="menuOpen"
                class="absolute right-0 mt-2 w-52 py-2 z-50"
                style="background: #FFFBF0; border: 2.5px solid #FDBA74; border-radius: 16px; box-shadow: 4px 4px 0 #FDBA74; transform: rotate(0.5deg);"
              >
                <!-- 个人主页 -->
                <RouterLink
                  to="/profile"
                  class="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold transition-colors"
                  style="font-family: 'Nunito', sans-serif; color: #EA580C;"
                  @click="menuOpen = false"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  个人主页
                </RouterLink>

                <!-- 分割线 -->
                <div style="border-top: 1.5px dashed #FED7AA; margin: 4px 12px;"></div>

                <button
                  @click="handleLogout"
                  class="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold cursor-pointer transition-colors"
                  style="font-family: 'Nunito', sans-serif; color: #EF4444;"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  退出登录
                </button>
              </div>
            </Transition>
          </div>

          <!-- 登录按钮（未登录） -->
          <button
            v-else-if="!authStore.loading"
            @click="authStore.loginWithDiscord()"
            class="btn-primary text-sm"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            <span class="hidden sm:inline">用 Discord </span>登录
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { onClickOutside } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const menuOpen = ref(false)
const menuRef = ref(null)

onClickOutside(menuRef, () => {
  menuOpen.value = false
})

async function handleLogout() {
  menuOpen.value = false
  await authStore.logout()
  router.push('/')
}
</script>
