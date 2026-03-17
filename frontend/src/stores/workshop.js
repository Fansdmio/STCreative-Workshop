import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getWorldbookName, saveWorldbookName } from '@/config/sections'

// 检测 SillyTavern 环境（直接嵌入 iframe 模式）
function isSillyTavernEnv() {
  return typeof window !== 'undefined' && typeof window.SillyTavern !== 'undefined'
}

// 检测是否从 ST 扩展打开（弹窗模式或 iframe 模式）
function isFromStExtension() {
  if (typeof window === 'undefined') return false
  // 弹窗模式：window.opener 存在（同源时可用）
  if (window.opener && window.opener !== window) return true
  // iframe 模式：嵌入在 SillyTavern 页面的 iframe 中
  if (window.parent && window.parent !== window) return true
  return false
}

// 将 workshop entry 转换为 TavernHelper WorldbookEntry 格式（不含 uid，由 TH 自动分配）
function toStEntry(entry, packId) {
  return {
    name: entry.name,
    enabled: !!entry.enabled,
    strategy: {
      type: entry.strategy_type || 'selective',
      keys: entry.keys || [],
      keys_secondary: {
        logic: entry.keys_secondary_logic || 'and_any',
        keys: entry.keys_secondary || [],
      },
      scan_depth: entry.scan_depth === 'same_as_global' || entry.scan_depth == null
        ? 'same_as_global'
        : Number(entry.scan_depth),
    },
    position: {
      type: entry.position_type || 'after_character_definition',
      role: entry.position_role || 'system',
      depth: entry.position_depth != null ? Number(entry.position_depth) : 4,
      order: entry.position_order != null ? Number(entry.position_order) : 100,
    },
    content: entry.content || '',
    probability: entry.probability != null ? Number(entry.probability) : 100,
    recursion: {
      prevent_incoming: !!entry.recursion_prevent_incoming,
      prevent_outgoing: !!entry.recursion_prevent_outgoing,
      delay_until: entry.recursion_delay_until != null ? Number(entry.recursion_delay_until) : null,
    },
    effect: {
      sticky: entry.effect_sticky != null ? Number(entry.effect_sticky) : null,
      cooldown: entry.effect_cooldown != null ? Number(entry.effect_cooldown) : null,
      delay: entry.effect_delay != null ? Number(entry.effect_delay) : null,
    },
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

  // ── 我的订阅状态 ─────────────────────────────────────────────
  const mySubscriptions = ref([])
  const mySubscriptionsLoading = ref(false)

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

  // 获取当前用户的订阅模组列表
  async function fetchMySubscriptions() {
    mySubscriptionsLoading.value = true
    error.value = null
    try {
      const res = await fetch('/api/workshop/my-subscriptions', { credentials: 'include' })
      if (!res.ok) throw new Error('获取订阅列表失败')
      const json = await res.json()
      mySubscriptions.value = json.data
    } catch (err) {
      error.value = err.message || '获取订阅列表失败'
    } finally {
      mySubscriptionsLoading.value = false
    }
  }

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

      // ST 扩展模式（stConnected 已是可靠标志，不再依赖 window.opener）
      if (stConnected.value) {
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
      if (type === 'st_extension_opener' && source === 'st_workshop_extension') {
        console.log('[Workshop] 接收到 ST 扩展窗口引用')
        _stExtensionWindow = event.source
        // 立即发送 ping
        if (_stExtensionWindow) {
          console.log('[Workshop] 向 ST 扩展发送 ping')
          _stExtensionWindow.postMessage({ type: 'workshop_ping', payload: {} }, '*')
        }
        return
      }

      // 安全检查：必须来自 opener、已保存的扩展窗口或 parent（iframe 模式）
      const isFromParent = window.parent && window.parent !== window && event.source === window.parent
      if (event.source !== window.opener && event.source !== _stExtensionWindow && !isFromParent) {
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

  // 发送消息给 ST 扩展（Promise 包装，20s 超时）
  function _sendToOpener(type, payload, requestKey) {
    return new Promise((resolve, reject) => {
      // 优先使用保存的扩展窗口引用，其次 window.opener，最后 window.parent（iframe 模式）
      const targetWindow = _stExtensionWindow || window.opener || (window.parent !== window ? window.parent : null)
      
      if (!targetWindow || targetWindow === window) {
        reject(new Error('未从 ST 扩展打开'))
        return
      }

      const timer = setTimeout(() => {
        delete _pending[requestKey]
        stConnected.value = false
        reject(new Error('请求超时（20秒），连接已重置'))
      }, 20000)

      _pending[requestKey] = { resolve, reject, timer }
      targetWindow.postMessage({ type, payload }, '*')
    })
  }

  // 初始化 ST 扩展模式（postMessage 握手）
  async function initStExtensionMode() {
    console.log('[Workshop] 初始化 ST 扩展模式...')
    console.log('[Workshop] window.opener:', window.opener)
    console.log('[Workshop] window.parent !== window:', window.parent !== window)
    console.log('[Workshop] _stExtensionWindow:', _stExtensionWindow)
    
    if (stConnected.value) {
      console.log('[Workshop] 已连接，跳过重复初始化')
      return // 已连接，幂等
    }

    // 始终设置监听器，等待扩展发送 opener 引用
    console.log('[Workshop] 设置消息监听器...')
    _setupMessageListener()
    
    // 弹窗模式：如果有 window.opener，尝试发送 ping
    if (window.opener && window.opener !== window) {
      try {
        console.log('[Workshop] 检测到 window.opener，发送 ping...')
        window.opener.postMessage({ type: 'workshop_ping', payload: {} }, '*')
      } catch (err) {
        console.error('[Workshop] postMessage 到 opener 失败:', err)
      }
    }

    // iframe 模式：如果在 iframe 中，尝试向父窗口发送 ping
    if (window.parent && window.parent !== window) {
      try {
        console.log('[Workshop] 检测到 iframe 模式，发送 ping 到 parent...')
        window.parent.postMessage({ type: 'workshop_ping', payload: {} }, '*')
      } catch (err) {
        console.error('[Workshop] postMessage 到 parent 失败:', err)
      }
    }
  }

  // 通过 ST 扩展扫描（postMessage）
  async function _scanViaST(wbName) {
    try {
      const result = await _sendToOpener('workshop_scan', { worldbookName: wbName }, 'scan')
      if (result && result.success) {
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

  // 通过 ST 扩展订阅（postMessage）
  async function _subscribeViaST(pack) {
    try {
      // 获取完整条目（如果当前 pack 没有 entries）
      let entries = pack.entries
      if (!entries) {
        const res = await fetch(`/api/workshop/packs/${pack.id}`, { credentials: 'include' })
        if (!res.ok) throw new Error('获取 Pack 详情失败')
        const json = await res.json()
        entries = json.data.entries || []
      }

      // 转换为 TavernHelper WorldbookEntry 格式（不含 uid）
      const stEntries = entries.map(entry => toStEntry(entry, pack.id))

      const result = await _sendToOpener('workshop_subscribe', {
        packId: pack.id,
        packTitle: pack.title,
        worldbookName: worldbookName.value,
        entries: stEntries,
      }, `subscribe_${++_requestCounter}`)

      if (result && result.success) {
        subscribedPacksInST.value = { ...subscribedPacksInST.value, [pack.id]: true }
        stNotification.value = { type: 'success', message: result.message || '订阅成功' }
      } else {
        stNotification.value = { type: 'error', message: (result && result.message) || '订阅失败' }
      }
      return result && result.success
    } catch (err) {
      console.error('[Workshop] ST 扩展订阅失败:', err)
      stNotification.value = { type: 'error', message: '订阅失败：' + err.message }
      return false
    }
  }

  // 通过 ST 扩展取消订阅（postMessage）
  async function _unsubscribeViaST(packId) {
    try {
      const result = await _sendToOpener('workshop_unsubscribe', {
        packId,
        worldbookName: worldbookName.value,
      }, `unsubscribe_${++_requestCounter}`)

      if (result && result.success) {
        const updated = { ...subscribedPacksInST.value }
        delete updated[packId]
        subscribedPacksInST.value = updated
        stNotification.value = { type: 'success', message: result.message || '取消订阅成功' }
      } else {
        stNotification.value = { type: 'error', message: (result && result.message) || '取消订阅失败' }
      }
      return result && result.success
    } catch (err) {
      console.error('[Workshop] ST 扩展取消订阅失败:', err)
      stNotification.value = { type: 'error', message: '取消订阅失败：' + err.message }
      return false
    }
  }

  // ── SillyTavern 世界书操作 ───────────────────────────────────

  // 扫描世界书，构建已订阅 pack 的映射 { packId: true }
  async function scanSubscribedPacks() {
    // ST 扩展模式（stConnected 已是可靠标志，不再依赖 window.opener）
    if (stConnected.value) {
      stLoading.value = true
      await _scanViaST(worldbookName.value)
      stLoading.value = false
      return
    }

    // 直接嵌入 ST 模式
    if (!isSillyTavernEnv()) return
    stLoading.value = true
    try {
      const TH = window.TavernHelper
      if (!TH) return

      const names = TH.getWorldbookNames()
      if (!names.includes(worldbookName.value)) {
        subscribedPacksInST.value = {}
        return
      }

      const entries = await TH.getWorldbook(worldbookName.value)
      const map = {}
      for (const e of entries) {
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

  // 将整个 pack 的所有条目插入到 ST 世界书（TavernHelper API）
  async function insertPackToWorldbook(pack) {
    if (!isSillyTavernEnv()) return false
    stLoading.value = true
    try {
      const TH = window.TavernHelper
      if (!TH) throw new Error('TavernHelper 不可用')

      // 获取最新 pack 数据（含所有条目）
      let entries = pack.entries
      if (!entries) {
        const res = await fetch(`/api/workshop/packs/${pack.id}`, { credentials: 'include' })
        if (!res.ok) throw new Error('获取 Pack 详情失败')
        const json = await res.json()
        entries = json.data.entries || []
      }

      // 确保世界书存在
      const names = TH.getWorldbookNames()
      if (!names.includes(worldbookName.value)) {
        await TH.createWorldbook(worldbookName.value)
      }

      // 先移除此 pack 的旧条目（幂等操作）
      await TH.deleteWorldbookEntries(
        worldbookName.value,
        e => e.extra && e.extra.source === 'storyshare_workshop' && e.extra.pack_id === pack.id,
        { render: 'debounced' }
      )

      // 插入新条目（TavernHelper 自动分配 uid）
      const stEntries = entries.map(entry => toStEntry(entry, pack.id))
      await TH.createWorldbookEntries(worldbookName.value, stEntries, { render: 'immediate' })

      subscribedPacksInST.value = { ...subscribedPacksInST.value, [pack.id]: true }
      return true
    } catch (err) {
      console.error('[Workshop] 插入 Pack 到世界书失败:', err)
      error.value = '插入世界书失败'
      return false
    } finally {
      stLoading.value = false
    }
  }

  // 从 ST 世界书中移除某个 pack 的所有条目（TavernHelper API）
  async function removePackFromWorldbook(packId) {
    if (!isSillyTavernEnv()) return false
    stLoading.value = true
    try {
      const TH = window.TavernHelper
      if (!TH) throw new Error('TavernHelper 不可用')

      const names = TH.getWorldbookNames()
      if (!names.includes(worldbookName.value)) return false

      await TH.deleteWorldbookEntries(
        worldbookName.value,
        e => e.extra && e.extra.source === 'storyshare_workshop' && e.extra.pack_id === packId,
        { render: 'immediate' }
      )

      const updated = { ...subscribedPacksInST.value }
      delete updated[packId]
      subscribedPacksInST.value = updated
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
    mySubscriptions,
    mySubscriptionsLoading,
    // ST 扩展状态
    stConnected,
    stNotification,
    // 方法
    fetchPacks,
    fetchPack,
    fetchWorkshops,
    fetchMySubscriptions,
    toggleLike,
    toggleSubscribe,
    createPack,
    updatePack,
    deletePack,
    createEntry,
    updateEntry,
    deleteEntry,
    scanSubscribedPacks,
    insertPackToWorldbook,
    removePackFromWorldbook,
    setWorldbookName,
    loadWorldbookForSection,
    initStExtensionMode,
    // 工具函数
    isSillyTavernEnv,
    isFromStExtension,
  }
})
