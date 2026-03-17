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

// 检测 SillyTavern 环境（直接嵌入 iframe 模式）
function isSillyTavernEnv() {
  return typeof window !== 'undefined' && typeof window.SillyTavern !== 'undefined'
}

// 检测是否从 ST 扩展弹窗打开（window.opener 存在且非自身）
function isFromStExtension() {
  return typeof window !== 'undefined' && window.opener && window.opener !== window
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

  // ── ST 扩展模式状态 ──────────────────────────────────────────
  const stConnected = ref(false) // 是否已连接到 ST 扩展
  const stNotification = ref(null) // { type: 'success'|'error', message: string }
  let _pending = {} // { requestId: { resolve, reject, timer } } 非响应式
  let _listenerAdded = false
  let _requestCounter = 0
  let _stExtensionWindow = null // ST 扩展窗口引用（用于跨域场景）

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

      // ST 扩展模式
      if (isFromStExtension() && stConnected.value) {
        if (json.subscribed) {
          await _subscribeViaST(pack)
        } else {
          await _unsubscribeViaST(pack.id)
        }
        return json
      }

      // 直接嵌入 ST 模式
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

  // ── ST 扩展模式：postMessage 通信 ──────────────────────────────

  // 设置消息监听器（仅添加一次）
  function _setupMessageListener() {
    if (_listenerAdded) return
    _listenerAdded = true

    window.addEventListener('message', (event) => {
      const { type, success, message, packIds, entryCountMap, removedCount, source } = event.data || {}
      if (!type) return

      console.log('[Workshop] 收到消息:', event.data, 'from:', event.origin)

      // 特殊处理：接收来自 ST 扩展的 opener 引用
      if (type === 'st_extension_opener' && source === 'storyshare_extension') {
        console.log('[Workshop] 接收到 ST 扩展窗口引用')
        _stExtensionWindow = event.source
        // 立即发送 ping
        if (_stExtensionWindow) {
          console.log('[Workshop] 向 ST 扩展发送 ping')
          _stExtensionWindow.postMessage({ type: 'workshop_ping', payload: {} }, '*')
        }
        return
      }

      // 安全检查：必须来自 opener 或已保存的扩展窗口
      if (event.source !== window.opener && event.source !== _stExtensionWindow) {
        console.log('[Workshop] 忽略未知来源的消息')
        return
      }

      console.log('[Workshop] 收到 ST 扩展消息:', event.data)

      // 握手响应
      if (type === 'workshop_pong') {
        stConnected.value = true
        return
      }

      // 扫描结果
      if (type === 'workshop_scan_result') {
        const resolve = _pending['scan']?.resolve
        if (resolve) {
          clearTimeout(_pending['scan']?.timer)
          delete _pending['scan']
          resolve({ success, packIds, entryCountMap })
        }
        return
      }

      // 订阅结果
      if (type === 'workshop_subscribe_result') {
        const key = Object.keys(_pending).find(k => k.startsWith('subscribe_'))
        if (key) {
          const { resolve } = _pending[key]
          clearTimeout(_pending[key]?.timer)
          delete _pending[key]
          resolve({ success, message })
        }
        return
      }

      // 取消订阅结果
      if (type === 'workshop_unsubscribe_result') {
        const key = Object.keys(_pending).find(k => k.startsWith('unsubscribe_'))
        if (key) {
          const { resolve } = _pending[key]
          clearTimeout(_pending[key]?.timer)
          delete _pending[key]
          resolve({ success, message, removedCount })
        }
        return
      }
    })
  }

  // 发送消息给 ST 扩展（Promise 包装，5s 超时）
  function _sendToOpener(type, payload, requestKey) {
    return new Promise((resolve, reject) => {
      // 优先使用保存的扩展窗口引用，其次使用 window.opener
      const targetWindow = _stExtensionWindow || window.opener
      
      if (!targetWindow || targetWindow === window) {
        reject(new Error('未从 ST 扩展打开'))
        return
      }

      const timer = setTimeout(() => {
        delete _pending[requestKey]
        reject(new Error('请求超时（5秒）'))
      }, 5000)

      _pending[requestKey] = { resolve, reject, timer }
      targetWindow.postMessage({ type, payload }, '*')
    })
  }

  // 初始化 ST 扩展模式（发送 ping，握手）
  async function initStExtensionMode() {
    console.log('[Workshop] 初始化 ST 扩展模式...')
    console.log('[Workshop] window.opener:', window.opener)
    console.log('[Workshop] _stExtensionWindow:', _stExtensionWindow)
    
    if (stConnected.value) {
      console.log('[Workshop] 已连接，跳过重复初始化')
      return // 已连接，幂等
    }

    // 始终设置监听器，等待扩展发送 opener 引用
    console.log('[Workshop] 设置消息监听器，等待 ST 扩展连接...')
    _setupMessageListener()
    
    // 如果有 window.opener，尝试发送 ping
    if (window.opener && window.opener !== window) {
      try {
        console.log('[Workshop] 检测到 window.opener，发送 ping...')
        window.opener.postMessage({ type: 'workshop_ping', payload: {} }, '*')
        console.log('[Workshop] ping 已发送，等待 pong...')
        // 等待 500ms 让 pong 返回
        await new Promise((resolve) => setTimeout(resolve, 500))
        console.log('[Workshop] 握手完成，stConnected:', stConnected.value)
      } catch (err) {
        console.error('[Workshop] ST 扩展握手失败:', err)
      }
    } else {
      console.log('[Workshop] 无 window.opener，等待扩展主动发送引用...')
      // 等待扩展发送 st_extension_opener 消息
    }
  }

  // 通过 ST 扩展扫描
  async function _scanViaST(worldbookName) {
    try {
      const result = await _sendToOpener('workshop_scan', { worldbookName }, 'scan')
      if (result.success) {
        const map = {}
        for (const packId of result.packIds || []) {
          map[packId] = true
        }
        subscribedPacksInST.value = map
      }
    } catch (err) {
      console.error('[Workshop] ST 扫描失败:', err)
      subscribedPacksInST.value = {}
    }
  }

  // 通过 ST 扩展订阅
  async function _subscribeViaST(pack) {
    const requestKey = `subscribe_${++_requestCounter}`
    try {
      // 获取完整条目（如果当前 pack 没有 entries）
      let entries = pack.entries
      if (!entries) {
        const res = await fetch(`/api/workshop/packs/${pack.id}`, { credentials: 'include' })
        if (!res.ok) throw new Error('获取 Pack 详情失败')
        const json = await res.json()
        entries = json.data.entries || []
      }

      // 转换为 ST 格式
      const stEntries = entries.map((entry, idx) => toStEntry(entry, idx, pack.id))

      const result = await _sendToOpener(
        'workshop_subscribe',
        {
          packId: pack.id,
          packTitle: pack.title,
          worldbookName: worldbookName.value,
          entries: stEntries,
        },
        requestKey
      )

      if (result.success) {
        subscribedPacksInST.value = { ...subscribedPacksInST.value, [pack.id]: true }
        stNotification.value = { type: 'success', message: result.message || '订阅成功' }
      } else {
        stNotification.value = { type: 'error', message: result.message || '订阅失败' }
      }
      return result.success
    } catch (err) {
      console.error('[Workshop] ST 扩展订阅失败:', err)
      stNotification.value = { type: 'error', message: '订阅失败：' + err.message }
      return false
    }
  }

  // 通过 ST 扩展取消订阅
  async function _unsubscribeViaST(packId) {
    const requestKey = `unsubscribe_${++_requestCounter}`
    try {
      const result = await _sendToOpener(
        'workshop_unsubscribe',
        { packId, worldbookName: worldbookName.value },
        requestKey
      )

      if (result.success) {
        const updated = { ...subscribedPacksInST.value }
        delete updated[packId]
        subscribedPacksInST.value = updated
        stNotification.value = { type: 'success', message: result.message || '取消订阅成功' }
      } else {
        stNotification.value = { type: 'error', message: result.message || '取消订阅失败' }
      }
      return result.success
    } catch (err) {
      console.error('[Workshop] ST 扩展取消订阅失败:', err)
      stNotification.value = { type: 'error', message: '取消订阅失败：' + err.message }
      return false
    }
  }

  // ── SillyTavern 世界书操作 ───────────────────────────────────

  // 扫描世界书，构建已订阅 pack 的映射 { packId: true }
  async function scanSubscribedPacks() {
    // ST 扩展模式
    if (isFromStExtension() && stConnected.value) {
      stLoading.value = true
      await _scanViaST(worldbookName.value)
      stLoading.value = false
      return
    }

    // 直接嵌入 ST 模式
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
    // ST 扩展状态
    stConnected,
    stNotification,
    // 工具
    isSillyTavernEnv,
    isFromStExtension,
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
    // ST 扩展模式
    initStExtensionMode,
  }
})
