<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useWorkshopStore } from '@/stores/workshop'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const workshopStore = useWorkshopStore()
const authStore = useAuthStore()

const workshopId = parseInt(route.params.id)
const saving = ref(false)
const loadError = ref('')

const form = ref({
  name: '',
  description: '',
  worldbook: '',
})

// ── 权限门控 & 数据加载 ──────────────────────────────────────────────
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

  // 拉取工坊列表（如未加载）
  if (!workshopStore.workshops.length) {
    await workshopStore.fetchWorkshops()
  }

  // 查找当前工坊
  const w = workshopStore.workshops.find(w => w.id === workshopId)
  if (!w) {
    loadError.value = '工坊不存在或尚未审批通过'
    return
  }
  // 仅作者或管理员可编辑
  if (w.author_id !== authStore.user?.id && !authStore.isCreator) {
    router.replace({ name: 'workshop' })
    return
  }

  form.value = {
    name: w.name,
    description: w.description || '',
    worldbook: w.worldbook || '',
  }
})

// ── 提交 ─────────────────────────────────────────────────────────────
async function handleSubmit() {
  if (!form.value.name.trim()) {
    workshopStore.error = '工坊名称不能为空'
    return
  }
  saving.value = true
  workshopStore.error = null

  const result = await workshopStore.updateWorkshop(workshopId, {
    name: form.value.name.trim(),
    description: form.value.description.trim(),
    worldbook: form.value.worldbook.trim(),
  })

  saving.value = false
  if (result) {
    router.push({ path: '/workshop', query: { workshop: result.slug } })
  }
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="page-container py-8 max-w-xl mx-auto">
    <!-- 页头 -->
    <div class="flex items-center gap-3 mb-6">
      <button class="btn-secondary text-sm" @click="goBack">← 返回</button>
      <h1 class="text-xl font-bold" style="font-family:'Fredoka',sans-serif; color:#EA580C;">
        编辑工坊
      </h1>
    </div>

    <!-- 加载错误 -->
    <div
      v-if="loadError"
      class="px-4 py-3 rounded-xl text-sm font-semibold text-center"
      style="background:#FEF2F2; color:#EF4444; border:1.5px solid #FECACA;"
    >
      {{ loadError }}
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
          工坊信息
        </h2>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold" style="color:#78716C;">
            工坊名称 *
          </label>
          <input
            v-model="form.name"
            type="text"
            class="input"
            placeholder="工坊名称"
            maxlength="50"
            required
          />
          <p class="text-xs" style="color:#A8A29E; font-family:'Nunito',sans-serif;">
            最多 50 字；Slug 在创建时已固定，不会随名称改变
          </p>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold" style="color:#78716C;">简介</label>
          <textarea
            v-model="form.description"
            class="input resize-y"
            style="min-height:80px;"
            placeholder="工坊的简短介绍（可选）"
            maxlength="500"
          ></textarea>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold" style="color:#78716C;">
            默认世界书名称
            <span class="font-normal text-xs ml-1" style="color:#A8A29E;">（订阅模组时的默认写入目标）</span>
          </label>
          <input
            v-model="form.worldbook"
            type="text"
            class="input"
            placeholder="例如：蒸汽朋克世界书（可选）"
            maxlength="200"
          />
        </div>
      </div>

      <!-- 提交按钮 -->
      <div class="flex gap-3 justify-end">
        <button type="button" class="btn-secondary" @click="goBack">取消</button>
        <button type="submit" class="btn-primary" :disabled="saving">
          <span v-if="saving">保存中…</span>
          <span v-else>保存修改</span>
        </button>
      </div>

    </form>
  </div>
</template>
