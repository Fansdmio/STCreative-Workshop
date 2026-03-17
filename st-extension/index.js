/**
 * ST创意工坊 SillyTavern 扩展
 *
 * 在 SillyTavern 内嵌 iframe 加载创意工坊，通过 postMessage 双向通信
 * 使用 iframe 而非 popup 以避免跨域 COOP（Cross-Origin-Opener-Policy）限制
 */

import { getContext } from '../../../extensions.js';

// ← 部署后将此处替换为你的工坊完整 URL（包含 /StoryShare/ 路径）
const WORKSHOP_URL = 'http://localhost:5173/';

let workshopOverlay = null;
let workshopIframe = null;
let workshopWindow = null; // iframe.contentWindow
let handshakeInterval = null;

// ═══════════════════════════════════════════════════════════════════════════
// 扩展初始化
// ═══════════════════════════════════════════════════════════════════════════

jQuery(async () => {
  // 注入设置 UI（仅一个按钮，无需用户配置）
  const settingsHtml = `
    <div class="st-workshop-settings">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>ST创意工坊</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <button id="st_open_workshop" class="menu_button">
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

  // 绑定打开按钮
  $('#st_open_workshop').on('click', openWorkshop);

  // 监听 window message 事件（接收来自 iframe 的消息）
  window.addEventListener('message', handleWorkshopMessage, false);

  console.log('[ST创意工坊] 扩展已加载');
});

// ═══════════════════════════════════════════════════════════════════════════
// 打开工坊（iframe 覆盖层）
// ═══════════════════════════════════════════════════════════════════════════

function openWorkshop() {
  // 如果覆盖层已存在，直接显示
  if (workshopOverlay) {
    workshopOverlay.style.display = 'flex';
    return;
  }

  // 创建覆盖层
  workshopOverlay = document.createElement('div');
  workshopOverlay.id = 'st-workshop-overlay';
  workshopOverlay.innerHTML = `
    <div id="st-workshop-modal">
      <div id="st-workshop-header">
        <span class="st-workshop-title">ST创意工坊</span>
        <button id="st-workshop-close" title="关闭">&times;</button>
      </div>
      <iframe id="st-workshop-iframe" src="${WORKSHOP_URL}" allow="clipboard-write"></iframe>
    </div>
  `;
  document.body.appendChild(workshopOverlay);

  workshopIframe = document.getElementById('st-workshop-iframe');

  // 点击关闭按钮隐藏
  document.getElementById('st-workshop-close').addEventListener('click', closeWorkshop);

  // 点击遮罩层（背景）隐藏
  workshopOverlay.addEventListener('click', (e) => {
    if (e.target === workshopOverlay) closeWorkshop();
  });

  // iframe 加载完成后开始握手
  workshopIframe.addEventListener('load', () => {
    workshopWindow = workshopIframe.contentWindow;
    console.log('[ST创意工坊] iframe 已加载，开始握手...');
    startHandshake();
  });
}

function closeWorkshop() {
  if (workshopOverlay) {
    workshopOverlay.style.display = 'none';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// postMessage 握手（持续发送 opener 引用直到工坊回应）
// ═══════════════════════════════════════════════════════════════════════════

function startHandshake() {
  // 清除之前的握手定时器
  if (handshakeInterval) clearInterval(handshakeInterval);

  let attempts = 0;
  handshakeInterval = setInterval(() => {
    if (!workshopWindow) {
      clearInterval(handshakeInterval);
      handshakeInterval = null;
      return;
    }
    try {
      workshopWindow.postMessage({
        type: 'st_extension_opener',
        source: 'st_workshop_extension',
      }, '*');
      attempts++;
      if (attempts >= 40) { // 最多 20 秒
        console.warn('[ST创意工坊] 握手超时（20 秒），停止重试');
        clearInterval(handshakeInterval);
        handshakeInterval = null;
      }
    } catch (err) {
      console.error('[ST创意工坊] 发送 opener 引用失败:', err);
      clearInterval(handshakeInterval);
      handshakeInterval = null;
    }
  }, 500);
}

// ═══════════════════════════════════════════════════════════════════════════
// postMessage 通信处理
// ═══════════════════════════════════════════════════════════════════════════

async function handleWorkshopMessage(event) {
  // 安全检查：必须来自我们的 iframe
  if (!workshopWindow || event.source !== workshopWindow) return;

  const { type, payload } = event.data || {};
  if (!type) return;

  console.log('[ST创意工坊] 收到消息:', type, payload);

  switch (type) {
    case 'workshop_ping':
      // 工坊已就绪，回应 pong 完成握手
      console.log('[ST创意工坊] 握手完成，发送 pong');
      // 停止重复发送 opener
      if (handshakeInterval) {
        clearInterval(handshakeInterval);
        handshakeInterval = null;
      }
      workshopWindow.postMessage({ type: 'workshop_pong', connected: true }, '*');
      toastr.success('工坊已连接', 'ST创意工坊');
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
      console.warn('[ST创意工坊] 未知消息类型:', type);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 扫描已订阅的 Pack（使用 window.TavernHelper API）
// ═══════════════════════════════════════════════════════════════════════════

async function handleScan(payload) {
  const { worldbookName } = payload;
  if (!worldbookName) {
    sendResult('workshop_scan_result', { success: false, packIds: [], entryCountMap: {} });
    return;
  }

  try {
    const TH = window.TavernHelper;
    if (!TH) throw new Error('TavernHelper 不可用');

    const names = TH.getWorldbookNames();
    if (!names.includes(worldbookName)) {
      const result = { success: true, packIds: [], entryCountMap: {} };
      sendResult('workshop_scan_result', result);
      return result;
    }

    const entries = await TH.getWorldbook(worldbookName);
    const packMap = {}; // { packId: entryCount }
    for (const entry of entries) {
      if (entry.extra && entry.extra.source === 'storyshare_workshop' && entry.extra.pack_id != null) {
        const packId = entry.extra.pack_id;
        packMap[packId] = (packMap[packId] || 0) + 1;
      }
    }

    const packIds = Object.keys(packMap).map(Number);
    const result = { success: true, packIds, entryCountMap: packMap };
    sendResult('workshop_scan_result', result);
    return result;
  } catch (err) {
    console.error('[ST创意工坊] 扫描失败:', err);
    const result = { success: false, packIds: [], entryCountMap: {} };
    sendResult('workshop_scan_result', result);
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 订阅 Pack（插入世界书，使用 window.TavernHelper API）
// ═══════════════════════════════════════════════════════════════════════════

async function handleSubscribe(payload) {
  const { packId, packTitle, worldbookName, entries } = payload;
  if (!packId || !worldbookName || !entries) {
    const result = { success: false, message: '缺少必要参数' };
    sendResult('workshop_subscribe_result', result);
    return result;
  }

  try {
    const TH = window.TavernHelper;
    if (!TH) throw new Error('TavernHelper 不可用');

    // 确保世界书存在（不存在则创建）
    const names = TH.getWorldbookNames();
    if (!names.includes(worldbookName)) {
      await TH.createWorldbook(worldbookName);
    }

    // 移除此 pack 的旧条目（幂等）
    await TH.deleteWorldbookEntries(
      worldbookName,
      entry => entry.extra && entry.extra.source === 'storyshare_workshop' && entry.extra.pack_id === packId,
      { render: 'debounced' }
    );

    // 插入新条目
    await TH.createWorldbookEntries(worldbookName, entries, { render: 'immediate' });

    const result = {
      success: true,
      message: `已将「${packTitle}」的 ${entries.length} 条条目插入世界书「${worldbookName}」`,
    };
    sendResult('workshop_subscribe_result', result);
    toastr.success(`已订阅「${packTitle}」`, 'ST创意工坊');
    return result;
  } catch (err) {
    console.error('[ST创意工坊] 订阅失败:', err);
    const result = { success: false, message: '插入世界书失败：' + err.message };
    sendResult('workshop_subscribe_result', result);
    toastr.error('订阅失败', 'ST创意工坊');
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 取消订阅 Pack（移除世界书条目，使用 window.TavernHelper API）
// ═══════════════════════════════════════════════════════════════════════════

async function handleUnsubscribe(payload) {
  const { packId, worldbookName } = payload;
  if (packId == null || !worldbookName) {
    const result = { success: false, message: '缺少必要参数', removedCount: 0 };
    sendResult('workshop_unsubscribe_result', result);
    return result;
  }

  try {
    const TH = window.TavernHelper;
    if (!TH) throw new Error('TavernHelper 不可用');

    const names = TH.getWorldbookNames();
    if (!names.includes(worldbookName)) {
      const result = { success: true, message: '世界书不存在', removedCount: 0 };
      sendResult('workshop_unsubscribe_result', result);
      return result;
    }

    const { deleted_entries } = await TH.deleteWorldbookEntries(
      worldbookName,
      entry => entry.extra && entry.extra.source === 'storyshare_workshop' && entry.extra.pack_id === packId,
      { render: 'immediate' }
    );
    const removedCount = deleted_entries.length;

    const result = {
      success: true,
      message: `已从世界书移除 ${removedCount} 条条目`,
      removedCount,
    };
    sendResult('workshop_unsubscribe_result', result);
    toastr.success('已取消订阅', 'ST创意工坊');
    return result;
  } catch (err) {
    console.error('[ST创意工坊] 取消订阅失败:', err);
    const result = {
      success: false,
      message: '移除世界书条目失败：' + err.message,
      removedCount: 0,
    };
    sendResult('workshop_unsubscribe_result', result);
    toastr.error('取消订阅失败', 'ST创意工坊');
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 辅助函数：发送结果回 iframe
// ═══════════════════════════════════════════════════════════════════════════

function sendResult(type, payload) {
  if (workshopWindow) {
    workshopWindow.postMessage({ type, ...payload }, '*');
  }
}
