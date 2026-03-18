<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useWorkshopStore } from '@/stores/workshop'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const workshopStore = useWorkshopStore()
const authStore = useAuthStore()

const packId = computed(() => parseInt(route.params.packId))
const isEdit = computed(() => !!route.params.entryId)
const pageTitle = computed(() => isEdit.value ? '编辑条目' : '添加条目')

const saving = ref(false)
const loadingEntry = ref(false)
const advancedOpen = ref(false)

// 表单数据
const form = reactive({
  name: '',
  enabled: true,
  content: '',
  strategy_type: 'selective',
  keys: '',              // 逗号分隔字符串，提交时转为数组
  keys_secondary_logic: 'and_any',
  keys_secondary: '',
  scan_depth: 'same_as_global',
  position_type: 'after_character_definition',
  position_order: 100,
  position_depth: 4,
  position_role: 'system',
  probability: 100,
  recursion_prevent_incoming: false,
  recursion_prevent_outgoing: false,
  recursion_delay_until: '',
  effect_sticky: '',
  effect_cooldown: '',
  effect_delay: '',
})

function splitKeys(str) {
  return str.split(',').map((s) => s.trim()).filter(Boolean)
}

function joinKeys(arr) {
  return Array.isArray(arr) ? arr.join(', ') : ''
}

onMounted(async () => {
  // 等待认证状态加载完毕
  if (authStore.loading) {
    await new Promise((resolve) => {
      const stop = authStore.$subscribe(() => {
        if (!authStore.loading) { stop(); resolve() }
      })
    })
  }

  // 未登录则跳转回工坊
  if (!authStore.isLoggedIn) {
    router.push({ name: 'workshop' })
    return
  }

  // 确保 pack 存在
  if (!workshopStore.currentPack || workshopStore.currentPack.id !== packId.value) {
    const pack = await workshopStore.fetchPack(packId.value)
    if (!pack) { router.push({ name: 'workshop' }); return }
  }

  if (isEdit.value) {
    loadingEntry.value = true
    const entry = await workshopStore.fetchEntry(route.params.entryId)
    loadingEntry.value = false
    if (!entry) { router.push({ name: 'workshop-pack-detail', params: { packId: packId.value } }); return }

    // 仅条目作者或 pack 作者可编辑
    const pack = workshopStore.currentPack
    const isEntryAuthor = authStore.user && authStore.user.id === entry.author_id
    const isPackAuthor = pack && authStore.user && authStore.user.id === pack.author.id
    if (!isEntryAuthor && !isPackAuthor) {
      router.push({ name: 'workshop-pack-detail', params: { packId: packId.value } })
      return
    }

    form.name = entry.name
    form.enabled = entry.enabled
    form.content = entry.content
    form.strategy_type = entry.strategy_type
    form.keys = joinKeys(entry.keys)
    form.keys_secondary_logic = entry.keys_secondary_logic
    form.keys_secondary = joinKeys(entry.keys_secondary)
    form.scan_depth = entry.scan_depth
    form.position_type = entry.position_type
    form.position_order = entry.position_order
    form.position_depth = entry.position_depth
    form.position_role = entry.position_role
    form.probability = entry.probability
    form.recursion_prevent_incoming = entry.recursion_prevent_incoming
    form.recursion_prevent_outgoing = entry.recursion_prevent_outgoing
    form.recursion_delay_until = entry.recursion_delay_until || ''
    form.effect_sticky = entry.effect_sticky || ''
    form.effect_cooldown = entry.effect_cooldown || ''
    form.effect_delay = entry.effect_delay || ''
  }
})

async function handleSubmit() {
  if (!form.name.trim()) {
    workshopStore.error = '条目名称不能为空'
    return
  }
  saving.value = true
  workshopStore.error = null

  const payload = {
    name: form.name.trim(),
    enabled: form.enabled,
    content: form.content,
    strategy_type: form.strategy_type,
    keys: splitKeys(form.keys),
    keys_secondary_logic: form.keys_secondary_logic,
    keys_secondary: splitKeys(form.keys_secondary),
    scan_depth: form.scan_depth,
    position_type: form.position_type,
    position_order: parseInt(form.position_order) || 100,
    position_depth: parseInt(form.position_depth) || 4,
    position_role: form.position_role,
    probability: parseInt(form.probability) ?? 100,
    recursion_prevent_incoming: form.recursion_prevent_incoming,
    recursion_prevent_outgoing: form.recursion_prevent_outgoing,
    recursion_delay_until: form.recursion_delay_until || null,
    effect_sticky: form.effect_sticky || null,
    effect_cooldown: form.effect_cooldown || null,
    effect_delay: form.effect_delay || null,
  }

  let ok = false
  if (isEdit.value) {
    ok = await workshopStore.updateEntry(route.params.entryId, payload)
  } else {
    const result = await workshopStore.createEntry(packId.value, payload)
    ok = !!result
  }

  saving.value = false
  if (ok) router.push({ name: 'workshop-pack-detail', params: { packId: packId.value } })
}

function goBack() {
  router.push({ name: 'workshop-pack-detail', params: { packId: packId.value } })
}
</script>

<template>
  <div class="page-container py-8 max-w-2xl mx-auto">
    <!-- 页头 -->
    <div class="flex items-center gap-3 mb-6">
      <button class="btn-secondary text-sm" @click="goBack">← 返回</button>
      <h1 class="text-xl font-bold" style="font-family:'Fredoka',sans-serif; color:#EA580C;">
        {{ pageTitle }}
      </h1>
    </div>

    <!-- 加载中 -->
    <div v-if="loadingEntry" class="flex justify-center py-20">
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

      <!-- ── 基本信息 ─────────────────────────────── -->
      <section class="flex flex-col gap-4 p-5" style="border:2px solid #FED7AA; border-radius:16px; background:white;">
        <h2 class="font-bold text-base" style="font-family:'Fredoka',sans-serif; color:#92400E;">基本信息</h2>

        <!-- 名称 -->
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold" style="color:#78716C;">条目名称 *</label>
          <input v-model="form.name" type="text" class="input" placeholder="输入条目名称" maxlength="200" required />
        </div>

        <!-- 启用 -->
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input v-model="form.enabled" type="checkbox" class="w-4 h-4 accent-orange-500" />
          <span class="text-sm font-semibold" style="color:#78716C;">启用此条目</span>
        </label>

        <!-- 内容 -->
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold" style="color:#78716C;">条目内容</label>
          <textarea
            v-model="form.content"
            class="input resize-y"
            style="min-height:180px; font-family:'Nunito',monospace; font-size:0.875rem;"
            placeholder="在这里输入世界书条目的内容…"
          ></textarea>
        </div>
      </section>

      <!-- ── 触发策略 ─────────────────────────────── -->
      <section class="flex flex-col gap-4 p-5" style="border:2px solid #FED7AA; border-radius:16px; background:white;">
        <h2 class="font-bold text-base" style="font-family:'Fredoka',sans-serif; color:#92400E;">触发策略</h2>

        <!-- 绿灯/蓝灯 策略类型选择 -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold" style="color:#78716C;">激活方式</label>
          <div class="flex gap-3">
            <!-- 绿灯：selective -->
            <button
              type="button"
              class="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-150"
              :style="form.strategy_type === 'selective'
                ? 'background:#F0FDF4; color:#15803D; border:2.5px solid #22C55E; box-shadow:3px 3px 0 #22C55E;'
                : 'background:#FFFBF0; color:#A8A29E; border:2.5px solid #E7E5E4; box-shadow:3px 3px 0 #E7E5E4;'"
              @click="form.strategy_type = 'selective'"
            >
              <span style="font-size:1.1em;">🟢</span>
              <span>绿灯 — 按触发词激活</span>
            </button>
            <!-- 蓝灯：constant -->
            <button
              type="button"
              class="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-150"
              :style="form.strategy_type === 'constant'
                ? 'background:#EFF6FF; color:#1D4ED8; border:2.5px solid #3B82F6; box-shadow:3px 3px 0 #3B82F6;'
                : 'background:#FFFBF0; color:#A8A29E; border:2.5px solid #E7E5E4; box-shadow:3px 3px 0 #E7E5E4;'"
              @click="form.strategy_type = 'constant'"
            >
              <span style="font-size:1.1em;">🔵</span>
              <span>蓝灯 — 常驻激活</span>
            </button>
          </div>
        </div>

        <!-- 触发词语（仅绿灯时显示） -->
        <div v-if="form.strategy_type === 'selective'" class="flex flex-col gap-1">
          <label class="text-sm font-semibold" style="color:#78716C;">触发词语</label>
          <input
            v-model="form.keys"
            type="text"
            class="input"
            placeholder="多个触发词用英文逗号分隔，例：魔法, 咒语"
          />
          <p class="text-xs" style="color:#A8A29E;">用英文逗号分隔多个词</p>
        </div>
      </section>

      <!-- ── 位置设置 ─────────────────────────────── -->
      <section class="flex flex-col gap-4 p-5" style="border:2px solid #FED7AA; border-radius:16px; background:white;">
        <h2 class="font-bold text-base" style="font-family:'Fredoka',sans-serif; color:#92400E;">位置设置</h2>

        <!-- 插入位置 -->
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold" style="color:#78716C;">插入位置</label>
          <select v-model="form.position_type" class="input">
            <option value="before_character_definition">角色定义前</option>
            <option value="after_character_definition">角色定义后</option>
            <option value="before_example_messages">示例消息前</option>
            <option value="after_example_messages">示例消息后</option>
            <option value="before_author_note">作者注释前</option>
            <option value="after_author_note">作者注释后</option>
            <option value="at_depth">@D 深度插入位置</option>
          </select>
        </div>

        <!-- 插入深度（at_depth 时） -->
        <div v-if="form.position_type === 'at_depth'" class="flex flex-col gap-1">
          <label class="text-sm font-semibold" style="color:#78716C;">插入深度</label>
          <input v-model.number="form.position_depth" type="number" class="input" min="0" />
        </div>

        <!-- 消息角色（at_depth 时） -->
        <div v-if="form.position_type === 'at_depth'" class="flex flex-col gap-1">
          <label class="text-sm font-semibold" style="color:#78716C;">消息角色</label>
          <select v-model="form.position_role" class="input">
            <option value="system">System</option>
            <option value="user">User</option>
            <option value="assistant">Assistant</option>
          </select>
        </div>

        <!-- 排列顺序 -->
        <div class="flex flex-col gap-1">
          <label class="text-sm font-semibold" style="color:#78716C;">排列顺序</label>
          <input v-model.number="form.position_order" type="number" class="input" min="0" />
        </div>
      </section>

      <!-- ── 触发递归设置 ─────────────────────────────── -->
      <section class="flex flex-col gap-4 p-5" style="border:2px solid #FED7AA; border-radius:16px; background:white;">
        <h2 class="font-bold text-base" style="font-family:'Fredoka',sans-serif; color:#92400E;">递归设置</h2>
        <div class="flex flex-col gap-2">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input v-model="form.recursion_prevent_incoming" type="checkbox" class="w-4 h-4 accent-orange-500" />
            <span class="text-sm font-semibold" style="color:#78716C;">防止被其他条目递归触发</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input v-model="form.recursion_prevent_outgoing" type="checkbox" class="w-4 h-4 accent-orange-500" />
            <span class="text-sm font-semibold" style="color:#78716C;">防止触发其他条目的递归</span>
          </label>
        </div>
      </section>

      <!-- ── 高级设置（可折叠） ──────────────────── -->
      <section style="border:2px solid #FED7AA; border-radius:16px; background:white; overflow:hidden;">
        <button
          type="button"
          class="w-full flex items-center justify-between px-5 py-4 font-bold text-base transition-colors"
          style="font-family:'Fredoka',sans-serif; color:#92400E; background:transparent;"
          @click="advancedOpen = !advancedOpen"
        >
          <span>高级设置</span>
          <svg
            class="w-5 h-5 transition-transform duration-200"
            :style="advancedOpen ? 'transform:rotate(180deg);' : ''"
            viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="2.5"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div v-show="advancedOpen" class="flex flex-col gap-4 px-5 pb-5">
          <hr style="border-color:#FED7AA; margin-bottom:4px;" />

          <!-- 次级触发词逻辑 -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-semibold" style="color:#78716C;">次级触发词逻辑</label>
            <select v-model="form.keys_secondary_logic" class="input">
              <option value="and_any">AND ANY（任意匹配）</option>
              <option value="and_all">AND ALL（全部匹配）</option>
              <option value="not_any">NOT ANY（全不匹配）</option>
              <option value="not_all">NOT ALL（不全匹配）</option>
            </select>
          </div>

          <!-- 次级触发词 -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-semibold" style="color:#78716C;">次级触发词</label>
            <input
              v-model="form.keys_secondary"
              type="text"
              class="input"
              placeholder="可选，多个词用英文逗号分隔"
            />
          </div>

          <!-- 扫描深度 -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-semibold" style="color:#78716C;">扫描深度</label>
            <input
              v-model="form.scan_depth"
              type="text"
              class="input"
              placeholder="same_as_global 或具体数字"
            />
            <p class="text-xs" style="color:#A8A29E;">填 same_as_global 使用全局设置，或填具体数字</p>
          </div>

          <!-- 触发概率 -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-semibold" style="color:#78716C;">触发概率（0–100）</label>
            <input v-model.number="form.probability" type="number" class="input" min="0" max="100" />
          </div>

          <!-- 延迟递归 -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-semibold" style="color:#78716C;">延迟到递归（delay_until）</label>
            <input
              v-model="form.recursion_delay_until"
              type="text"
              class="input"
              placeholder="可选，填数字或留空"
            />
          </div>

          <!-- 效果设置 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold" style="color:#78716C;">效果设置（Sticky / Cooldown / Delay）</label>
            <div class="grid grid-cols-3 gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold" style="color:#A8A29E;">Sticky</label>
                <input v-model="form.effect_sticky" type="number" class="input" min="0" placeholder="轮数" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold" style="color:#A8A29E;">Cooldown</label>
                <input v-model="form.effect_cooldown" type="number" class="input" min="0" placeholder="轮数" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold" style="color:#A8A29E;">Delay</label>
                <input v-model="form.effect_delay" type="number" class="input" min="0" placeholder="轮数" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 提交按钮 -->
      <div class="flex gap-3 justify-end">
        <button type="button" class="btn-secondary" @click="goBack">取消</button>
        <button type="submit" class="btn-primary" :disabled="saving">
          <span v-if="saving">保存中…</span>
          <span v-else>{{ isEdit ? '保存修改' : '添加条目' }}</span>
        </button>
      </div>

    </form>
  </div>
</template>
