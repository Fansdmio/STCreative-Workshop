<template>
  <div class="flex-1">
    <!-- Hero：手绘风格，珊瑚橙渐变 -->
    <div class="relative overflow-hidden py-16 px-4" style="background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 40%, #FEF9C3 100%);">
      <!-- Hero 手绘装饰 SVG -->
      <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
        <!-- 大圆圈涂鸦 -->
        <svg class="absolute -top-8 -right-8 w-48 h-48 opacity-20" viewBox="0 0 160 160" fill="none">
          <circle cx="80" cy="80" r="60" stroke="#F97316" stroke-width="3" stroke-dasharray="12 6" stroke-linecap="round"/>
          <circle cx="80" cy="80" r="40" stroke="#EAB308" stroke-width="2" stroke-dasharray="8 5" stroke-linecap="round"/>
        </svg>
        <!-- 左侧星星 -->
        <svg class="absolute top-8 left-6 w-10 h-10 opacity-30" viewBox="0 0 40 40" fill="none" style="animation: float-up 4s ease-in-out infinite;">
          <path d="M20 4 L23 15 L35 15 L26 22 L29 34 L20 27 L11 34 L14 22 L5 15 L17 15 Z" stroke="#EC4899" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <!-- 右侧波浪线 -->
        <svg class="absolute bottom-4 left-1/4 w-32 h-8 opacity-25" viewBox="0 0 128 32" fill="none">
          <path d="M4 16 Q20 4 36 16 Q52 28 68 16 Q84 4 100 16 Q116 28 124 16" stroke="#06B6D4" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        </svg>
        <!-- 右下三角 -->
        <svg class="absolute bottom-6 right-12 w-12 h-12 opacity-20" viewBox="0 0 48 48" fill="none" style="animation: wiggle 3s ease-in-out infinite;">
          <path d="M24 6 L44 42 L4 42 Z" stroke="#22C55E" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <!-- 手绘下划线装饰（标题下方） -->
        <svg class="absolute top-1/2 left-1/2 -translate-x-1/2 w-72 h-4 opacity-30" style="margin-top: 24px;" viewBox="0 0 288 16" fill="none">
          <path d="M4 10 Q48 2 96 8 Q144 14 192 8 Q240 2 284 10" stroke="#F97316" stroke-width="3" fill="none" stroke-linecap="round"/>
        </svg>
      </div>

      <div class="page-container text-center relative">
        <!-- 手绘标题 -->
        <h1
          class="text-4xl sm:text-5xl font-bold mb-4"
          style="font-family: 'Fredoka', sans-serif; color: #9A3412; letter-spacing: 0.01em; text-shadow: 3px 3px 0 #FED7AA;"
        >
          分享你的故事
        </h1>
        <!-- 手绘下划线 -->
        <svg class="mx-auto mb-5 w-64 h-4" viewBox="0 0 256 16" fill="none">
          <path d="M4 10 Q40 2 80 9 Q120 16 160 9 Q200 2 252 10" stroke="#F97316" stroke-width="3" fill="none" stroke-linecap="round"/>
        </svg>
        <p
          class="text-lg max-w-xl mx-auto mb-8"
          style="font-family: 'Nunito', sans-serif; color: #78350F; font-weight: 500;"
        >
          一个让创作者分享和发现故事的社区。用文字记录感动，让故事流传。
        </p>
        <div class="flex flex-wrap items-center justify-center gap-3">
          <!-- 未登录：Discord 登录按钮 -->
          <button
            v-if="!authStore.isLoggedIn"
            @click="authStore.loginWithDiscord()"
            class="inline-flex items-center gap-2 font-bold cursor-pointer transition-all duration-200"
            style="font-family: 'Fredoka', sans-serif; font-size: 1rem; background: #F97316; color: white; padding: 10px 24px; border-radius: 999px; box-shadow: 4px 4px 0 #C2410C, 0 0 0 2.5px #C2410C; transform: rotate(-0.5deg);"
            onmouseover="this.style.transform='rotate(0.5deg) translateY(-2px)'; this.style.boxShadow='5px 5px 0 #9A3412, 0 0 0 2.5px #9A3412';"
            onmouseout="this.style.transform='rotate(-0.5deg)'; this.style.boxShadow='4px 4px 0 #C2410C, 0 0 0 2.5px #C2410C';"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            用 Discord 登录并发布
          </button>
          <!-- 已登录：发布故事按钮 -->
          <RouterLink
            v-else
            to="/upload"
            class="inline-flex items-center gap-2 font-bold transition-all duration-200"
            style="font-family: 'Fredoka', sans-serif; font-size: 1rem; background: #F97316; color: white; padding: 10px 24px; border-radius: 999px; box-shadow: 4px 4px 0 #C2410C, 0 0 0 2.5px #C2410C; transform: rotate(-0.5deg);"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            发布新故事
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- Login required toast -->
    <Transition name="fade">
      <div v-if="showLoginToast" class="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-amber-50 border border-amber-200 text-amber-800 px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
        请先登录后再发布故事
      </div>
    </Transition>

    <!-- Main content -->
    <div class="page-container py-10">
      <!-- Tag filter section -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold" style="font-family: 'Fredoka', sans-serif; color: #9A3412;">浏览故事</h2>
          <span class="text-sm" style="color: #78350F; font-family: 'Nunito', sans-serif;">共 {{ storiesStore.pagination.total }} 篇</span>
        </div>
        <TagFilter
          :tags="storiesStore.tags"
          :active-tag="storiesStore.activeTag"
          :total="storiesStore.pagination.total"
          @change="onTagChange"
        />
      </div>

      <!-- Loading skeleton -->
      <div v-if="storiesStore.loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <div v-for="i in 12" :key="i" class="card p-5 animate-pulse">
          <div class="flex gap-1.5 mb-3">
            <div class="h-5 w-16 bg-orange-100 rounded-full"></div>
            <div class="h-5 w-12 bg-orange-100 rounded-full"></div>
          </div>
          <div class="h-5 bg-gray-200 rounded mb-2 w-3/4"></div>
          <div class="h-4 bg-gray-100 rounded mb-1.5 w-full"></div>
          <div class="h-4 bg-gray-100 rounded mb-1.5 w-5/6"></div>
          <div class="h-4 bg-gray-100 rounded mb-4 w-4/6"></div>
          <div class="flex items-center gap-2 pt-3 border-t border-gray-100">
            <div class="w-7 h-7 bg-gray-200 rounded-full"></div>
            <div class="h-3 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="storiesStore.error" class="text-center py-20">
        <div class="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <svg class="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p class="text-red-600 font-medium mb-3">加载失败</p>
        <button @click="loadStories" class="btn-secondary">重试</button>
      </div>

      <!-- Empty state -->
      <div v-else-if="storiesStore.stories.length === 0" class="text-center py-20">
        <div class="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
          <svg class="w-8 h-8 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <p class="text-gray-500 font-medium mb-1">
          {{ storiesStore.activeTag ? `"${storiesStore.activeTag}" 标签下暂无故事` : '还没有故事' }}
        </p>
        <p class="text-gray-400 text-sm mb-4">成为第一个分享故事的人吧</p>
        <RouterLink v-if="authStore.isLoggedIn" to="/upload" class="btn-primary">发布第一篇</RouterLink>
        <button v-else @click="authStore.loginWithDiscord()" class="btn-primary">登录后发布</button>
      </div>

      <!-- Story grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <StoryCard
          v-for="story in storiesStore.stories"
          :key="story.id"
          :story="story"
          @tag-click="onTagChange"
        />
      </div>

      <!-- Pagination -->
      <div v-if="storiesStore.pagination.totalPages > 1" class="flex items-center justify-center gap-2 mt-10">
        <button
          class="btn-secondary px-4 py-2 text-sm"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <template v-for="page in visiblePages" :key="page">
          <span v-if="page === '...'" class="px-2 text-gray-400">…</span>
          <button
            v-else
            class="w-9 h-9 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer"
            :class="page === currentPage
              ? 'bg-orange-500 text-white'
              : 'text-orange-700 hover:bg-orange-100'"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
        </template>

        <button
          class="btn-secondary px-4 py-2 text-sm"
          :disabled="currentPage >= storiesStore.pagination.totalPages"
          @click="goToPage(currentPage + 1)"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useStoriesStore } from '@/stores/stories'
import StoryCard from '@/components/StoryCard.vue'
import TagFilter from '@/components/TagFilter.vue'

const authStore = useAuthStore()
const storiesStore = useStoriesStore()
const route = useRoute()
const router = useRouter()

const currentPage = ref(1)
const showLoginToast = ref(false)

// Show login required toast
if (route.query.login === 'required') {
  showLoginToast.value = true
  setTimeout(() => { showLoginToast.value = false }, 3000)
  router.replace({ query: {} })
}

const visiblePages = computed(() => {
  const total = storiesStore.pagination.totalPages
  const current = currentPage.value
  const pages = []

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
    return pages
  }

  pages.push(1)
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
})

async function loadStories() {
  await storiesStore.fetchStories(currentPage.value, storiesStore.activeTag)
}

async function onTagChange(tag) {
  storiesStore.setActiveTag(tag === storiesStore.activeTag ? null : tag)
  currentPage.value = 1
  await loadStories()
}

async function goToPage(page) {
  currentPage.value = page
  await loadStories()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(() => route.query.login, (val) => {
  if (val === 'failed') {
    router.replace({ query: {} })
  }
})

onMounted(async () => {
  await Promise.all([
    storiesStore.fetchStories(1, null),
    storiesStore.fetchTags(),
  ])
})
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
