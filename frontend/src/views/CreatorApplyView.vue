<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const status = ref(null)       // 后端返回的 { role, application }
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const success = ref('')
const reason = ref('')
const platform = ref('')
const published_works = ref('')

async function fetchStatus() {
  loading.value = true
  try {
    const res = await fetch('/api/creator/status', { credentials: 'include' })
    if (res.ok) status.value = await res.json()
  } catch {
    // 忽略
  } finally {
    loading.value = false
  }
}

async function submitApply() {
  error.value = ''
  success.value = ''
  if (!reason.value.trim() || reason.value.trim().length < 5) {
    error.value = '请填写至少 5 个字的申请理由'
    return
  }
  if (!platform.value) {
    error.value = '请选择发布平台'
    return
  }
  if (!published_works.value.trim() || published_works.value.trim().length < 2) {
    error.value = '请填写至少一个已发布作品名称或链接'
    return
  }
  submitting.value = true
  try {
    const res = await fetch('/api/creator/apply', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: reason.value.trim(),
        platform: platform.value,
        published_works: published_works.value.trim(),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      error.value = data.error || '提交失败，请稍后再试'
    } else {
      success.value = data.message || '申请已提交！'
      await fetchStatus()
    }
  } catch {
    error.value = '网络错误，请稍后再试'
  } finally {
    submitting.value = false
  }
}

onMounted(fetchStatus)
</script>

<template>
  <div class="page-container py-10 max-w-2xl">

    <!-- 返回按钮 -->
    <button
      class="btn-secondary text-sm mb-6"
      @click="router.back()"
    >
      ← 返回
    </button>

    <!-- 页标题 -->
    <div class="flex items-center gap-3 mb-6">
      <div
        class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style="background:#FFF7ED; border:2px solid #FDBA74;"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      </div>
      <div>
        <h1 class="text-2xl font-bold" style="font-family:'Fredoka',sans-serif; color:#9A3412;">
          申请成为创作者
        </h1>
        <p class="text-sm mt-0.5" style="color:#A8A29E; font-family:'Nunito',sans-serif;">
          创作者可以发布和管理自己的世界书模组
        </p>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="w-8 h-8 rounded-full animate-spin" style="border:3px solid #FED7AA; border-top-color:#F97316;"></div>
    </div>

    <template v-else>
      <!-- 已是创作者或管理员 -->
      <div
        v-if="status?.role === 'creator' || status?.role === 'admin'"
        class="card p-6 text-center gap-4 flex flex-col items-center"
      >
        <div
          class="w-14 h-14 rounded-full flex items-center justify-center"
          style="background:#DCFCE7; border:2px solid #22C55E;"
        >
          <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <p class="font-bold text-lg" style="font-family:'Fredoka',sans-serif; color:#14532D;">
            {{ status.role === 'admin' ? '你是管理员' : '你已经是创作者了！' }}
          </p>
          <p class="text-sm mt-1" style="color:#78716C; font-family:'Nunito',sans-serif;">
            你可以创建新工坊，或前往工坊浏览
          </p>
        </div>
        <div class="flex gap-3 flex-wrap justify-center">
          <RouterLink to="/workshop/create" class="btn-primary text-sm">
            创建工坊
          </RouterLink>
          <RouterLink :to="{ name: 'workshop', query: { mine: '1' } }" class="btn-secondary text-sm">
            浏览我的工坊
          </RouterLink>
        </div>
      </div>

      <!-- 待审核中 -->
      <div
        v-else-if="status?.application?.status === 'pending'"
        class="card p-6 flex flex-col gap-3"
        style="border-color:#EAB308; box-shadow:4px 4px 0 #CA8A04;"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style="background:#FEF9C3; border:2px solid #EAB308;"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#CA8A04" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div>
            <p class="font-bold" style="font-family:'Fredoka',sans-serif; color:#78350F;">申请审核中</p>
            <p class="text-xs" style="color:#A8A29E; font-family:'Nunito',sans-serif;">
              提交于 {{ new Date(status.application.applied_at).toLocaleDateString('zh-CN') }}
            </p>
          </div>
        </div>
        <div class="text-sm rounded-xl px-4 py-3" style="background:#FFFBF0; border:1.5px solid #FED7AA; color:#78350F; font-family:'Nunito',sans-serif;">
          <p><span class="font-semibold">发布平台：</span>{{ status.application.platform || '—' }}</p>
          <p class="mt-1"><span class="font-semibold">已发布作品：</span>{{ status.application.published_works || '—' }}</p>
          <p class="mt-1"><span class="font-semibold">申请理由：</span>{{ status.application.reason }}</p>
        </div>
        <p class="text-xs" style="color:#A8A29E; font-family:'Nunito',sans-serif;">
          管理员将在近期审核，请耐心等待。审核结果将通过角色变更体现。
        </p>
      </div>

      <!-- 已被拒绝，可重新申请 -->
      <div v-else>
        <div
          v-if="status?.application?.status === 'rejected'"
          class="mb-5 rounded-xl px-4 py-3 text-sm flex flex-col gap-1"
          style="background:#FEF2F2; border:1.5px solid #FECACA; color:#991B1B; font-family:'Nunito',sans-serif;"
        >
          <p class="font-bold">上次申请已被拒绝，你可以重新申请</p>
          <p v-if="status.application.admin_note" class="text-xs" style="color:#B91C1C;">
            管理员备注：{{ status.application.admin_note }}
          </p>
        </div>

        <!-- 申请表单 -->
        <div class="card p-6 flex flex-col gap-4">
          <!-- 发布平台 -->
          <div>
            <label class="block text-sm font-bold mb-2" style="font-family:'Fredoka',sans-serif; color:#431407;">
              发布平台 <span style="color:#EF4444;">*</span>
            </label>
            <select
              v-model="platform"
              class="input"
              style="font-family:'Nunito',sans-serif;"
            >
              <option value="" disabled>请选择你主要发布作品的平台</option>
              <option value="类脑">类脑</option>
              <option value="旅程">旅程</option>
              <option value="其他平台">其他平台</option>
            </select>
          </div>

          <!-- 已发布作品 -->
          <div>
            <label class="block text-sm font-bold mb-2" style="font-family:'Fredoka',sans-serif; color:#431407;">
              已发布作品 <span style="color:#EF4444;">*</span>
            </label>
            <textarea
              v-model="published_works"
              class="input resize-none"
              rows="3"
              placeholder="填写你已发布的作品名称或链接，每行一条（最多 1000 字）"
              style="font-family:'Nunito',sans-serif;"
              maxlength="1000"
            ></textarea>
            <p class="text-xs mt-1 text-right" style="color:#A8A29E; font-family:'Nunito',sans-serif;">
              {{ published_works.length }} / 1000
            </p>
          </div>

          <!-- 申请理由 -->
          <div>
            <label class="block text-sm font-bold mb-2" style="font-family:'Fredoka',sans-serif; color:#431407;">
              申请理由 <span style="color:#EF4444;">*</span>
            </label>
            <textarea
              v-model="reason"
              class="input resize-none"
              rows="4"
              placeholder="介绍一下你自己，为什么想成为创作者？你计划创作哪类内容？（至少 5 字，最多 500 字）"
              style="font-family:'Nunito',sans-serif;"
              maxlength="500"
            ></textarea>
            <p class="text-xs mt-1 text-right" style="color:#A8A29E; font-family:'Nunito',sans-serif;">
              {{ reason.length }} / 500
            </p>
          </div>

          <!-- 须知 -->
          <div class="rounded-xl px-4 py-3 text-xs" style="background:#FFF7ED; border:1.5px dashed #FDBA74; color:#78350F; font-family:'Nunito',sans-serif; line-height:1.7;">
            <p class="font-bold mb-1">创作者须知</p>
            <p>・创作者可以发布、编辑和删除自己的世界书模组</p>
            <p>・请遵守社区规范，不发布违规内容</p>
            <p>・申请将由管理员人工审核，通常在 1-3 个工作日内处理</p>
          </div>

          <!-- 错误 / 成功提示 -->
          <div
            v-if="error"
            class="text-sm rounded-xl px-4 py-2.5 font-semibold"
            style="background:#FEF2F2; color:#EF4444; border:1.5px solid #FECACA;"
          >
            {{ error }}
          </div>
          <div
            v-if="success"
            class="text-sm rounded-xl px-4 py-2.5 font-semibold"
            style="background:#DCFCE7; color:#14532D; border:1.5px solid #86EFAC;"
          >
            {{ success }}
          </div>

          <button
            class="btn-primary"
            :disabled="submitting"
            @click="submitApply"
          >
            <svg v-if="submitting" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            {{ submitting ? '提交中…' : '提交申请' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
