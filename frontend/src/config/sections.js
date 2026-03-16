// 模组预设标签
export const DEFAULT_TAGS = ['人物', '地点', '怪物', '规则']

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
