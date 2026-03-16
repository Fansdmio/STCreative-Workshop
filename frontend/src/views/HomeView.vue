<template>
  <div class="flex-1">
    <!-- Hero 区域 -->
    <div
      class="relative overflow-hidden py-20 px-4"
      style="background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 45%, #FEF9C3 100%);"
    >
      <!-- 手绘装饰 SVG -->
      <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
        <svg class="absolute -top-8 -right-8 w-52 h-52 opacity-20" viewBox="0 0 160 160" fill="none">
          <circle cx="80" cy="80" r="60" stroke="#F97316" stroke-width="3" stroke-dasharray="12 6" stroke-linecap="round"/>
          <circle cx="80" cy="80" r="40" stroke="#EAB308" stroke-width="2" stroke-dasharray="8 5" stroke-linecap="round"/>
        </svg>
        <svg class="absolute top-10 left-8 w-10 h-10 opacity-25" viewBox="0 0 40 40" fill="none">
          <path d="M20 4 L23 15 L35 15 L26 22 L29 34 L20 27 L11 34 L14 22 L5 15 L17 15 Z" stroke="#EC4899" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg class="absolute bottom-6 left-1/4 w-36 h-8 opacity-20" viewBox="0 0 144 32" fill="none">
          <path d="M4 16 Q24 4 44 16 Q64 28 84 16 Q104 4 124 16 Q136 28 140 16" stroke="#06B6D4" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        </svg>
        <svg class="absolute bottom-8 right-16 w-12 h-12 opacity-15" viewBox="0 0 48 48" fill="none">
          <path d="M24 6 L44 42 L4 42 Z" stroke="#22C55E" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <div class="page-container text-center relative">
        <!-- 徽标文字 -->
        <div
          class="inline-block mb-5 px-4 py-1.5 text-sm font-bold rounded-full"
          style="background: #FFF7ED; color: #EA580C; border: 2px solid #FDBA74; font-family: 'Nunito', sans-serif;"
        >
          SillyTavern 扩展
        </div>

        <!-- 主标题 -->
        <h1
          class="text-4xl sm:text-5xl font-bold mb-4"
          style="font-family: 'Fredoka', sans-serif; color: #9A3412; letter-spacing: 0.01em; text-shadow: 3px 3px 0 #FED7AA;"
        >
          SillyTavern 创意工坊
        </h1>

        <!-- 手绘下划线 -->
        <svg class="mx-auto mb-6 w-72 h-4" viewBox="0 0 288 16" fill="none">
          <path d="M4 10 Q48 2 96 8 Q144 14 192 8 Q240 2 284 10" stroke="#F97316" stroke-width="3" fill="none" stroke-linecap="round"/>
        </svg>

        <p
          class="text-lg max-w-xl mx-auto mb-8"
          style="font-family: 'Nunito', sans-serif; color: #78350F; font-weight: 500; line-height: 1.75;"
        >
          分享和订阅 SillyTavern 世界书条目模组（MOD）。<br class="hidden sm:block"/>
          一键插入世界书，让创作灵感触手可及。
        </p>

        <!-- CTA 按钮组 -->
        <div class="flex flex-wrap items-center justify-center gap-4">
          <!-- 进入工坊按钮 -->
          <button
            @click="showWorkshopModal = true"
            class="inline-flex items-center gap-2 font-bold transition-all duration-200 cursor-pointer"
            style="font-family: 'Fredoka', sans-serif; font-size: 1.05rem; background: #F97316; color: white; padding: 12px 28px; border-radius: 999px; box-shadow: 4px 4px 0 #C2410C, 0 0 0 2.5px #C2410C; transform: rotate(-0.5deg);"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            进入工坊
          </button>

          <button
            v-if="!authStore.isLoggedIn && !authStore.loading"
            @click="authStore.loginWithDiscord()"
            class="inline-flex items-center gap-2 font-bold cursor-pointer transition-all duration-200"
            style="font-family: 'Fredoka', sans-serif; font-size: 1.05rem; background: #5865F2; color: white; padding: 12px 28px; border-radius: 999px; box-shadow: 4px 4px 0 #3B43BE, 0 0 0 2.5px #3B43BE; transform: rotate(0.5deg);"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Discord 登录
          </button>

          <!-- 已登录但非创作者：申请成为创作者（未登录也显示，方便引导） -->
          <RouterLink
            v-if="!authStore.isCreator && !authStore.loading"
            to="/creator/apply"
            class="inline-flex items-center gap-2 font-bold cursor-pointer transition-all duration-200"
            style="font-family: 'Fredoka', sans-serif; font-size: 1.05rem; background: #FFFBF0; color: #EA580C; padding: 12px 28px; border-radius: 999px; box-shadow: 4px 4px 0 #EA580C, 0 0 0 2.5px #EA580C; transform: rotate(0.5deg); text-decoration: none;"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            申请成为创作者
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- 选择工坊弹窗 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showWorkshopModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          style="background: rgba(0,0,0,0.35);"
          @click.self="showWorkshopModal = false"
        >
          <div
            class="w-full max-w-md p-6 flex flex-col gap-5"
            style="background:#FFFBF0; border:2.5px solid #FDBA74; border-radius:24px; box-shadow:6px 6px 0 #FDBA74;"
          >
            <!-- 标题栏 -->
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-bold" style="font-family:'Fredoka',sans-serif; color:#9A3412;">选择工坊</h3>
              <button
                @click="showWorkshopModal = false"
                class="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                style="color:#A8A29E; border:1.5px solid #E7E5E4; background:#FFF7ED;"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <!-- 搜索框 -->
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style="color:#A8A29E;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                v-model="modalSearch"
                type="text"
                class="input pl-9 text-sm w-full"
                placeholder="搜索工坊模组…"
                style="font-family:'Nunito',sans-serif;"
                @keyup.enter="goSearch"
              />
            </div>
            <button
              v-if="modalSearch.trim()"
              class="btn-primary text-sm"
              @click="goSearch"
            >
              搜索
            </button>

            <!-- 工坊列表（动态加载） -->
            <div v-if="workshopStore.workshopsLoading" class="flex justify-center py-4">
              <div class="w-6 h-6 rounded-full animate-spin" style="border:2px solid #FED7AA; border-top-color:#F97316;"></div>
            </div>
            <div v-else class="grid grid-cols-2 gap-4">
              <RouterLink
                v-for="w in workshopStore.workshops"
                :key="w.id"
                :to="`/workshop?workshop=${w.slug}`"
                class="flex flex-col items-center gap-2 p-5 rounded-2xl transition-all duration-200 cursor-pointer"
                style="background:#FFF7ED; border:2.5px solid #FDBA74; box-shadow:4px 4px 0 #FDBA74; text-decoration:none;"
                @click="showWorkshopModal = false"
              >
                <span class="font-bold text-base text-center" style="font-family:'Fredoka',sans-serif; color:#78350F;">{{ w.name }}工坊</span>
                <span class="text-xs" style="color:#A8A29E; font-family:'Nunito',sans-serif;">进入 →</span>
              </RouterLink>
              <div
                v-if="!workshopStore.workshops.length"
                class="col-span-2 text-center py-4 text-sm"
                style="color:#A8A29E; font-family:'Nunito',sans-serif;"
              >
                暂无工坊
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 特性介绍区 -->
    <div class="page-container py-16">
      <h2
        class="text-center text-2xl font-bold mb-10"
        style="font-family: 'Fredoka', sans-serif; color: #9A3412;"
      >
        为什么选择创意工坊？
      </h2>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <!-- 特性卡片 1 -->
        <div class="card p-6 flex flex-col items-center text-center gap-3">
          <div
            class="w-12 h-12 rounded-full flex items-center justify-center"
            style="background: #FFF7ED; border: 2px solid #FDBA74;"
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22c1.1 0 2-.9 2-2H10c0 1.1.9 2 2 2z"/>
              <path d="M18 16V11a6 6 0 0 0-5-5.91V4a1 1 0 0 0-2 0v1.09A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z"/>
            </svg>
          </div>
          <h3 class="font-bold text-base" style="font-family: 'Fredoka', sans-serif; color: #431407;">一键订阅</h3>
          <p class="text-sm" style="color: #78716C; font-family: 'Nunito', sans-serif; line-height: 1.65;">
            在 SillyTavern 环境中直接订阅模组，所有世界书条目自动插入，无需手动导入。
          </p>
        </div>

        <!-- 特性卡片 2 -->
        <div class="card p-6 flex flex-col items-center text-center gap-3">
          <div
            class="w-12 h-12 rounded-full flex items-center justify-center"
            style="background: #FFF7ED; border: 2px solid #FDBA74;"
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <h3 class="font-bold text-base" style="font-family: 'Fredoka', sans-serif; color: #431407;">灵活创作</h3>
          <p class="text-sm" style="color: #78716C; font-family: 'Nunito', sans-serif; line-height: 1.65;">
            任何人都可以申请成为创作者，发布自己的世界书模组，让创意自由流动，与社区一同书写无限故事。
          </p>
        </div>

        <!-- 特性卡片 3 -->
        <div class="card p-6 flex flex-col items-center text-center gap-3">
          <div
            class="w-12 h-12 rounded-full flex items-center justify-center"
            style="background: #FFF7ED; border: 2px solid #FDBA74;"
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h3 class="font-bold text-base" style="font-family: 'Fredoka', sans-serif; color: #431407;">社区共创</h3>
          <p class="text-sm" style="color: #78716C; font-family: 'Nunito', sans-serif; line-height: 1.65;">
            点赞和订阅你喜欢的模组，热门内容自动置顶，共同构建丰富的创作生态。
          </p>
        </div>
      </div>
    </div>

    <!-- 关于 / 鸣谢区 -->
    <div style="background: #FFF7ED; border-top: 2px dashed #FDBA74;">
      <div class="page-container py-12 text-center">
        <svg class="mx-auto mb-4 w-56 h-4" viewBox="0 0 224 16" fill="none">
          <path d="M4 8 Q28 2 56 8 Q84 14 112 8 Q140 2 168 8 Q196 14 220 8" stroke="#F97316" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        </svg>
        <p
          class="text-base mb-2"
          style="font-family: 'Fredoka', sans-serif; color: #92400E; font-weight: 600; letter-spacing: 0.02em;"
        >
          用文字记录感动 · 每一个故事，都值得被记住
        </p>
        <p
          class="text-sm mb-1"
          style="font-family: 'Nunito', sans-serif; color: #78350F;"
        >
          由 <strong>Single</strong> 制作
        </p>
        <p
          class="text-sm"
          style="font-family: 'Nunito', sans-serif; color: #A8A29E;"
        >
          感谢 <strong style="color: #78716C;">wojwo</strong> 的技术指导与支持
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useWorkshopStore } from '@/stores/workshop'

const authStore = useAuthStore()
const workshopStore = useWorkshopStore()
const router = useRouter()
// 控制工坊选择弹窗显示
const showWorkshopModal = ref(false)
// 弹窗内搜索输入
const modalSearch = ref('')

onMounted(() => {
  workshopStore.fetchWorkshops()
})

function goSearch() {
  const q = modalSearch.value.trim()
  if (!q) return
  showWorkshopModal.value = false
  modalSearch.value = ''
  router.push({ path: '/workshop', query: { q } })
}
</script>
