<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkshopStore, authFetch } from '@/stores/workshop'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const workshopStore = useWorkshopStore()
const authStore = useAuthStore()

const myPacks = ref([])
const myPacksLoading = ref(false)

onMounted(async () => {
  await workshopStore.fetchMySubscriptions()
  
  if (authStore.loading) {
    const unwatch = watch(() => authStore.loading, (loading) => {
      if (!loading && authStore.user) {
        fetchMyPacks()
      }
      unwatch()
    })
  } else if (authStore.user) {
    fetchMyPacks()
  }
})

async function fetchMyPacks() {
  myPacksLoading.value = true
  try {
    const res = await authFetch(`/api/workshop?author_id=${authStore.user.id}&limit=50`)
    const json = await res.json()
    if (res.ok) {
      // 兼容两种返回格式：json.packs 或 json.data
      myPacks.value = json.packs || json.data || []
    }
  } catch (err) {
    console.error('获取发布的模组失败:', err)
  } finally {
    myPacksLoading.value = false
  }
}

// 跳转到模组详情
function goToPack(packId) {
  router.push({ name: 'workshop-pack-detail', params: { packId } })
}

// 取消订阅
async function handleUnsubscribe(pack) {
  await workshopStore.toggleSubscribe(pack)
  // 重新拉取列表，确保显示最新状态
  await workshopStore.fetchMySubscriptions()
}

// 格式化日期
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="page-container py-8 max-w-3xl mx-auto">

    <!-- 顶部返回按钮 -->
    <div class="mb-6">
      <RouterLink :to="{ name: 'home' }" class="btn-secondary text-sm">
        ← 返回主页
      </RouterLink>
    </div>

    <!-- 页头 -->
    <div class="mb-8 flex items-center gap-4">
      <img
        :src="authStore.user?.avatar"
        :alt="authStore.user?.username"
        class="w-14 h-14 rounded-full object-cover flex-shrink-0"
        style="border: 3px solid #FDBA74; box-shadow: 3px 3px 0 #FDBA74;"
      />
      <div>
        <h1
          class="text-2xl font-bold"
          style="font-family: 'Fredoka', sans-serif; color: #431407;"
        >
          {{ authStore.user?.display_name || authStore.user?.username }}
        </h1>
        <p class="text-sm" style="color: #A8A29E; font-family: 'Nunito', sans-serif;">
          @{{ authStore.user?.username }}
        </p>
      </div>
    </div>

    <!-- 我的订阅 -->
    <section>
      <h2
        class="font-bold text-lg mb-4 flex items-center gap-2"
        style="font-family: 'Fredoka', sans-serif; color: #EA580C;"
      >
        <!-- 铃铛图标 -->
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22c1.1 0 2-.9 2-2H10c0 1.1.9 2 2 2z"/>
          <path d="M18 16V11a6 6 0 0 0-5-5.91V4a1 1 0 0 0-2 0v1.09A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
        已订阅的模组
        <span
          class="text-xs font-bold px-2 py-0.5 rounded-full ml-1"
          style="background: #FFF7ED; color: #EA580C; border: 1.5px solid #FDBA74;"
        >
          {{ workshopStore.mySubscriptions.length }}
        </span>
      </h2>

      <!-- 加载中 -->
      <div v-if="workshopStore.mySubscriptionsLoading" class="flex justify-center py-16">
        <div class="w-9 h-9 rounded-full animate-spin" style="border: 3px solid #FED7AA; border-top-color: #F97316;"></div>
      </div>

      <!-- 错误提示 -->
      <div
        v-else-if="workshopStore.error"
        class="px-4 py-3 rounded-xl text-sm font-semibold"
        style="background: #FEF2F2; color: #EF4444; border: 1.5px solid #FECACA;"
      >
        {{ workshopStore.error }}
      </div>

      <!-- 空状态 -->
      <div
        v-else-if="!workshopStore.mySubscriptions.length"
        class="flex flex-col items-center justify-center py-16 gap-3"
        style="border: 2px dashed #FED7AA; border-radius: 16px;"
      >
        <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="#FDBA74" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22c1.1 0 2-.9 2-2H10c0 1.1.9 2 2 2z"/>
          <path d="M18 16V11a6 6 0 0 0-5-5.91V4a1 1 0 0 0-2 0v1.09A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
        <p class="text-sm font-semibold" style="color: #C0B8B0; font-family: 'Fredoka', sans-serif;">
          还没有订阅任何模组
        </p>
      </div>

      <!-- 订阅列表 -->
      <div v-else class="flex flex-col gap-3">
        <div
          v-for="pack in workshopStore.mySubscriptions"
          :key="pack.id"
          class="card flex flex-col gap-3 p-5 cursor-pointer"
          @click="goToPack(pack.id)"
        >
          <!-- 作者行 -->
          <div class="flex items-center gap-2">
            <img
              :src="pack.author.avatar"
              :alt="pack.author.username"
              class="w-6 h-6 rounded-full object-cover flex-shrink-0"
              style="border: 1.5px solid #FDBA74;"
            />
            <span class="text-xs font-semibold truncate" style="color: #A8A29E; font-family: 'Nunito', sans-serif;">
              {{ pack.author.display_name || pack.author.username }}
            </span>
            <!-- 订阅日期 -->
            <span class="ml-auto text-xs" style="color: #C0B8B0; font-family: 'Nunito', sans-serif; white-space: nowrap;">
              {{ formatDate(pack.subscribed_at) }} 订阅
            </span>
          </div>

          <!-- 标题 -->
          <h3
            class="font-bold text-base leading-snug"
            style="font-family: 'Fredoka', sans-serif; color: #431407;"
          >
            {{ pack.title }}
          </h3>

          <!-- 描述 -->
          <p
            v-if="pack.description"
            class="text-sm line-clamp-2"
            style="color: #78716C; font-family: 'Nunito', sans-serif;"
          >
            {{ pack.description }}
          </p>

          <!-- 底部行：统计 + 取消订阅按钮 -->
          <div class="flex items-center justify-between mt-1 flex-wrap gap-2">
            <div class="flex items-center gap-3 text-xs" style="color: #A8A29E; font-family: 'Nunito', sans-serif;">
              <span>{{ pack.entry_count }} 条条目</span>
              <span>{{ pack.like_count }} 点赞</span>
            </div>

            <!-- 取消订阅按钮（阻止冒泡，避免跳转详情） -->
            <button
              class="btn-danger text-xs"
              @click.stop="handleUnsubscribe(pack)"
            >
              取消订阅
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 自己发布的模组 -->
    <section class="mt-12">
      <h2
        class="font-bold text-lg mb-4 flex items-center gap-2"
        style="font-family: 'Fredoka', sans-serif; color: #7C3AED;"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z"/>
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
          <path d="M2 2l7.586 7.586"/>
          <circle cx="11" cy="11" r="2"/>
        </svg>
        自己发布的模组
        <span
          class="text-xs font-bold px-2 py-0.5 rounded-full ml-1"
          style="background: #F3E8FF; color: #7C3AED; border: 1.5px solid #C4B5FD;"
        >
          {{ myPacks.length }}
        </span>
      </h2>

      <!-- 加载中 -->
      <div v-if="myPacksLoading" class="flex justify-center py-16">
        <div class="w-9 h-9 rounded-full animate-spin" style="border: 3px solid #E9D5FF; border-top-color: #8B5CF6;"></div>
      </div>

      <!-- 空状态 -->
      <div
        v-else-if="!myPacks.length"
        class="flex flex-col items-center justify-center py-16 gap-3"
        style="border: 2px dashed #E9D5FF; border-radius: 16px;"
      >
        <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
        <p class="text-sm font-semibold" style="color: #A78BFA; font-family: 'Fredoka', sans-serif;">
          还没有发布过任何模组
        </p>
      </div>

      <!-- 列表 -->
      <div v-else class="flex flex-col gap-3">
        <div
          v-for="pack in myPacks"
          :key="pack.id"
          class="card flex flex-col gap-3 p-5 cursor-pointer"
          @click="goToPack(pack.id)"
        >
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold px-2 py-0.5 rounded-md" style="background:#FEF3C7; color:#9333EA; font-family:'Nunito',sans-serif;">
              {{ pack.workshop_name }}
            </span>
            <span class="ml-auto text-xs" style="color: #C0B8B0; font-family: 'Nunito', sans-serif;">
              {{ formatDate(pack.created_at) }} 发布
            </span>
          </div>

          <h3 class="font-bold text-base leading-snug" style="font-family: 'Fredoka', sans-serif; color: #431407;">
            {{ pack.title }}
          </h3>

          <p v-if="pack.description" class="text-sm line-clamp-2" style="color: #78716C; font-family: 'Nunito', sans-serif;">
            {{ pack.description }}
          </p>

          <div class="flex items-center gap-3 mt-1 text-xs" style="color: #A8A29E; font-family: 'Nunito', sans-serif;">
            <span>{{ pack.entry_count }} 条条目</span>
            <span>{{ pack.sub_count }} 订阅</span>
            <span>{{ pack.like_count }} 点赞</span>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>
