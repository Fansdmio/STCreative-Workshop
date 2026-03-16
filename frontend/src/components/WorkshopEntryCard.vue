<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useWorkshopStore } from '@/stores/workshop'

const props = defineProps({
  entry: {
    type: Object,
    required: true,
  },
})

const router = useRouter()
const authStore = useAuthStore()
const workshopStore = useWorkshopStore()

const isInserted = computed(() => props.entry.id in workshopStore.insertedEntries)
const isStEnv = computed(() => workshopStore.isSillyTavernEnv())
const isOwner = computed(() => authStore.user && authStore.user.id === props.entry.author.id)

// 策略类型标签
const strategyLabel = computed(() =>
  props.entry.strategy_type === 'constant' ? '常驻' : '选择性'
)

// 位置类型标签
const positionLabel = computed(() => {
  const map = {
    before_character_definition: '角色定义前',
    after_character_definition: '角色定义后',
    before_example_messages: '示例消息前',
    after_example_messages: '示例消息后',
    before_author_note: '作者注释前',
    after_author_note: '作者注释后',
    at_depth: '指定深度',
  }
  return map[props.entry.position_type] || props.entry.position_type
})

async function handleInsert() {
  await workshopStore.insertToWorldbook(props.entry)
}

async function handleRemove() {
  await workshopStore.removeFromWorldbook(props.entry.id)
}

function handleEdit() {
  router.push({ name: 'workshop-entry-edit', params: { packId: props.entry.pack_id, entryId: props.entry.id } })
}

async function handleDelete() {
  if (!confirm(`确定要删除条目「${props.entry.name}」吗？`)) return
  await workshopStore.deleteEntry(props.entry.id)
}
</script>

<template>
  <div
    class="card flex flex-col gap-3"
    style="position: relative;"
  >
    <!-- 顶部：名称 + 启用状态 -->
    <div class="flex items-start justify-between gap-2">
      <h3
        class="font-bold text-base leading-snug flex-1 min-w-0"
        style="font-family: 'Fredoka', sans-serif; color: #EA580C; word-break: break-word;"
      >
        {{ entry.name || '（无标题）' }}
      </h3>
      <span
        class="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
        :style="entry.enabled
          ? 'background: #FEF3C7; color: #D97706; border: 1.5px solid #FDE68A;'
          : 'background: #F3F4F6; color: #9CA3AF; border: 1.5px solid #E5E7EB;'"
      >
        {{ entry.enabled ? '已启用' : '已禁用' }}
      </span>
    </div>

    <!-- 标签行：策略 + 位置 + 概率 -->
    <div class="flex flex-wrap gap-1.5 text-xs">
      <span class="tag-badge">{{ strategyLabel }}</span>
      <span class="tag-badge">{{ positionLabel }}</span>
      <span class="tag-badge">触发率 {{ entry.probability }}%</span>
      <span v-if="entry.keys && entry.keys.length" class="tag-badge">
        {{ entry.keys.length }} 个触发词
      </span>
    </div>

    <!-- 内容预览 -->
    <p
      v-if="entry.content"
      class="text-sm leading-relaxed line-clamp-3"
      style="color: #78716C; font-family: 'Nunito', sans-serif;"
    >
      {{ entry.content }}
    </p>
    <p
      v-else
      class="text-sm italic"
      style="color: #D1C7C0; font-family: 'Nunito', sans-serif;"
    >
      （内容为空）
    </p>

    <!-- 作者 + 时间 -->
    <div class="flex items-center gap-2 mt-auto pt-1" style="border-top: 1.5px dashed #FED7AA;">
      <img
        :src="entry.author.avatar"
        :alt="entry.author.username"
        class="w-6 h-6 rounded-full object-cover shrink-0"
        style="border: 1.5px solid #F97316;"
      />
      <span class="text-xs font-semibold truncate" style="color: #EA580C; font-family: 'Nunito', sans-serif;">
        {{ entry.author.username }}
      </span>
      <span class="text-xs ml-auto shrink-0" style="color: #C0B8B0; font-family: 'Nunito', sans-serif;">
        {{ new Date(entry.created_at).toLocaleDateString('zh-CN') }}
      </span>
    </div>

    <!-- 操作按钮 -->
    <div class="flex gap-2 flex-wrap">
      <!-- ST 插入/移除按钮（仅在 ST 环境中显示） -->
      <template v-if="isStEnv">
        <button
          v-if="!isInserted"
          class="btn-primary text-xs flex-1"
          :disabled="workshopStore.stLoading"
          @click="handleInsert"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          插入世界书
        </button>
        <button
          v-else
          class="btn-secondary text-xs flex-1"
          :disabled="workshopStore.stLoading"
          @click="handleRemove"
          style="color: #EF4444; border-color: #FCA5A5;"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          已插入（点击移除）
        </button>
      </template>

      <!-- 编辑 / 删除（仅作者） -->
      <template v-if="isOwner">
        <button class="btn-secondary text-xs" @click="handleEdit">
          编辑
        </button>
        <button
          class="btn-secondary text-xs"
          style="color: #EF4444; border-color: #FCA5A5;"
          @click="handleDelete"
        >
          删除
        </button>
      </template>
    </div>
  </div>
</template>
