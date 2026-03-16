<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkshopStore } from '@/stores/workshop'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const workshopStore = useWorkshopStore()
const authStore = useAuthStore()

const saving = ref(false)

const form = ref({
  name: '',
  description: '',
  worldbook: '',
})

// ── 创作者门控 ───────────────────────────────────────────────────────
onMounted(async () => {
  // 等待 auth 加载完成
  if (authStore.loading) {
    await new Promise(resolve => {
      const stop = watch(() => authStore.loading, (v) => { if (!v) { stop(); resolve() } })
    })
  }
  if (!authStore.isLoggedIn || !authStore.isCreator) {
    router.replace({ path: '/creator/apply' })
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

  const result = await workshopStore.createWorkshop({
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
  router.push({ name: 'workshop' })
}
</script>

<template>
  <div class="page-container py-8 max-w-xl mx-auto">
    <!-- 页头 -->
    <div class="flex items-center gap-3 mb-6">
      <button class="btn-secondary text-sm" @click="goBack">← 返回</button>
      <h1 class="text-xl font-bold" style="font-family:'Fredoka',sans-serif; color:#EA580C;">
        创建工坊
      </h1>
    </div>

    <form @submit.prevent="handleSubmit" class="flex flex-col gap-5">

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
            placeholder="例如：原神、崩铁…"
            maxlength="50"
            required
          />
          <p class="text-xs" style="color:#A8A29E; font-family:'Nunito',sans-serif;">
            最多 50 字，创建后名称可编辑但 slug 不变
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

      <!-- 须知 -->
      <div
        class="rounded-xl px-4 py-3 text-xs"
        style="background:#FFF7ED; border:1.5px dashed #FDBA74; color:#78350F; font-family:'Nunito',sans-serif; line-height:1.7;"
      >
        <p class="font-bold mb-1">工坊须知</p>
        <p>・工坊是模组的顶级容器，任何登录用户都可以在工坊内创建模组</p>
        <p>・内置工坊（蒸汽朋克、电锯人）不可编辑或删除</p>
        <p>・创建的工坊 slug 由名称自动生成，不可更改</p>
      </div>

      <!-- 提交按钮 -->
      <div class="flex gap-3 justify-end">
        <button type="button" class="btn-secondary" @click="goBack">取消</button>
        <button type="submit" class="btn-primary" :disabled="saving">
          <span v-if="saving">创建中…</span>
          <span v-else>创建工坊</span>
        </button>
      </div>

    </form>
  </div>
</template>
