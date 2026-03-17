/**
 * StoryShare 创意工坊 SillyTavern 扩展
 * 
 * 提供弹窗式创意工坊浏览器，支持直接订阅/退订模组并插入世界书
 */

import { extension_settings, getContext, saveSettingsDebounced } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';

const EXTENSION_NAME = 'storyshare-workshop';
const DEFAULT_WORKSHOP_URL = 'YOUR_DOMAIN_HERE';

let workshopWindow = null;

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
  $('#storyshare_workshop_url').on('input', function () {
    extension_settings[EXTENSION_NAME].workshopUrl = String($(this).val()).trim();
    saveSettingsDebounced();
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
// 扫描已订阅的 Pack
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
    sendResult('workshop_scan_result', { success: true, packIds, entryCountMap: packMap });
  } catch (err) {
    console.error('[StoryShare Workshop] 扫描失败:', err);
    sendResult('workshop_scan_result', { success: false, packIds: [], entryCountMap: {} });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 订阅 Pack（插入世界书）
// ═══════════════════════════════════════════════════════════════════════════

async function handleSubscribe(payload) {
  const { packId, packTitle, worldbookName, entries } = payload;
  if (!packId || !worldbookName || !entries) {
    sendResult('workshop_subscribe_result', { success: false, message: '缺少必要参数' });
    return;
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

    sendResult('workshop_subscribe_result', {
      success: true,
      message: `已将「${packTitle}」的 ${entries.length} 条条目插入世界书「${worldbookName}」`,
    });

    toastr.success(`已订阅「${packTitle}」`, 'StoryShare 工坊');
  } catch (err) {
    console.error('[StoryShare Workshop] 订阅失败:', err);
    sendResult('workshop_subscribe_result', { success: false, message: '插入世界书失败：' + err.message });
    toastr.error('订阅失败', 'StoryShare 工坊');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 取消订阅 Pack（移除世界书条目）
// ═══════════════════════════════════════════════════════════════════════════

async function handleUnsubscribe(payload) {
  const { packId, worldbookName } = payload;
  if (packId == null || !worldbookName) {
    sendResult('workshop_unsubscribe_result', { success: false, message: '缺少必要参数', removedCount: 0 });
    return;
  }

  try {
    const ctx = getContext?.() ?? SillyTavern;
    const data = await ctx.loadWorldInfo(worldbookName);
    if (!data || !data.entries) {
      sendResult('workshop_unsubscribe_result', { success: true, message: '世界书为空', removedCount: 0 });
      return;
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

    sendResult('workshop_unsubscribe_result', {
      success: true,
      message: `已从世界书移除 ${removedCount} 条条目`,
      removedCount,
    });

    toastr.success(`已取消订阅`, 'StoryShare 工坊');
  } catch (err) {
    console.error('[StoryShare Workshop] 取消订阅失败:', err);
    sendResult('workshop_unsubscribe_result', {
      success: false,
      message: '移除世界书条目失败：' + err.message,
      removedCount: 0,
    });
    toastr.error('取消订阅失败', 'StoryShare 工坊');
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
