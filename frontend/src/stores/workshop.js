import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getWorldbookName, saveWorldbookName } from '@/config/sections'

// WorldbookEntry 位置类型 → SillyTavern 数字映射
const POSITION_MAP = {
  before_character_definition: 0,
  after_character_definition: 1,
  before_example_messages: 2,
  after_example_messages: 3,
  before_author_note: 4,
  after_author_note: 5,
  at_depth: 6,
}

const LOGIC_MAP = { and_any: 0, not_all: 1, not_any: 2, and_all: 3 }
const ROLE_MAP = { system: 0, user: 1, assistant: 2 }

// 检测 SillyTavern 环境
function isSillyTavernEnv() {
  return typeof window !== 'undefined' && typeof window.SillyTavern !== 'undefined'
}

// 将 workshop entry 转换为 ST FlattenedWorldInfoEntry 格式
function toStEntry(entry, uid, packId) {
  return {
    uid,
    comment: entry.name,
    content: entry.content,
    disable: !entry.enabled,
    constant: entry.strategy_type === 'constant',
    selective: entry.strategy_type === 'selective',
    key: entry.keys || [],
    keysecondary: entry.keys_secondary || [],
    selectiveLogic: LOGIC_MAP[entry.keys_secondary_logic] ?? 0,
    scanDepth: entry.scan_depth === 'same_as_global' ? null : parseInt(entry.scan_depth),
    position: POSITION_MAP[entry.position_type] ?? 1,
    order: entry.position_order,
    depth: entry.position_depth,
    role: ROLE_MAP[entry.position_role] ?? 0,
    probability: entry.probability,
    excludeRecursion: entry.recursion_prevent_incoming,
    preventRecursion: entry.recursion_prevent_outgoing,
    delayUntilRecursion: entry.recursion_delay_until != null,
    sticky: entry.effect_sticky != null ? parseInt(entry.effect_sticky) : null,
    cooldown: entry.effect_cooldown != null ? parseInt(entry.effect_cooldown) : null,
    delay: entry.effect_delay != null ? parseInt(entry.effect_delay) : null,
    extra: {
      workshop_entry_id: entry.id,
      pack_id: packId,
      source: 'storyshare_workshop',
    },
  }
}

export const useWorkshopStore = defineStore('workshop', () => {
  // ── Pack 列表状态 ────────────────────────────────────────────
  const packs = ref([])
  const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const loading = ref(false)
  const error = ref(null)

  // ── 当前 Pack 详情 ───────────────────────────────────────────
  const currentPack = ref(null)
  const currentPackLoading = ref(false)

  // ── ST 订阅状态 ──────────────────────────────────────────────
  // { [packId]: boolean } — 记录哪些 pack 已插入 ST 世界书
  const subscribedPacksInST = ref({})
  const stLoading = ref(false)

  // ── 工坊列表状态 ─────────────────────────────────────────────
  const workshops = ref([])
  const workshopsLoading = ref(false)

  // ── 动态世界书名称 ────────────────────────────────────────────
  // 默认读取 steampunk 分区的 localStorage 值（或默认值）
  const worldbookName = ref(getWorldbookName('steampunk'))

  function setWorldbookName(slug, name) {
    worldbookName.value = name
    saveWorldbookName(slug, name)
  }

  // 切换分区时更新 worldbookName（fallback 到工坊表的 worldbook 字段）
  function loadWorldbookForSection(slug) {
    const stored = getWorldbookName(slug)
    if (stored) {
      worldbookName.value = stored
    } else {
      const w = workshops.value.find(w => w.slug === slug)
      worldbookName.value = w?.worldbook || slug
    }
  }

  // ── 工坊 API 操作 ────────────────────────────────────────────

  async function fetchWorkshops() {
    workshopsLoading.value = true
    try {
      const res = await fetch('/api/workshop/workshops', { credentials: 'include' })
      if (!res.ok) throw new Error('获取工坊列表失败')
      const json = await res.json()
      workshops.value = json.data
    } catch (err) {
      error.value = err.message || '获取工坊列表失败'
    } finally {
      workshopsLoading.value = false
    }
  }

  async function createWorkshop(payload) {
    error.value = null
    try {
      const res = await fetch('/api/workshop/workshops', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || '创建工坊失败'
        return null
      }
      workshops.value = [...workshops.value, json.data]
      return json.data
    } catch (err) {
      error.value = err.message || '创建工坊失败'
      return null
    }
  }

  async function updateWorkshop(id, payload) {
    error.value = null
    try {
      const res = await fetch(`/api/workshop/workshops/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || '更新工坊失败'
        return null
      }
      // 更新本地缓存
      workshops.value = workshops.value.map(w => w.id === id ? json.data : w)
      return json.data
    } catch (err) {
      error.value = err.message || '更新工坊失败'
      return null
    }
  }

  // ── Pack API 操作 ────────────────────────────────────────────

  // fetchPacks(page, { workshop, search, tag, authorId })
  async function fetchPacks(page = 1, { workshop, search, tag, authorId } = {}) {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams({ page, limit: 20 })
      if (workshop) params.set('workshop', workshop)
      if (search) params.set('q', search)
      if (tag) params.set('tag', tag)
      if (authorId) params.set('author_id', authorId)
      const res = await fetch(`/api/workshop?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('获取 Pack 列表失败')
      const json = await res.json()
      packs.value = json.data
      pagination.value = json.pagination
    } catch (err) {
      error.value = err.message || '获取 Pack 列表失败'
    } finally {
      loading.value = false
    }
  }

  async function fetchPack(packId) {
    currentPackLoading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/workshop/packs/${packId}`, { credentials: 'include' })
      if (!res.ok) throw new Error('获取 Pack 详情失败')
      const json = await res.json()
      currentPack.value = json.data
      return json.data
    } catch (err) {
      error.value = err.message || '获取 Pack 详情失败'
      return null
    } finally {
      currentPackLoading.value = false
    }
  }

  async function createPack(payload) {
    error.value = null
    try {
      const res = await fetch('/api/workshop/packs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || '创建 Pack 失败'
        return null
      }
      return json.data
    } catch (err) {
      error.value = err.message || '创建 Pack 失败'
      return null
    }
  }

  async function updatePack(packId, payload) {
    error.value = null
    try {
      const res = await fetch(`/api/workshop/packs/${packId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || '更新 Pack 失败'
        return false
      }
      return true
    } catch (err) {
      error.value = err.message || '更新 Pack 失败'
      return false
    }
  }

  async function deletePack(packId) {
    error.value = null
    try {
      const res = await fetch(`/api/workshop/packs/${packId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || '删除 Pack 失败'
        return false
      }
      packs.value = packs.value.filter((p) => p.id !== packId)
      return true
    } catch (err) {
      error.value = err.message || '删除 Pack 失败'
      return false
    }
  }

  // ── 点赞 ─────────────────────────────────────────────────────

  async function toggleLike(packId) {
    error.value = null
    try {
      const res = await fetch(`/api/workshop/packs/${packId}/like`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || '操作失败'
        return null
      }
      // 更新列表中的数据
      const pack = packs.value.find((p) => p.id === packId)
      if (pack) {
        pack.is_liked = json.liked
        pack.like_count = json.like_count
      }
      if (currentPack.value && currentPack.value.id === packId) {
        currentPack.value.is_liked = json.liked
        currentPack.value.like_count = json.like_count
      }
      return json
    } catch (err) {
      error.value = err.message || '操作失败'
      return null
    }
  }

  // ── 订阅（服务端计数 + 可选 ST 操作）───────────────────────────

  async function toggleSubscribe(pack) {
    error.value = null
    try {
      const res = await fetch(`/api/workshop/packs/${pack.id}/subscribe`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || '操作失败'
        return null
      }

      // 更新列表/详情中的数据
      const p = packs.value.find((p) => p.id === pack.id)
      if (p) {
        p.is_subscribed = json.subscribed
        p.sub_count = json.sub_count
      }
      if (currentPack.value && currentPack.value.id === pack.id) {
        currentPack.value.is_subscribed = json.subscribed
        currentPack.value.sub_count = json.sub_count
      }

      // ST 操作（仅在 ST 环境中执行）
      if (isSillyTavernEnv()) {
        if (json.subscribed) {
          await insertPackToWorldbook(pack)
        } else {
          await removePackFromWorldbook(pack.id)
        }
      }

      return json
    } catch (err) {
      error.value = err.message || '操作失败'
      return null
    }
  }

  // ── 条目 API 操作 ────────────────────────────────────────────

  async function fetchEntry(entryId) {
    try {
      const res = await fetch(`/api/workshop/entries/${entryId}`, { credentials: 'include' })
      if (!res.ok) throw new Error('获取条目失败')
      const json = await res.json()
      return json.data
    } catch (err) {
      error.value = err.message || '获取条目失败'
      return null
    }
  }

  async function createEntry(packId, payload) {
    error.value = null
    try {
      const res = await fetch(`/api/workshop/packs/${packId}/entries`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || '添加条目失败'
        return null
      }
      return json.data
    } catch (err) {
      error.value = err.message || '添加条目失败'
      return null
    }
  }

  async function updateEntry(entryId, payload) {
    error.value = null
    try {
      const res = await fetch(`/api/workshop/entries/${entryId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || '更新条目失败'
        return false
      }
      return true
    } catch (err) {
      error.value = err.message || '更新条目失败'
      return false
    }
  }

  async function deleteEntry(entryId) {
    error.value = null
    try {
      const res = await fetch(`/api/workshop/entries/${entryId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || '删除条目失败'
        return false
      }
      // 从当前 pack 的 entries 中移除
      if (currentPack.value && currentPack.value.entries) {
        currentPack.value.entries = currentPack.value.entries.filter((e) => e.id !== entryId)
        currentPack.value.entry_count = currentPack.value.entries.length
      }
      return true
    } catch (err) {
      error.value = err.message || '删除条目失败'
      return false
    }
  }

  // ── SillyTavern 世界书操作 ───────────────────────────────────

  // 扫描世界书，构建已订阅 pack 的映射 { packId: true }
  async function scanSubscribedPacks() {
    if (!isSillyTavernEnv()) return
    stLoading.value = true
    try {
      const data = await window.SillyTavern.loadWorldInfo(worldbookName.value)
      if (!data || !data.entries) {
        subscribedPacksInST.value = {}
        return
      }
      const map = {}
      for (const uid of Object.keys(data.entries)) {
        const e = data.entries[uid]
        if (e.extra && e.extra.source === 'storyshare_workshop' && e.extra.pack_id != null) {
          map[e.extra.pack_id] = true
        }
      }
      subscribedPacksInST.value = map
    } catch (err) {
      console.error('[Workshop] 扫描世界书失败:', err)
    } finally {
      stLoading.value = false
    }
  }

  // 将整个 pack 的所有条目插入到 ST 世界书
  async function insertPackToWorldbook(pack) {
    if (!isSillyTavernEnv()) return false
    stLoading.value = true
    try {
      // 获取最新 pack 数据（含所有条目）
      let entries = pack.entries
      if (!entries) {
        const res = await fetch(`/api/workshop/packs/${pack.id}`, { credentials: 'include' })
        if (!res.ok) throw new Error('获取 Pack 详情失败')
        const json = await res.json()
        entries = json.data.entries || []
      }

      let data = await window.SillyTavern.loadWorldInfo(worldbookName.value)
      if (!data || !data.entries) data = { entries: {} }

      // 先移除此 pack 的旧条目（幂等操作）
      for (const uid of Object.keys(data.entries)) {
        const e = data.entries[uid]
        if (e.extra && e.extra.source === 'storyshare_workshop' && e.extra.pack_id === pack.id) {
          delete data.entries[uid]
        }
      }

      // 插入新条目
      const existingUids = Object.keys(data.entries).map(Number)
      let nextUid = existingUids.length > 0 ? Math.max(...existingUids) + 1 : 0

      for (const entry of entries) {
        data.entries[nextUid] = toStEntry(entry, nextUid, pack.id)
        nextUid++
      }

      await window.SillyTavern.saveWorldInfo(worldbookName.value, data, true)
      subscribedPacksInST.value = { ...subscribedPacksInST.value, [pack.id]: true }

      if (typeof window.SillyTavern.reloadWorldInfoEditor === 'function') {
        window.SillyTavern.reloadWorldInfoEditor(worldbookName.value)
      }
      return true
    } catch (err) {
      console.error('[Workshop] 插入 Pack 到世界书失败:', err)
      error.value = '插入世界书失败'
      return false
    } finally {
      stLoading.value = false
    }
  }

  // 从 ST 世界书中移除某个 pack 的所有条目
  async function removePackFromWorldbook(packId) {
    if (!isSillyTavernEnv()) return false
    stLoading.value = true
    try {
      const data = await window.SillyTavern.loadWorldInfo(worldbookName.value)
      if (!data || !data.entries) return false

      let removed = false
      for (const uid of Object.keys(data.entries)) {
        const e = data.entries[uid]
        if (e.extra && e.extra.source === 'storyshare_workshop' && e.extra.pack_id === packId) {
          delete data.entries[uid]
          removed = true
        }
      }

      if (removed) {
        await window.SillyTavern.saveWorldInfo(worldbookName.value, data, true)
      }

      const updated = { ...subscribedPacksInST.value }
      delete updated[packId]
      subscribedPacksInST.value = updated

      if (typeof window.SillyTavern.reloadWorldInfoEditor === 'function') {
        window.SillyTavern.reloadWorldInfoEditor(worldbookName.value)
      }
      return true
    } catch (err) {
      console.error('[Workshop] 移除 Pack 世界书条目失败:', err)
      error.value = '移除世界书条目失败'
      return false
    } finally {
      stLoading.value = false
    }
  }

  return {
    // 状态
    packs,
    pagination,
    loading,
    error,
    currentPack,
    currentPackLoading,
    subscribedPacksInST,
    stLoading,
    worldbookName,
    workshops,
    workshopsLoading,
    // 工具
    isSillyTavernEnv,
    // 世界书名称
    setWorldbookName,
    loadWorldbookForSection,
    // 工坊 API
    fetchWorkshops,
    createWorkshop,
    updateWorkshop,
    // Pack API
    fetchPacks,
    fetchPack,
    createPack,
    updatePack,
    deletePack,
    // 互动
    toggleLike,
    toggleSubscribe,
    // 条目 API
    fetchEntry,
    createEntry,
    updateEntry,
    deleteEntry,
    // ST 操作
    scanSubscribedPacks,
    insertPackToWorldbook,
    removePackFromWorldbook,
  }
})
