/**
 * StoryShare 创意工坊 SillyTavern 扩展
 * 
 * 提供弹窗式创意工坊浏览器，支持直接订阅/退订模组并插入世界书
 */

import { extension_settings, getContext } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';

const EXTENSION_NAME = 'storyshare-workshop';
const DEFAULT_WORKSHOP_URL = 'YOUR_DOMAIN_HERE';

let workshopWindow = null;

// w2e 轮询状态
let _w2ePolling = false;
let _w2eAbortController = null;

// ═══════════════════════════════════════════════════════════════════════════
// 扩展初始化
// ═══════════════════════════════════════════════════════════════════════════

jQuery(async () => {
  // 初始化设置
  if (!extension_settings[EXTENSION_NAME]) {
    extension_settings[EXTENSION_NAME] = {
      workshopUrl: DEFAULT_WORKSHOP_URL,
    };
  }

  // 注入设置 UI
  const settingsHtml = `
    <div class="storyshare-workshop-settings">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>StoryShare 创意工坊</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <label for="storyshare_workshop_url">
            <span>工坊网址</span>
          </label>
          <input
            id="storyshare_workshop_url"
            class="text_pole"
            type="text"
            placeholder="https://your-domain.com/StoryShare/"
            value="${extension_settings[EXTENSION_NAME].workshopUrl}"
          />
          <small class="notes">
            部署后填写你的工坊完整 URL（包含 <code>/StoryShare/</code> 路径）
          </small>
          <hr />
          <button id="storyshare_open_workshop" class="menu_button">
            <i class="fa-solid fa-store"></i>
            <span>打开创意工坊</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // 优先注入到 extensions_settings2，回退到 extensions_settings
  const container = $('#extensions_settings2').length
    ? $('#extensions_settings2')
    : $('#extensions_settings');
  container.append(settingsHtml);

  // 绑定事件
  $('#storyshare_workshop_url').on('input', async function () {
    extension_settings[EXTENSION_NAME].workshopUrl = String($(this).val()).trim();
    const ctx = getContext?.() ?? SillyTavern;
    if (ctx && typeof ctx.saveSettingsDebounced === 'function') {
      await ctx.saveSettingsDebounced();
    }
  });

  $('#storyshare_open_workshop').on('click', openWorkshop);

  // 监听 window message 事件
  window.addEventListener('message', handleWorkshopMessage, false);

  console.log('[StoryShare Workshop] 扩展已加载');
});

// ═══════════════════════════════════════════════════════════════════════════
// 打开工坊弹窗
// ═══════════════════════════════════════════════════════════════════════════

function openWorkshop() {
  const url = extension_settings[EXTENSION_NAME].workshopUrl;
  if (!url || url === DEFAULT_WORKSHOP_URL) {
    toastr.warning('请先在扩展设置中配置工坊网址', 'StoryShare 工坊');
    return;
  }

  // 如果已有窗口且未关闭，聚焦它
  if (workshopWindow && !workshopWindow.closed) {
    workshopWindow.focus();
    return;
  }

  // 打开新弹窗（960×700 居中）
  const w = 960;
  const h = 700;
  const left = Math.max(0, (window.screen.width - w) / 2);
  const top = Math.max(0, (window.screen.height - h) / 2);

  workshopWindow = window.open(
    url,
    'StoryShareWorkshop',
    `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no`
  );

  if (!workshopWindow) {
    toastr.error('无法打开工坊窗口，请检查浏览器弹窗拦截设置', 'StoryShare 工坊');
    return;
  }

  // 发送 HTTP ping 命令，通知工坊建立连接
  setTimeout(() => {
    sendHttpCommand('ping', {})
      .then(() => {
        console.log('[StoryShare Workshop] HTTP 连接已建立');
        toastr.success('工坊已连接', 'StoryShare 工坊');
        // ping 成功后启动 w2e 轮询，接收来自工坊的命令
        startW2EPolling();
      })
      .catch(err => {
        console.error('[StoryShare Workshop] HTTP 连接失败:', err);
      });
  }, 2000); // 等待 2 秒让工坊页面加载并启动轮询

  // 保留 postMessage 发送（备用方案，如果同源则可能成功）
  let pingAttempts = 0;
  const pingInterval = setInterval(() => {
    if (workshopWindow.closed) {
      clearInterval(pingInterval);
      return;
    }
    
    try {
      workshopWindow.postMessage({ 
        type: 'st_extension_opener', 
        source: 'storyshare_extension' 
      }, '*');
      pingAttempts++;
      
      // 最多尝试 20 次（10 秒）
      if (pingAttempts >= 20) {
        clearInterval(pingInterval);
      }
    } catch (err) {
      console.error('[StoryShare Workshop] 发送 opener 引用失败:', err);
      clearInterval(pingInterval);
    }
  }, 500);
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP 桥接通信
// ═══════════════════════════════════════════════════════════════════════════

// 从工坊 URL 中提取 API 基础 URL
function getApiBaseUrl() {
  const workshopUrl = extension_settings[EXTENSION_NAME].workshopUrl;
  if (!workshopUrl) return null;
  
  try {
    const url = new URL(workshopUrl);
    return `${url.protocol}//${url.host}`;
  } catch (err) {
    console.error('[StoryShare Workshop] 无法解析工坊 URL:', err);
    return null;
  }
}

// 发送 HTTP 命令到后端桥接
async function sendHttpCommand(type, payload) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error('无法获取 API 基础 URL');
  }

  console.log('[StoryShare Workshop] 发送 HTTP 命令:', type);

  // 1. 发送命令
  const cmdResponse = await fetch(`${baseUrl}/api/st-bridge/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, payload }),
  });

  if (!cmdResponse.ok) {
    throw new Error(`发送命令失败: ${cmdResponse.status}`);
  }

  const cmdData = await cmdResponse.json();
  if (!cmdData.success) {
    throw new Error('发送命令失败');
  }

  const commandId = cmdData.commandId;
  console.log('[StoryShare Workshop] 命令已发送:', commandId);

  // 2. 轮询获取响应（最多 30 秒）
  const startTime = Date.now();
  const timeout = 30000;

  while (Date.now() - startTime < timeout) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // 每秒轮询一次

    const resResponse = await fetch(`${baseUrl}/api/st-bridge/response/${commandId}`);
    if (!resResponse.ok) {
      console.error('[StoryShare Workshop] 获取响应失败:', resResponse.status);
      continue;
    }

    const resData = await resResponse.json();
    if (resData.success && resData.response) {
      console.log('[StoryShare Workshop] 收到响应:', resData.response);
      return resData.response;
    }

    // 还在等待
  }

  throw new Error('等待响应超时（30秒）');
}

// ═══════════════════════════════════════════════════════════════════════════
// w2e 反向通道：轮询工坊发来的命令并执行
// ═══════════════════════════════════════════════════════════════════════════

function startW2EPolling() {
  if (_w2ePolling) {
    console.log('[StoryShare Workshop] w2e 轮询已在运行');
    return;
  }
  _w2ePolling = true;
  _w2eAbortController = new AbortController();
  console.log('[StoryShare Workshop] 启动 w2e 轮询...');

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    console.error('[StoryShare Workshop] 无法启动 w2e 轮询：API 地址未配置');
    _w2ePolling = false;
    return;
  }

  const poll = async () => {
    while (_w2ePolling) {
      try {
        const res = await fetch(`${baseUrl}/api/st-bridge/w2e-poll`, {
          signal: _w2eAbortController.signal,
        });
        if (!res.ok) {
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        const data = await res.json();
        if (data.success && data.command) {
          console.log('[StoryShare Workshop] w2e 收到命令:', data.command.type, data.command.id);
          await handleW2ECommand(data.command, baseUrl);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('[StoryShare Workshop] w2e 轮询已停止');
          break;
        }
        console.error('[StoryShare Workshop] w2e 轮询出错:', err);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  };

  poll();
}

function stopW2EPolling() {
  if (_w2eAbortController) _w2eAbortController.abort();
  _w2ePolling = false;
}

async function handleW2ECommand(command, baseUrl) {
  const { id, type, payload } = command;
  let result;

  try {
    switch (type) {
      case 'scan':
        result = await handleScan(payload);
        break;
      case 'subscribe':
        result = await handleSubscribe(payload);
        break;
      case 'unsubscribe':
        result = await handleUnsubscribe(payload);
        break;
      default:
        console.warn('[StoryShare Workshop] w2e 未知命令:', type);
        result = { success: false, message: '未知命令类型: ' + type };
    }
  } catch (err) {
    console.error('[StoryShare Workshop] w2e 命令执行失败:', err);
    result = { success: false, message: err.message };
  }

  // 把结果提交回后端
  try {
    await fetch(`${baseUrl}/api/st-bridge/w2e-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandId: id, result }),
    });
    console.log('[StoryShare Workshop] w2e 响应已提交:', id);
  } catch (err) {
    console.error('[StoryShare Workshop] w2e 响应提交失败:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// postMessage 通信处理
// ═══════════════════════════════════════════════════════════════════════════

async function handleWorkshopMessage(event) {
  // 安全检查：必须是我们打开的窗口
  if (!workshopWindow || event.source !== workshopWindow) {
    return;
  }

  const { type, payload } = event.data || {};
  if (!type) return;

  console.log('[StoryShare Workshop] 收到消息:', type, payload);

  switch (type) {
    case 'workshop_ping':
      // 握手响应
      console.log('[StoryShare Workshop] 发送 pong 响应');
      workshopWindow.postMessage({ type: 'workshop_pong', connected: true }, '*');
      break;

    case 'workshop_scan':
      await handleScan(payload);
      break;

    case 'workshop_subscribe':
      await handleSubscribe(payload);
      break;

    case 'workshop_unsubscribe':
      await handleUnsubscribe(payload);
      break;

    default:
      console.warn('[StoryShare Workshop] 未知消息类型:', type);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 扫描已订阅的 Pack（修改为同时支持 postMessage 和 HTTP）
// ═══════════════════════════════════════════════════════════════════════════

async function handleScan(payload) {
  const { worldbookName } = payload;
  if (!worldbookName) {
    sendResult('workshop_scan_result', { success: false, packIds: [], entryCountMap: {} });
    return;
  }

  try {
    const ctx = getContext?.() ?? SillyTavern;
    const data = await ctx.loadWorldInfo(worldbookName);
    if (!data || !data.entries) {
      sendResult('workshop_scan_result', { success: true, packIds: [], entryCountMap: {} });
      return;
    }

    const packMap = {}; // { packId: entryCount }
    for (const uid of Object.keys(data.entries)) {
      const entry = data.entries[uid];
      if (entry.extra && entry.extra.source === 'storyshare_workshop' && entry.extra.pack_id != null) {
        const packId = entry.extra.pack_id;
        packMap[packId] = (packMap[packId] || 0) + 1;
      }
    }

    const packIds = Object.keys(packMap).map(Number);
    const result = { success: true, packIds, entryCountMap: packMap };
    
    sendResult('workshop_scan_result', result);
    return result; // 同时返回，以便 HTTP 调用使用
  } catch (err) {
    console.error('[StoryShare Workshop] 扫描失败:', err);
    const result = { success: false, packIds: [], entryCountMap: {} };
    sendResult('workshop_scan_result', result);
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 订阅 Pack（插入世界书）
// ═══════════════════════════════════════════════════════════════════════════

async function handleSubscribe(payload) {
  const { packId, packTitle, worldbookName, entries } = payload;
  if (!packId || !worldbookName || !entries) {
    const result = { success: false, message: '缺少必要参数' };
    sendResult('workshop_subscribe_result', result);
    return result;
  }

  try {
    const ctx = getContext?.() ?? SillyTavern;
    let data = await ctx.loadWorldInfo(worldbookName);
    if (!data || !data.entries) {
      data = { entries: {} };
    }

    // 移除旧条目（幂等）
    for (const uid of Object.keys(data.entries)) {
      const entry = data.entries[uid];
      if (entry.extra && entry.extra.source === 'storyshare_workshop' && entry.extra.pack_id === packId) {
        delete data.entries[uid];
      }
    }

    // 插入新条目
    const existingUids = Object.keys(data.entries).map(Number);
    let nextUid = existingUids.length > 0 ? Math.max(...existingUids) + 1 : 0;

    for (const entry of entries) {
      data.entries[nextUid] = entry;
      nextUid++;
    }

    await ctx.saveWorldInfo(worldbookName, data, true);

    // 刷新编辑器
    if (typeof ctx.reloadWorldInfoEditor === 'function') {
      ctx.reloadWorldInfoEditor(worldbookName);
    }

    const result = {
      success: true,
      message: `已将「${packTitle}」的 ${entries.length} 条条目插入世界书「${worldbookName}」`,
    };
    
    sendResult('workshop_subscribe_result', result);
    toastr.success(`已订阅「${packTitle}」`, 'StoryShare 工坊');
    
    return result;
  } catch (err) {
    console.error('[StoryShare Workshop] 订阅失败:', err);
    const result = { success: false, message: '插入世界书失败：' + err.message };
    sendResult('workshop_subscribe_result', result);
    toastr.error('订阅失败', 'StoryShare 工坊');
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 取消订阅 Pack（移除世界书条目）
// ═══════════════════════════════════════════════════════════════════════════

async function handleUnsubscribe(payload) {
  const { packId, worldbookName } = payload;
  if (packId == null || !worldbookName) {
    const result = { success: false, message: '缺少必要参数', removedCount: 0 };
    sendResult('workshop_unsubscribe_result', result);
    return result;
  }

  try {
    const ctx = getContext?.() ?? SillyTavern;
    const data = await ctx.loadWorldInfo(worldbookName);
    if (!data || !data.entries) {
      const result = { success: true, message: '世界书为空', removedCount: 0 };
      sendResult('workshop_unsubscribe_result', result);
      return result;
    }

    let removedCount = 0;
    for (const uid of Object.keys(data.entries)) {
      const entry = data.entries[uid];
      if (entry.extra && entry.extra.source === 'storyshare_workshop' && entry.extra.pack_id === packId) {
        delete data.entries[uid];
        removedCount++;
      }
    }

    if (removedCount > 0) {
      await ctx.saveWorldInfo(worldbookName, data, true);
      if (typeof ctx.reloadWorldInfoEditor === 'function') {
        ctx.reloadWorldInfoEditor(worldbookName);
      }
    }

    const result = {
      success: true,
      message: `已从世界书移除 ${removedCount} 条条目`,
      removedCount,
    };

    sendResult('workshop_unsubscribe_result', result);
    toastr.success(`已取消订阅`, 'StoryShare 工坊');
    
    return result;
  } catch (err) {
    console.error('[StoryShare Workshop] 取消订阅失败:', err);
    const result = {
      success: false,
      message: '移除世界书条目失败：' + err.message,
      removedCount: 0,
    };
    sendResult('workshop_unsubscribe_result', result);
    toastr.error('取消订阅失败', 'StoryShare 工坊');
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 辅助函数：发送结果回弹窗
// ═══════════════════════════════════════════════════════════════════════════

function sendResult(type, payload) {
  if (workshopWindow && !workshopWindow.closed) {
    workshopWindow.postMessage({ type, ...payload }, '*');
  }
}
