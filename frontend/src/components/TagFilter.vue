<template>
  <div class="flex flex-wrap items-center gap-2">
    <!-- 全部 -->
    <button
      class="inline-flex items-center px-3 py-1 text-xs font-bold cursor-pointer select-none transition-all duration-150"
      :style="activeTag === null ? activeStyle : defaultStyle"
      @click="$emit('change', null)"
    >
      全部
      <span class="ml-1 opacity-70">({{ total }})</span>
    </button>

    <!-- 各标签按钮 -->
    <button
      v-for="(tag, i) in tags"
      :key="tag.name"
      class="inline-flex items-center px-3 py-1 text-xs font-bold cursor-pointer select-none transition-all duration-150"
      :style="activeTag === tag.name ? activeStyle : getTagStyle(i)"
      @click="$emit('change', tag.name)"
    >
      {{ tag.name }}
      <span class="ml-1 opacity-70">({{ tag.count }})</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  tags: {
    type: Array,
    default: () => [],
  },
  activeTag: {
    type: String,
    default: null,
  },
  total: {
    type: Number,
    default: 0,
  },
})

defineEmits(['change'])

/* 手绘标签颜色主题（无紫色） */
const TAG_COLORS = [
  { bg: '#FEF9C3', color: '#854D0E', border: '#EAB308', shadow: '#CA8A04' },
  { bg: '#FCE7F3', color: '#9D174D', border: '#EC4899', shadow: '#BE185D' },
  { bg: '#DCFCE7', color: '#14532D', border: '#22C55E', shadow: '#15803D' },
  { bg: '#CFFAFE', color: '#164E63', border: '#06B6D4', shadow: '#0891B2' },
  { bg: '#DBEAFE', color: '#1E3A5F', border: '#3B82F6', shadow: '#1D4ED8' },
  { bg: '#FFE4E6', color: '#9F1239', border: '#F43F5E', shadow: '#BE123C' },
  { bg: '#D1FAE5', color: '#064E3B', border: '#10B981', shadow: '#059669' },
  { bg: '#FFF7ED', color: '#9A3412', border: '#F97316', shadow: '#EA580C' },
]

const baseStyle = {
  borderRadius: '999px',
  fontFamily: "'Fredoka', sans-serif",
  fontSize: '0.75rem',
  transition: 'all 0.15s ease',
}

const defaultStyle = {
  ...baseStyle,
  background: '#FFFBF0',
  color: '#EA580C',
  border: '2px solid #FDBA74',
  boxShadow: '2px 2px 0 #F97316',
  transform: 'rotate(-0.3deg)',
}

const activeStyle = {
  ...baseStyle,
  background: '#F97316',
  color: 'white',
  border: '2px solid #C2410C',
  boxShadow: '3px 3px 0 #9A3412',
  transform: 'rotate(0.2deg) scale(1.05)',
}

function getTagStyle(index) {
  const t = TAG_COLORS[index % TAG_COLORS.length]
  return {
    ...baseStyle,
    background: t.bg,
    color: t.color,
    border: `2px solid ${t.border}`,
    boxShadow: `2px 2px 0 ${t.shadow}`,
    transform: index % 2 === 0 ? 'rotate(-0.5deg)' : 'rotate(0.4deg)',
  }
}
</script>
