<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useWorkshopStore } from '@/stores/workshop'
import WorkshopPackCard from '@/components/WorkshopPackCard.vue'
import { DEFAULT_TAGS } from '@/config/sections'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const workshopStore = useWorkshopStore()

// ── 工坊 slug ──────────────────────────────────────────────────────────
// ?mine=1 时不强制默认为 steampunk（允许跨工坊查看自己的模组）
const workshopSlug = computed(() => {
  const w = route.query.workshop || null
  return w || (showMine.value ? null : 'steampunk')
})

const currentWorkshop = computed(() =>
  workshopStore.workshops.find(w => w.slug === workshopSlug.value) || null
)
const workshopLabel = computed(() =>
  currentWorkshop.value?.name || workshopSlug.value || '全部'
)

// ── 世界书编辑 ────────────────────────────────────────────────────────
const worldbookEditing = ref(false)
const worldbookDraft = ref('')

function startEditWorldbook() {
  worldbookDraft.value = workshopStore.worldbookName
  worldbookEditing.value = true
}
function saveWorldbook() {
  const name = worldbookDraft.value.trim()
  if (!name) return
  workshopStore.setWorldbookName(workshopSlug.value || 'default', name)
  worldbookEditing.value = false
}
function cancelEditWorldbook() {
  worldbookEditing.value = false
}

// ── 搜索（400ms debounce）————————————————————————————————————————————
// 初始值读取 URL 中的 ?q= 参数（从主页弹窗跳转过来时自动填入）
const searchInput = ref(String(route.query.q || ''))
const activeSearch = ref(String(route.query.q || ''))
// ?mine=1：仅展示当前登录用户自己的模组
const showMine = computed(() => route.query.mine === '1')
let debounceTimer = null
watch(searchInput, (val) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { activeSearch.value = val.trim() }, 400)
})

// ── Tag 多选过滤 ──────────────────────────────────────────────────────
const activeTags = ref([])

// 已加载的 packs 中出现的额外 tag（不含预设 4 个）
const extraTags = computed(() => {
  const seen = new Set()
  workshopStore.packs.forEach(p => {
    (p.tags || []).forEach(t => {
      if (!DEFAULT_TAGS.includes(t)) seen.add(t)
    })
  })
  return [...seen]
})
const allFilterTags = computed(() => [...DEFAULT_TAGS, ...extraTags.value])

function toggleTag(tag) {
  const idx = activeTags.value.indexOf(tag)
  if (idx >= 0) {
    activeTags.value.splice(idx, 1)
  } else {
    activeTags.value.push(tag)
  }
}

function clearTags() {
  activeTags.value = []
}

// 在已加载的 packs 中做客户端多 tag 过滤（后端只支持单 tag）
const filteredPacks = computed(() => {
  if (!activeTags.value.length) return workshopStore.packs
  return workshopStore.packs.filter(p =>
    activeTags.value.every(t => (p.tags || []).includes(t))
  )
})

// ── 登录 toast ────────────────────────────────────────────────────────
const showLoginToast = ref(false)
onMounted(() => {
  if (route.query.login === 'required') {
    showLoginToast.value = true
    setTimeout(() => { showLoginToast.value = false }, 3000)
  }
})

// ── 数据加载 ─────────────────────────────────────────────────────────
const isStEnv = computed(() => workshopStore.isSillyTavernEnv())

async function load(page = 1) {
  await workshopStore.fetchPacks(page, {
    workshop: workshopSlug.value || undefined,
    search: activeSearch.value || undefined,
    // 后端单 tag 过滤：若只选了一个 tag 则直接传给后端，多选时后端不过滤（客户端处理）
    tag: activeTags.value.length === 1 ? activeTags.value[0] : undefined,
    // ?mine=1：仅显示当前用户自己的模组
    authorId: showMine.value ? authStore.user?.id : undefined,
  })
}

// 工坊/搜索/mine 变化时重新拉第 1 页（tag 变化只影响客户端过滤，不重新请求）
watch([workshopSlug, activeSearch, showMine], () => load(1))

// 工坊切换时重新加载对应世界书名称，并关闭编辑态
watch(workshopSlug, (newSlug) => {
  if (newSlug) workshopStore.loadWorldbookForSection(newSlug)
  worldbookEditing.value = false
})

onMounted(async () => {
  // 先加载工坊列表（loadWorldbookForSection 需要 workshops 数据作 fallback）
  await workshopStore.fetchWorkshops()
  if (workshopSlug.value) workshopStore.loadWorldbookForSection(workshopSlug.value)
  await load(1)
  await workshopStore.scanSubscribedPacks()
})

async function goToPage(page) {
  await load(page)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 创建模组时携带当前工坊 workshop 参数
const newModRoute = computed(() => ({
  name: 'workshop-pack-new',
  query: workshopSlug.value ? { workshop: workshopSlug.value } : {},
}))
</script>

<template>
  <div class="page-container py-8">

    <!-- 登录提示 toast -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-3"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showLoginToast"
        class="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-bold shadow-lg"
        style="background:#FFF7ED; color:#EA580C; border:2px solid #FDBA74; box-shadow:3px 3px 0 #FDBA74;"
      >
        请先登录后再操作
      </div>
    </Transition>

    <!-- 页头 -->
    <div class="flex items-center justify-between mb-2 flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <!-- 回到主页 -->
        <RouterLink to="/" class="btn-secondary text-sm">← 主页</RouterLink>
        <h1
          class="text-2xl font-bold"
          style="font-family: 'Fredoka', sans-serif; color: #EA580C;"
        >
          {{ workshopLabel }} 工坊
        </h1>
      </div>

      <div class="flex gap-2 flex-shrink-0">
        <!-- 工坊所有者：编辑工坊 -->
        <RouterLink
          v-if="currentWorkshop && currentWorkshop.author_id && authStore.user?.id === currentWorkshop.author_id"
          :to="{ name: 'workshop-edit', params: { id: currentWorkshop.id } }"
          class="btn-secondary text-sm"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          编辑工坊
        </RouterLink>
        <!-- 已登录：创建模组 -->
        <RouterLink
          v-if="authStore.isLoggedIn && !authStore.loading"
          :to="newModRoute"
          class="btn-primary text-sm"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          创建模组
        </RouterLink>
        <!-- 未登录 -->
        <button
          v-else-if="!authStore.loading && !authStore.isLoggedIn"
          class="btn-secondary text-sm"
          @click="authStore.loginWithDiscord()"
        >
          登录
        </button>
      </div>
    </div>

    <!-- 世界书名称行 -->
    <div class="flex items-start gap-2 mb-5 flex-wrap">
      <span class="text-xs font-semibold mt-1.5" style="color:#A8A29E; font-family:'Nunito',sans-serif; white-space:nowrap;">
        当前世界书：
      </span>
      <template v-if="!worldbookEditing">
        <span
          class="text-xs font-bold px-2.5 py-1 rounded-full"
          style="background:#FFF7ED; color:#78350F; border:1.5px solid #FDBA74; font-family:'Nunito',sans-serif; max-width:min(340px, calc(100vw - 120px)); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:inline-block;"
        >{{ workshopStore.worldbookName }}</span>
        <button
          @click="startEditWorldbook"
          class="p-1 rounded-full transition-colors flex-shrink-0"
          style="color:#A8A29E; border:1.5px solid #E7E5E4; background:#FFFBF0;"
          title="修改目标世界书名称"
        >
          <!-- 铅笔图标 -->
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </template>
      <template v-else>
        <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input
            v-model="worldbookDraft"
            class="input text-xs py-1 w-full sm:w-auto"
            style="min-width:0; max-width:300px; font-family:'Nunito',sans-serif;"
            placeholder="输入世界书名称"
            @keyup.enter="saveWorldbook"
            @keyup.escape="cancelEditWorldbook"
            autofocus
          />
          <button class="btn-primary text-xs py-1 px-3" @click="saveWorldbook">保存</button>
          <button class="btn-secondary text-xs py-1 px-3" @click="cancelEditWorldbook">取消</button>
        </div>
      </template>
      <span v-if="!isStEnv" class="text-xs w-full sm:w-auto" style="color:#FBBF24; font-family:'Nunito',sans-serif;">
        （非 SillyTavern 环境，订阅仅计数）
      </span>
    </div>

    <!-- 搜索栏 + tag 过滤 -->
    <div class="flex flex-col gap-3 mb-6">
      <!-- 搜索输入 -->
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style="color:#A8A29E;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          v-model="searchInput"
          type="text"
          class="input pl-9 text-sm"
          placeholder="搜索模组名称…"
          style="font-family:'Nunito',sans-serif;"
        />
      </div>

      <!-- Tag 过滤 chips -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="tag in allFilterTags"
          :key="tag"
          @click="toggleTag(tag)"
          class="text-xs font-bold px-3 py-1 rounded-full transition-all duration-150"
          :style="activeTags.includes(tag)
            ? 'background:#F97316; color:white; border:2px solid #EA580C; box-shadow:2px 2px 0 #EA580C;'
            : 'background:#FFF7ED; color:#78716C; border:2px solid #E7E5E4;'"
        >
          {{ tag }}
        </button>
        <button
          v-if="activeTags.length"
          @click="clearTags"
          class="text-xs font-bold px-3 py-1 rounded-full transition-all duration-150"
          style="background:#FEF2F2; color:#EF4444; border:2px solid #FECACA;"
        >
          ✕ 清除
        </button>
      </div>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="workshopStore.error"
      class="mb-4 px-4 py-3 rounded-xl text-sm font-semibold"
      style="background: #FEF2F2; color: #EF4444; border: 1.5px solid #FECACA;"
    >
      {{ workshopStore.error }}
    </div>

    <!-- 加载状态 -->
    <div v-if="workshopStore.loading" class="flex flex-col items-center justify-center py-20 gap-3">
      <div
        class="w-10 h-10 rounded-full animate-spin"
        style="border: 3px solid #FED7AA; border-top-color: #F97316;"
      ></div>
      <p class="text-sm" style="color: #A8A29E; font-family: 'Nunito', sans-serif;">加载中…</p>
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="!workshopStore.packs.length"
      class="flex flex-col items-center justify-center py-20 gap-4"
    >
      <svg class="w-16 h-16 opacity-30" viewBox="0 0 64 64" fill="none" stroke="#F97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="8" y="12" width="48" height="40" rx="6"/>
        <line x1="20" y1="26" x2="44" y2="26"/>
        <line x1="20" y1="34" x2="36" y2="34"/>
      </svg>
      <p class="text-base font-semibold" style="color: #C0B8B0; font-family: 'Fredoka', sans-serif;">
        {{ activeSearch || activeTags.length ? '没有匹配的模组' : '还没有任何模组' }}
      </p>
      <RouterLink
        v-if="authStore.isLoggedIn && !activeSearch && !activeTags.length"
        :to="newModRoute"
        class="btn-primary text-sm"
      >
        创建第一个模组
      </RouterLink>
    </div>

    <!-- Pack 列表 -->
    <div
      v-else
      class="grid gap-5"
      style="grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));"
    >
      <WorkshopPackCard
        v-for="pack in filteredPacks"
        :key="pack.id"
        :pack="pack"
      />
    </div>

    <!-- 分页 -->
    <div
      v-if="workshopStore.pagination.totalPages > 1"
      class="flex items-center justify-center gap-2 mt-8 flex-wrap"
    >
      <button
        class="btn-secondary text-sm"
        :disabled="workshopStore.pagination.page <= 1"
        @click="goToPage(workshopStore.pagination.page - 1)"
      >
        上一页
      </button>
      <span class="text-sm px-2" style="color: #A8A29E; font-family: 'Nunito', sans-serif;">
        {{ workshopStore.pagination.page }} / {{ workshopStore.pagination.totalPages }}
      </span>
      <button
        class="btn-secondary text-sm"
        :disabled="workshopStore.pagination.page >= workshopStore.pagination.totalPages"
        @click="goToPage(workshopStore.pagination.page + 1)"
      >
        下一页
      </button>
    </div>

  </div>
</template>
