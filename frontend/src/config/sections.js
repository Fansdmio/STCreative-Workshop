// 模组标签分组（只允许选预设标签，不允许自定义）
export const TAG_GROUPS = [
  {
    label: '内容分级',
    tags: ['纯洁向', 'R18', '重口'],
  },
  {
    label: '内容类型',
    tags: ['人物', '地点', '怪物', '道具', '组织', '规则', '世界观', '体系', '技能', '剧情'],
  },
  {
    label: '创作类型',
    tags: ['原创', '大型二创', '小型二创'],
  },
  {
    label: '题材',
    tags: ['奇幻', '科幻', '现代', '古风', '恐怖', '克苏鲁', '修仙', '日常', '战斗', '悬疑', '末世', '异能'],
  },
]

// 所有预设标签（扁平列表，供后端校验或旧代码兼容）
export const DEFAULT_TAGS = TAG_GROUPS.flatMap(g => g.tags)

// 从 localStorage 读取工坊世界书名称（key = workshop_wb_<slug>）
// 不含默认值——由调用方（workshop store）fallback 到工坊表的 worldbook 字段
export function getWorldbookName(slug) {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(`workshop_wb_${slug}`) || ''
}

// 保存到 localStorage
export function saveWorldbookName(slug, name) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(`workshop_wb_${slug}`, name)
  }
}
