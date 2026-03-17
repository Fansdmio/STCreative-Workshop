import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getWorldbookName, saveWorldbookName } from '@/config/sections'

// 检测 SillyTavern 环境（直接嵌入 iframe 模式）
function isSillyTavernEnv() {
  return typeof window !== 'undefined' && typeof window.SillyTavern !== 'undefined'
}

// 检测是否从 ST 扩展弹窗打开（window.opener 存在且非自身）
function isFromStExtension() {
  return typeof window !== 'undefined' && window.opener && window.opener !== window
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
  let _httpPolling = false // HTTP 轮询是否正在运行
  let _httpPollingAbort = null // AbortController for HTTP polling

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

  // 通过 w2e HTTP 通道发送命令给 ST 扩展，并等待响应（最多 30 秒）
  async function _sendW2ECommand(type, payload) {
    console.log('[Workshop] 发送 w2e 命令:', type)

    // 1. 发送命令入队
    const cmdRes = await fetch('/api/st-bridge/w2e-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type, payload }),
    })
    if (!cmdRes.ok) throw new Error(`w2e 命令发送失败: ${cmdRes.status}`)
    const cmdData = await cmdRes.json()
    if (!cmdData.success) throw new Error('w2e 命令发送失败')
    const commandId = cmdData.commandId
    console.log('[Workshop] w2e 命令已入队:', commandId)

    // 2. 轮询等待扩展返回结果（最多 30 秒）
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1000))
      const resRes = await fetch(`/api/st-bridge/w2e-response/${commandId}`, {
        credentials: 'include',
      })
      if (!resRes.ok) continue
      const resData = await resRes.json()
      if (resData.success && resData.response) {
        console.log('[Workshop] w2e 收到响应:', resData.response)
        return resData.response
      }
    }
    throw new Error('等待扩展响应超时（30秒）')
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

    // 始终设置监听器，等待扩展发送 opener 引用（备用方案）
    console.log('[Workshop] 设置消息监听器...')
    _setupMessageListener()
    
    // 如果有 window.opener，尝试发送 ping（备用方案）
    if (window.opener && window.opener !== window) {
      try {
        console.log('[Workshop] 检测到 window.opener，发送 ping...')
        window.opener.postMessage({ type: 'workshop_ping', payload: {} }, '*')
      } catch (err) {
        console.error('[Workshop] postMessage 失败:', err)
      }
    }

    // 启动 HTTP 轮询（主要方案）
    console.log('[Workshop] 启动 HTTP 轮询...')
    _startHttpPolling()
  }

  // 启动 HTTP 长轮询，从后端获取扩展发送的命令
  function _startHttpPolling() {
    if (_httpPolling) {
      console.log('[Workshop] HTTP 轮询已在运行')
      return
    }

    _httpPolling = true
    _httpPollingAbort = new AbortController()
    console.log('[Workshop] HTTP 轮询已启动')

    const poll = async () => {
      while (_httpPolling) {
        try {
          const response = await fetch('/api/st-bridge/poll', {
            signal: _httpPollingAbort.signal,
            credentials: 'include',
          })

          if (!response.ok) {
            console.error('[Workshop] 轮询失败:', response.status)
            await new Promise(resolve => setTimeout(resolve, 5000))
            continue
          }

          const data = await response.json()
          
          if (data.success && data.command) {
            console.log('[Workshop] 收到 HTTP 命令:', data.command)
            await _handleHttpCommand(data.command)
          }
          
          // 继续下一次轮询
        } catch (err) {
          if (err.name === 'AbortError') {
            console.log('[Workshop] HTTP 轮询已停止')
            break
          }
          console.error('[Workshop] 轮询出错:', err)
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      }
    }

    poll()
  }

  // 停止 HTTP 轮询
  function _stopHttpPolling() {
    if (_httpPollingAbort) {
      _httpPollingAbort.abort()
    }
    _httpPolling = false
    console.log('[Workshop] HTTP 轮询已停止')
  }

  // 处理从 HTTP 桥接收到的命令
  async function _handleHttpCommand(command) {
    const { id, type, payload } = command

    console.log('[Workshop] 处理命令:', type, id)

    let result = { success: false, message: '未知命令' }

    try {
      switch (type) {
        case 'ping':
          // 握手
          stConnected.value = true
          console.log('[Workshop] 已连接到 ST 扩展（HTTP）')
          result = { success: true, connected: true }
          break

        case 'scan':
          result = await _executeScan(payload)
          break

        case 'subscribe':
          result = await _executeSubscribe(payload)
          break

        case 'unsubscribe':
          result = await _executeUnsubscribe(payload)
          break

        default:
          console.warn('[Workshop] 未知命令类型:', type)
      }
    } catch (err) {
      console.error('[Workshop] 执行命令失败:', err)
      result = { success: false, message: err.message }
    }

    // 提交结果到后端
    try {
      await fetch('/api/st-bridge/response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ commandId: id, result }),
      })
      console.log('[Workshop] 已提交命令结果:', id)
    } catch (err) {
      console.error('[Workshop] 提交结果失败:', err)
    }
  }

  // 执行扫描
  async function _executeScan(payload) {
    const { worldbookName } = payload
    if (!worldbookName) {
      return { success: false, packIds: [], entryCountMap: {} }
    }

    try {
      // 直接嵌入模式
      if (isSillyTavernEnv()) {
        const TH = window.TavernHelper
        if (!TH) return { success: false, message: 'TavernHelper 不可用', packIds: [], entryCountMap: {} }

        const names = TH.getWorldbookNames()
        if (!names.includes(worldbookName)) {
          return { success: true, packIds: [], entryCountMap: {} }
        }

        const entries = await TH.getWorldbook(worldbookName)
        const packMap = {}
        for (const e of entries) {
          if (e.extra && e.extra.source === 'storyshare_workshop' && e.extra.pack_id != null) {
            const packId = e.extra.pack_id
            packMap[packId] = (packMap[packId] || 0) + 1
          }
        }

        const packIds = Object.keys(packMap).map(Number)
        const map = {}
        for (const packId of packIds) {
          map[packId] = true
        }
        subscribedPacksInST.value = map

        return { success: true, packIds, entryCountMap: packMap }
      }

      return { success: false, message: '非 SillyTavern 环境' }
    } catch (err) {
      console.error('[Workshop] 扫描失败:', err)
      return { success: false, packIds: [], entryCountMap: {} }
    }
  }

  // 执行订阅
  async function _executeSubscribe(payload) {
    const { packId, packTitle, worldbookName, entries } = payload
    if (!packId || !worldbookName || !entries) {
      return { success: false, message: '缺少必要参数' }
    }

    if (!isSillyTavernEnv()) {
      return { success: false, message: '非 SillyTavern 环境' }
    }

    try {
      const TH = window.TavernHelper
      if (!TH) return { success: false, message: 'TavernHelper 不可用' }

      // 确保世界书存在（不存在则创建）
      const names = TH.getWorldbookNames()
      if (!names.includes(worldbookName)) {
        await TH.createWorldbook(worldbookName)
      }

      // 移除旧条目（幂等）
      await TH.deleteWorldbookEntries(
        worldbookName,
        e => e.extra && e.extra.source === 'storyshare_workshop' && e.extra.pack_id === packId,
        { render: 'debounced' }
      )

      // 插入新条目
      await TH.createWorldbookEntries(worldbookName, entries, { render: 'immediate' })

      subscribedPacksInST.value = { ...subscribedPacksInST.value, [packId]: true }
      stNotification.value = { type: 'success', message: `已订阅「${packTitle}」` }
      return { success: true, message: `已将「${packTitle}」的 ${entries.length} 条条目插入世界书` }
    } catch (err) {
      console.error('[Workshop] 订阅失败:', err)
      stNotification.value = { type: 'error', message: '订阅失败' }
      return { success: false, message: '插入世界书失败：' + err.message }
    }
  }

  // 执行取消订阅
  async function _executeUnsubscribe(payload) {
    const { packId, worldbookName } = payload
    if (packId == null || !worldbookName) {
      return { success: false, message: '缺少必要参数', removedCount: 0 }
    }

    if (!isSillyTavernEnv()) {
      return { success: false, message: '非 SillyTavern 环境', removedCount: 0 }
    }

    try {
      const TH = window.TavernHelper
      if (!TH) return { success: false, message: 'TavernHelper 不可用', removedCount: 0 }

      const names = TH.getWorldbookNames()
      if (!names.includes(worldbookName)) {
        return { success: true, message: '世界书不存在', removedCount: 0 }
      }

      const { deleted_entries } = await TH.deleteWorldbookEntries(
        worldbookName,
        e => e.extra && e.extra.source === 'storyshare_workshop' && e.extra.pack_id === packId,
        { render: 'immediate' }
      )
      const removedCount = deleted_entries.length

      const updated = { ...subscribedPacksInST.value }
      delete updated[packId]
      subscribedPacksInST.value = updated

      stNotification.value = { type: 'success', message: '已取消订阅' }
      return { success: true, message: `已从世界书移除 ${removedCount} 条条目`, removedCount }
    } catch (err) {
      console.error('[Workshop] 取消订阅失败:', err)
      stNotification.value = { type: 'error', message: '取消订阅失败' }
      return { success: false, message: '移除世界书条目失败：' + err.message, removedCount: 0 }
    }
  }

  // 通过 ST 扩展扫描
  async function _scanViaST(worldbookName) {
    try {
      const result = await _sendW2ECommand('scan', { worldbookName })
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

  // 通过 ST 扩展订阅（w2e HTTP 通道）
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

      const result = await _sendW2ECommand('subscribe', {
        packId: pack.id,
        packTitle: pack.title,
        worldbookName: worldbookName.value,
        entries: stEntries,
      })

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

  // 通过 ST 扩展取消订阅（w2e HTTP 通道）
  async function _unsubscribeViaST(packId) {
    try {
      const result = await _sendW2ECommand('unsubscribe', {
        packId,
        worldbookName: worldbookName.value,
      })

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
    // ST 扩展状态
    stConnected,
    stNotification,
    // 方法
    fetchPacks,
    fetchPack,
    fetchWorkshops,
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
    stopHttpPolling: _stopHttpPolling, // 暴露停止轮询方法
    // 工具函数
    isSillyTavernEnv,
    isFromStExtension,
  }
})
