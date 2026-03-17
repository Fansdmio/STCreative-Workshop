<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useWorkshopStore } from '@/stores/workshop'
import { useAuthStore } from '@/stores/auth'
import { TAG_GROUPS } from '@/config/sections'

const router = useRouter()
const route = useRoute()
const workshopStore = useWorkshopStore()
const authStore = useAuthStore()

const isEdit = computed(() => !!route.params.packId)
const packId = computed(() => isEdit.value ? parseInt(route.params.packId) : null)
const pageTitle = computed(() => isEdit.value ? '编辑模组' : '创建模组')

// 从 ?workshop= query 确定初始工坊 slug（新建时用）
const workshopSlugFromQuery = computed(() => route.query.workshop || null)

const saving = ref(false)
const loadingPack = ref(false)

const form = ref({
  title: '',
  description: '',
  worldbook: '',        // 模组对应的目标世界书名称
  workshop_id: null,   // 关联的工坊 ID（数字）
  tags: [],
})

// 新建时记录来源工坊 slug（用于 goBack 跳转）
const sourceWorkshopSlug = ref(workshopSlugFromQuery.value)

// ── 登录门控（仅需登录，无需创作者身份）────────────────────────────────
onMounted(async () => {
  // 等待 auth 加载完成
  if (authStore.loading) {
    await new Promise(resolve => {
      const stop = watch(() => authStore.loading, (v) => { if (!v) { stop(); resolve() } })
    })
  }
  if (!authStore.isLoggedIn) {
    router.replace({ name: 'workshop' })
    return
  }

  // 加载工坊列表（用于下拉选择）
  await workshopStore.fetchWorkshops()

  // 设置初始工坊（新建时）
  if (!isEdit.value) {
    if (workshopSlugFromQuery.value) {
      const w = workshopStore.workshops.find(w => w.slug === workshopSlugFromQuery.value)
      if (w) form.value.workshop_id = w.id
    }
    // 若仍未选中（无 query 或 slug 不存在），默认选第一个工坊
    if (!form.value.workshop_id && workshopStore.workshops.length) {
      form.value.workshop_id = workshopStore.workshops[0].id
    }
  }

  if (isEdit.value) {
    loadingPack.value = true
    const pack = await workshopStore.fetchPack(packId.value)
    loadingPack.value = false
    if (!pack) {
      router.push({ name: 'workshop' })
      return
    }
    if (!authStore.user || authStore.user.id !== pack.author.id) {
      router.push({ name: 'workshop' })
      return
    }
    form.value.title = pack.title
    form.value.description = pack.description
    form.value.worldbook = pack.worldbook || ''
    form.value.workshop_id = pack.workshop?.id || null
    form.value.tags = Array.isArray(pack.tags) ? [...pack.tags] : []
    sourceWorkshopSlug.value = pack.workshop?.slug || null
  }
})

// ── Tag 操作 ─────────────────────────────────────────────────────────

function togglePresetTag(tag) {
  const idx = form.value.tags.indexOf(tag)
  if (idx >= 0) {
    form.value.tags.splice(idx, 1)
  } else {
    form.value.tags.push(tag)
  }
}

function removeTag(tag) {
  form.value.tags = form.value.tags.filter(t => t !== tag)
}

// ── 提交 ─────────────────────────────────────────────────────────────
async function handleSubmit() {
  if (!form.value.title.trim()) {
    workshopStore.error = '模组标题不能为空'
    return
  }
  if (!form.value.workshop_id) {
    workshopStore.error = '请选择所属工坊'
    return
  }
  saving.value = true
  workshopStore.error = null

  const payload = {
    title: form.value.title.trim(),
    description: form.value.description.trim(),
    worldbook: form.value.worldbook.trim(),
    workshop_id: form.value.workshop_id || null,
    tags: form.value.tags,
  }

  if (isEdit.value) {
    const ok = await workshopStore.updatePack(packId.value, payload)
    saving.value = false
    if (ok) router.push({ name: 'workshop-pack-detail', params: { packId: packId.value } })
  } else {
    const result = await workshopStore.createPack(payload)
    saving.value = false
    if (result) router.push({ name: 'workshop-pack-detail', params: { packId: result.id } })
  }
}

function goBack() {
  if (isEdit.value) {
    router.push({ name: 'workshop-pack-detail', params: { packId: packId.value } })
  } else {
    // 优先使用来源 slug，若无则从当前选中的工坊 ID 反查 slug
    const slug = sourceWorkshopSlug.value
      || workshopStore.workshops.find(w => w.id === form.value.workshop_id)?.slug
      || null
    router.push({
      name: 'workshop',
      query: slug ? { workshop: slug } : {},
    })
  }
}
</script>

<template>
  <div class="page-container py-8 max-w-xl mx-auto">
    <!-- 页头 -->
    <div class="flex items-center gap-3 mb-6">
      <button class="btn-secondary text-sm" @click="goBack">← 返回</button>
      <h1 class="text-xl font-bold" style="font-family:'Fredoka',sans-serif; color:#EA580C;">
        {{ pageTitle }}
      </h1>
    </div>

    <!-- 加载中 -->
    <div v-if="loadingPack" class="flex justify-center py-20">
      <div class="w-10 h-10 rounded-full animate-spin" style="border:3px solid #FED7AA; border-top-color:#F97316;"></div>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="flex flex-col gap-5">

      <!-- 错误提示 -->
      <div
        v-if="workshopStore.error"
        class="px-4 py-3 rounded-xl text-sm font-semibold"
        style="background:#FEF2F2; color:#EF4444; border:1.5px solid #FECACA;"
      >
        {{ workshopStore.error }}
      </div>

      <!-- 基本信息 -->
      <div
        class="flex flex-col gap-4 p-5"
        style="border:2px solid #FED7AA; border-radius:16px; background:white;"
      >
        <h2 class="font-bold text-base" style="font-family:'Fredoka',sans-serif; color:#92400E;">
          模组信息
        </h2>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold" style="color:#78716C;">标题 *</label>
          <input
            v-model="form.title"
            type="text"
            class="input"
            placeholder="给你的模组起一个名字"
            maxlength="200"
            required
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold" style="color:#78716C;">描述</label>
          <textarea
            v-model="form.description"
            class="input resize-y"
            style="min-height:100px;"
            placeholder="描述这个模组的内容和用途（可选）"
            maxlength="1000"
          ></textarea>
        </div>

        <!-- 所属工坊 -->
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold" style="color:#78716C;">所属工坊</label>
          <select
            v-model="form.workshop_id"
            class="input"
            style="font-family:'Nunito',sans-serif;"
          >
            <option
              v-for="w in workshopStore.workshops"
              :key="w.id"
              :value="w.id"
            >{{ w.name }}</option>
          </select>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold" style="color:#78716C;">
            目标世界书名称
            <span class="font-normal text-xs ml-1" style="color:#A8A29E;">（SillyTavern 中订阅时写入的世界书）</span>
          </label>
          <input
            v-model="form.worldbook"
            type="text"
            class="input"
            placeholder="例如：蒸汽朋克世界书"
            maxlength="200"
          />
        </div>
      </div>

      <!-- Tags 多选（分组预设，不允许自定义） -->
      <div
        class="flex flex-col gap-4 p-5"
        style="border:2px solid #FED7AA; border-radius:16px; background:white;"
      >
        <h2 class="font-bold text-base" style="font-family:'Fredoka',sans-serif; color:#92400E;">
          模组标签
        </h2>

        <!-- 按分组展示 chips -->
        <div
          v-for="group in TAG_GROUPS"
          :key="group.label"
          class="flex flex-col gap-2"
        >
          <span class="text-xs font-bold" style="color:#A8A29E; font-family:'Nunito',sans-serif; letter-spacing:0.05em;">
            {{ group.label }}
          </span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="tag in group.tags"
              :key="tag"
              type="button"
              @click="togglePresetTag(tag)"
              class="text-xs font-bold px-3 py-1.5 rounded-full transition-all duration-150"
              :style="form.tags.includes(tag)
                ? 'background:#F97316; color:white; border:2px solid #EA580C; box-shadow:2px 2px 0 #EA580C;'
                : 'background:#FFF7ED; color:#78716C; border:2px solid #E7E5E4;'"
            >
              {{ tag }}
            </button>
          </div>
        </div>

        <!-- 未选任何标签时提示 -->
        <p v-if="!form.tags.length" class="text-xs" style="color:#A8A29E; font-family:'Nunito',sans-serif;">
          未选择任何标签
        </p>
      </div>

      <!-- 提示（新建时） -->
      <p v-if="!isEdit" class="text-sm" style="color:#A8A29E; font-family:'Nunito',sans-serif;">
        创建模组后，你可以在详情页添加世界书条目。
      </p>

      <!-- 提交按钮 -->
      <div class="flex gap-3 justify-end">
        <button type="button" class="btn-secondary" @click="goBack">取消</button>
        <button type="submit" class="btn-primary" :disabled="saving">
          <span v-if="saving">保存中…</span>
          <span v-else>{{ isEdit ? '保存修改' : '创建模组' }}</span>
        </button>
      </div>

    </form>
  </div>
</template>
