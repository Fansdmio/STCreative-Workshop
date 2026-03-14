<template>
  <!-- 手绘便签卡片：彩色主题轮换 + 随机旋转 + 折角装饰 -->
  <article
    class="flex flex-col p-5 cursor-pointer group"
    :style="cardStyle"
    @click="$router.push(`/story/${story.id}`)"
    :aria-label="`查看故事：${story.title}`"
    role="button"
    tabindex="0"
    @keydown.enter="$router.push(`/story/${story.id}`)"
  >
    <!-- 右上角折角装饰 -->
    <div class="absolute top-0 right-0 w-0 h-0" :style="cornerStyle" aria-hidden="true"></div>

    <!-- 标签 -->
    <div v-if="story.tags?.length" class="flex flex-wrap gap-1.5 mb-3">
      <span
        v-for="(tag, i) in story.tags"
        :key="tag"
        class="inline-flex items-center px-2.5 py-0.5 text-xs font-bold cursor-pointer select-none transition-all duration-150"
        :style="getTagStyle(i)"
        @click.stop="$emit('tag-click', tag)"
      >{{ tag }}</span>
    </div>

    <!-- 标题 -->
    <h2
      class="text-base font-bold mb-2 line-clamp-2 leading-snug transition-colors duration-200"
      :style="titleStyle"
    >
      {{ story.title }}
    </h2>

    <!-- 预览文字 -->
    <p class="text-sm line-clamp-3 leading-relaxed flex-1 mb-4" style="color: #78350F; font-family: 'Nunito', sans-serif;">
      {{ story.preview }}
    </p>

    <!-- 页脚：作者 + 时间 -->
    <div class="flex items-center justify-between pt-3" :style="footerBorderStyle">
      <div class="flex items-center gap-2 min-w-0">
        <img
          :src="story.author.avatar"
          :alt="story.author.username"
          class="w-7 h-7 rounded-full flex-shrink-0 object-cover"
          :style="`border: 2px solid ${accentColor};`"
        />
        <span class="text-xs font-bold truncate" :style="`color: ${accentColor}; font-family: 'Nunito', sans-serif;`">
          {{ story.author.username }}
        </span>
      </div>
      <time
        class="text-xs flex-shrink-0 ml-2 font-medium"
        style="color: #92400E; font-family: 'Nunito', sans-serif;"
        :datetime="story.created_at"
      >
        {{ formatDate(story.created_at) }}
      </time>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  story: {
    type: Object,
    required: true,
  },
})

defineEmits(['tag-click'])

/* 手绘卡片颜色主题（无紫色） */
const CARD_THEMES = [
  { bg: '#FFF7ED', border: '#F97316', shadow: '#EA580C', title: '#9A3412', corner: '#FED7AA' },
  { bg: '#ECFDF5', border: '#10B981', shadow: '#059669', title: '#064E3B', corner: '#A7F3D0' },
  { bg: '#FFF1F2', border: '#F43F5E', shadow: '#BE123C', title: '#9F1239', corner: '#FECDD3' },
  { bg: '#FFFBEB', border: '#EAB308', shadow: '#A16207', title: '#713F12', corner: '#FDE68A' },
  { bg: '#F0FDF4', border: '#22C55E', shadow: '#15803D', title: '#14532D', corner: '#BBF7D0' },
  { bg: '#EFF6FF', border: '#3B82F6', shadow: '#1D4ED8', title: '#1E3A5F', corner: '#BFDBFE' },
  { bg: '#FDF4FF', border: '#EC4899', shadow: '#BE185D', title: '#831843', corner: '#FBCFE8' },
  { bg: '#F0FDFA', border: '#06B6D4', shadow: '#0891B2', title: '#164E63', corner: '#A5F3FC' },
]

/* 标签颜色主题 */
const TAG_THEMES = [
  { bg: '#FEF9C3', color: '#854D0E', border: '#EAB308', shadow: '#CA8A04' },
  { bg: '#FCE7F3', color: '#9D174D', border: '#EC4899', shadow: '#BE185D' },
  { bg: '#DCFCE7', color: '#14532D', border: '#22C55E', shadow: '#15803D' },
  { bg: '#CFFAFE', color: '#164E63', border: '#06B6D4', shadow: '#0891B2' },
  { bg: '#DBEAFE', color: '#1E3A5F', border: '#3B82F6', shadow: '#1D4ED8' },
  { bg: '#FFE4E6', color: '#9F1239', border: '#F43F5E', shadow: '#BE123C' },
  { bg: '#D1FAE5', color: '#064E3B', border: '#10B981', shadow: '#059669' },
  { bg: '#FFF7ED', color: '#9A3412', border: '#F97316', shadow: '#EA580C' },
]

/* 根据故事 ID 确定主题，保持稳定 */
const themeIndex = computed(() => {
  const id = props.story.id || 0
  return (typeof id === 'number' ? id : parseInt(id) || 0) % CARD_THEMES.length
})

const theme = computed(() => CARD_THEMES[themeIndex.value])
const accentColor = computed(() => theme.value.border)

/* 旋转角：基于 ID 交替，营造手绘随机感 */
const rotation = computed(() => {
  const id = props.story.id || 0
  const n = typeof id === 'number' ? id : parseInt(id) || 0
  const angles = [-0.8, 0.5, -0.4, 0.7, -0.6, 0.3, -0.9, 0.4]
  return angles[n % angles.length]
})

const cardStyle = computed(() => ({
  position: 'relative',
  background: theme.value.bg,
  border: `2.5px solid ${theme.value.border}`,
  borderRadius: '18px',
  boxShadow: `4px 4px 0px 0px ${theme.value.shadow}, 0 0 0 1px ${theme.value.border}`,
  transform: `rotate(${rotation.value}deg)`,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  overflow: 'hidden',
}))

const cornerStyle = computed(() => ({
  borderTop: `24px solid ${theme.value.corner}`,
  borderLeft: '24px solid transparent',
  filter: `drop-shadow(-1px 1px 0 ${theme.value.border})`,
}))

const titleStyle = computed(() => ({
  color: theme.value.title,
  fontFamily: "'Fredoka', sans-serif",
  fontWeight: '600',
}))

const footerBorderStyle = computed(() => ({
  borderTop: `2px dashed ${theme.value.border}`,
  opacity: '0.9',
}))

function getTagStyle(index) {
  const t = TAG_THEMES[index % TAG_THEMES.length]
  return {
    background: t.bg,
    color: t.color,
    border: `2px solid ${t.border}`,
    boxShadow: `2px 2px 0 ${t.shadow}`,
    borderRadius: '999px',
    fontFamily: "'Fredoka', sans-serif",
    transform: index % 2 === 0 ? 'rotate(-0.8deg)' : 'rotate(0.6deg)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays} 天前`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`

  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<style scoped>
article:hover {
  transform: rotate(0deg) translateY(-4px) scale(1.02) !important;
}
</style>
