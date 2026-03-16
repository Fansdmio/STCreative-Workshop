<script setup>
import { onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useWorkshopStore } from '@/stores/workshop'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const workshopStore = useWorkshopStore()
const authStore = useAuthStore()

const packId = computed(() => parseInt(route.params.packId))
const pack = computed(() => workshopStore.currentPack)
const isOwner = computed(() => authStore.user && pack.value && authStore.user.id === pack.value.author.id)
// 判断用户是否可编辑某条目（条目作者本人 或 pack 作者）
function canEditEntry(entry) {
  if (!authStore.user) return false
  return authStore.user.id === entry.author_id || isOwner.value
}
const isStEnv = computed(() => workshopStore.isSillyTavernEnv())

// 返回工坊时携带分区参数
function goBackToWorkshop() {
  const section = pack.value?.section
  router.push({
    name: 'workshop',
    query: section && section !== 'steampunk' ? { world: section } : {},
  })
}

onMounted(async () => {
  const result = await workshopStore.fetchPack(packId.value)
  if (!result) {
    router.push({ name: 'workshop' })
    return
  }
  // 按 pack 所属分区设置世界书名称
  if (result.section) {
    workshopStore.loadWorldbookForSection(result.section)
  }
  await workshopStore.scanSubscribedPacks()
})

async function handleLike() {
  if (!authStore.isLoggedIn) { authStore.loginWithDiscord(); return }
  await workshopStore.toggleLike(packId.value)
}

async function handleSubscribe() {
  if (!authStore.isLoggedIn) { authStore.loginWithDiscord(); return }
  await workshopStore.toggleSubscribe(pack.value)
}

async function handleDeletePack() {
  if (!confirm('确定要删除这个模组吗？所有条目也会一并删除。')) return
  const ok = await workshopStore.deletePack(packId.value)
  if (ok) goBackToWorkshop()
}

async function handleDeleteEntry(entryId) {
  if (!confirm('确定要删除此条目？')) return
  await workshopStore.deleteEntry(entryId)
}

// 策略类型标签
function strategyLabel(type) {
  return type === 'constant' ? '🔵 蓝灯（常驻）' : '🟢 绿灯（触发词）'
}
</script>

<template>
  <div class="page-container py-8 max-w-3xl mx-auto">

    <!-- 返回按钮 -->
    <button class="btn-secondary text-sm mb-6" @click="goBackToWorkshop">
      ← 返回工坊
    </button>

    <!-- 加载中 -->
    <div v-if="workshopStore.currentPackLoading" class="flex justify-center py-20">
      <div class="w-10 h-10 rounded-full animate-spin" style="border:3px solid #FED7AA; border-top-color:#F97316;"></div>
    </div>

    <template v-else-if="pack">

      <!-- 错误提示 -->
      <div
        v-if="workshopStore.error"
        class="mb-4 px-4 py-3 rounded-xl text-sm font-semibold"
        style="background:#FEF2F2; color:#EF4444; border:1.5px solid #FECACA;"
      >
        {{ workshopStore.error }}
      </div>

      <!-- Pack 头部卡片 -->
      <div
        class="mb-6 p-6 flex flex-col gap-4"
        style="background:white; border:2.5px solid #FDBA74; border-radius:20px; box-shadow:5px 5px 0 #FDBA74;"
      >
        <!-- 作者行 -->
        <div class="flex items-center gap-2.5">
          <img :src="pack.author.avatar" :alt="pack.author.username" class="w-8 h-8 rounded-full object-cover" style="border:2px solid #FDBA74;"/>
          <span class="text-sm font-semibold" style="color:#A8A29E; font-family:'Nunito',sans-serif;">{{ pack.author.username }}</span>
        </div>

        <!-- 标题 -->
        <h1 class="text-2xl font-bold" style="font-family:'Fredoka',sans-serif; color:#431407;">
          {{ pack.title }}
        </h1>

        <!-- 描述 -->
        <p v-if="pack.description" class="text-sm" style="color:#78716C; font-family:'Nunito',sans-serif; line-height:1.7;">
          {{ pack.description }}
        </p>

        <!-- 元数据行 -->
        <div class="flex items-center gap-4 flex-wrap text-xs" style="color:#A8A29E; font-family:'Nunito',sans-serif;">
          <span>{{ pack.entry_count }} 条条目</span>
          <span>{{ new Date(pack.created_at).toLocaleDateString('zh-CN') }} 发布</span>
          <span v-if="isStEnv && pack.is_subscribed" style="color:#16A34A; font-weight:700;">✓ 已插入世界书</span>
        </div>

        <!-- 操作按钮行 -->
        <div class="flex items-center gap-3 flex-wrap">
          <!-- 点赞 -->
          <button
            class="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm transition-all duration-150"
            :style="pack.is_liked
              ? 'background:#FFF7ED; color:#EA580C; border:2.5px solid #F97316; box-shadow:3px 3px 0 #F97316;'
              : 'background:#FFFBF0; color:#A8A29E; border:2.5px solid #E7E5E4; box-shadow:3px 3px 0 #E7E5E4;'"
            @click="handleLike"
            :disabled="workshopStore.stLoading"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {{ pack.like_count }} 点赞
          </button>

          <!-- 订阅 -->
          <button
            class="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm transition-all duration-150"
            :style="pack.is_subscribed
              ? 'background:#F0FDF4; color:#16A34A; border:2.5px solid #22C55E; box-shadow:3px 3px 0 #22C55E;'
              : 'background:#FFFBF0; color:#A8A29E; border:2.5px solid #E7E5E4; box-shadow:3px 3px 0 #E7E5E4;'"
            @click="handleSubscribe"
            :disabled="workshopStore.stLoading"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22c1.1 0 2-.9 2-2H10c0 1.1.9 2 2 2z"/>
              <path d="M18 16V11a6 6 0 0 0-5-5.91V4a1 1 0 0 0-2 0v1.09A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z"/>
            </svg>
            <span v-if="workshopStore.stLoading">处理中…</span>
            <span v-else>{{ pack.is_subscribed ? '取消订阅' : '订阅' }}（{{ pack.sub_count }}）</span>
          </button>

          <!-- 作者操作 -->
          <template v-if="isOwner">
            <RouterLink
              :to="{ name: 'workshop-pack-edit', params: { packId: pack.id } }"
              class="btn-secondary text-sm"
            >
              编辑模组
            </RouterLink>
            <button class="btn-danger text-sm" @click="handleDeletePack">
              删除模组
            </button>
          </template>
        </div>
      </div>

      <!-- 条目列表 -->
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-bold text-lg" style="font-family:'Fredoka',sans-serif; color:#EA580C;">
          条目列表
        </h2>
        <RouterLink
          v-if="authStore.isLoggedIn"
          :to="{ name: 'workshop-entry-new', params: { packId: pack.id } }"
          class="btn-primary text-sm"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          添加条目
        </RouterLink>
      </div>

      <!-- 无条目 -->
      <div
        v-if="!pack.entries || !pack.entries.length"
        class="flex flex-col items-center justify-center py-12 gap-3"
        style="border:2px dashed #FED7AA; border-radius:16px;"
      >
        <p class="text-sm font-semibold" style="color:#C0B8B0; font-family:'Fredoka',sans-serif;">
          此模组还没有条目
        </p>
        <RouterLink
          v-if="authStore.isLoggedIn"
          :to="{ name: 'workshop-entry-new', params: { packId: pack.id } }"
          class="btn-primary text-sm"
        >
          添加第一条
        </RouterLink>
      </div>

      <!-- 条目卡片 -->
      <div v-else class="flex flex-col gap-3">
        <div
          v-for="entry in pack.entries"
          :key="entry.id"
          class="p-4 flex flex-col gap-2"
          style="background:white; border:2px solid #FED7AA; border-radius:14px;"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              <!-- 启用状态 -->
              <span
                class="text-xs font-bold px-2 py-0.5 rounded-full"
                :style="entry.enabled
                  ? 'background:#DCFCE7; color:#16A34A; border:1.5px solid #22C55E;'
                  : 'background:#F3F4F6; color:#9CA3AF; border:1.5px solid #D1D5DB;'"
              >
                {{ entry.enabled ? '启用' : '禁用' }}
              </span>
              <!-- 策略类型 -->
              <span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:#FFF7ED; color:#EA580C; border:1.5px solid #FDBA74;">
                {{ strategyLabel(entry.strategy_type) }}
              </span>
            </div>

            <!-- 编辑/删除（条目作者或 pack 作者） -->
            <div v-if="canEditEntry(entry)" class="flex items-center gap-2 flex-shrink-0">
              <RouterLink
                :to="{ name: 'workshop-entry-edit', params: { packId: pack.id, entryId: entry.id } }"
                class="text-xs font-bold px-3 py-1 rounded-full transition-colors"
                style="color:#EA580C; border:1.5px solid #FDBA74; background:#FFFBF0;"
              >
                编辑
              </RouterLink>
              <button
                class="text-xs font-bold px-3 py-1 rounded-full transition-colors"
                style="color:#EF4444; border:1.5px solid #FECACA; background:#FEF2F2;"
                @click="handleDeleteEntry(entry.id)"
              >
                删除
              </button>
            </div>
          </div>

          <!-- 名称 -->
          <h3 class="font-bold text-sm" style="font-family:'Fredoka',sans-serif; color:#431407;">
            {{ entry.name }}
          </h3>

          <!-- 触发词 -->
          <div v-if="entry.keys && entry.keys.length" class="flex flex-wrap gap-1.5">
            <span
              v-for="key in entry.keys"
              :key="key"
              class="tag-badge"
            >
              {{ key }}
            </span>
          </div>

          <!-- 内容预览 -->
          <p
            v-if="entry.content"
            class="text-xs line-clamp-3"
            style="color:#78716C; font-family:'Nunito',sans-serif; background:#FFFBF0; border-radius:8px; padding:8px; border:1px solid #FED7AA;"
          >
            {{ entry.content }}
          </p>
        </div>
      </div>

    </template>
  </div>
</template>
