/**
 * SillyTavern 扩展 ↔ 工坊通信桥接
 *
 * 双向 HTTP 轮询通道：
 *   e2w（扩展→工坊）：扩展发命令，工坊轮询执行（用于 ping/scan）
 *   w2e（工坊→扩展）：工坊发命令，扩展轮询执行（用于 subscribe/unsubscribe）
 */

const express = require('express');
const router = express.Router();

// ── e2w 队列（扩展 → 工坊） ────────────────────────────────────────────────
const e2wCommands = [];     // 待工坊处理的命令
const e2wResponses = {};    // 待扩展读取的响应 { commandId: result }
let e2wCounter = 0;

// ── w2e 队列（工坊 → 扩展） ────────────────────────────────────────────────
const w2eCommands = [];     // 待扩展处理的命令
const w2eResponses = {};    // 待工坊读取的响应 { commandId: result }
let w2eCounter = 0;
let lastW2EPollAt = null;   // 扩展最近一次发起 w2e 长轮询的时间戳

// ── 工具：长轮询辅助函数 ──────────────────────────────────────────────────
function longPoll(req, res, queue, label) {
  const origin = req.headers.origin || req.headers.host || '(无 origin)';
  console.log(`[ST Bridge] ${label} 长轮询收到请求，来源: ${origin}，队列长度: ${queue.length}`);

  if (queue.length > 0) {
    const command = queue.shift();
    console.log(`[ST Bridge] ${label} 立即返回命令:`, command.type, command.id);
    return res.json({ success: true, command });
  }

  console.log(`[ST Bridge] ${label} 队列为空，等待 25 秒...`);

  const timeout = setTimeout(() => {
    clearInterval(checkInterval);
    console.log(`[ST Bridge] ${label} 长轮询超时（25s），返回 null`);
    res.json({ success: true, command: null });
  }, 25000);

  const checkInterval = setInterval(() => {
    if (queue.length > 0) {
      clearTimeout(timeout);
      clearInterval(checkInterval);
      const command = queue.shift();
      console.log(`[ST Bridge] ${label} 轮询返回命令:`, command.type, command.id);
      res.json({ success: true, command });
    }
  }, 500);

  req.on('close', () => {
    console.log(`[ST Bridge] ${label} 长轮询连接提前关闭（req close）`);
    clearTimeout(timeout);
    clearInterval(checkInterval);
  });
}

// ── 工具：提交命令到队列 ──────────────────────────────────────────────────
function enqueue(queue, responses, prefix, counter, type, payload) {
  const commandId = `${prefix}_${++counter}_${Date.now()}`;
  const command = { id: commandId, type, payload, timestamp: Date.now() };
  queue.push(command);

  // 30 秒超时清理
  setTimeout(() => {
    const idx = queue.findIndex(c => c.id === commandId);
    if (idx !== -1) {
      queue.splice(idx, 1);
      console.log('[ST Bridge] 命令超时清理:', commandId);
    }
  }, 30000);

  return { commandId, counter };
}

// ════════════════════════════════════════════════════════════════════════════
// e2w 通道：扩展 → 工坊
// ════════════════════════════════════════════════════════════════════════════

// 扩展发送命令
router.post('/command', (req, res) => {
  const { type, payload } = req.body;
  if (!type) return res.status(400).json({ error: '缺少 type 参数' });

  const { commandId } = enqueue(e2wCommands, e2wResponses, 'cmd', e2wCounter++, type, payload);
  console.log('[ST Bridge] 扩展→工坊 命令入队:', type, commandId);
  res.json({ success: true, commandId });
});

// 工坊长轮询获取命令
router.get('/poll', (req, res) => {
  longPoll(req, res, e2wCommands, '工坊');
});

// 工坊提交执行结果
router.post('/response', (req, res) => {
  const { commandId, result } = req.body;
  if (!commandId) return res.status(400).json({ error: '缺少 commandId 参数' });

  e2wResponses[commandId] = result;
  setTimeout(() => { delete e2wResponses[commandId]; }, 60000);
  console.log('[ST Bridge] 工坊提交 e2w 响应:', commandId);
  res.json({ success: true });
});

// 扩展轮询获取响应
router.get('/response/:commandId', (req, res) => {
  const { commandId } = req.params;
  const response = e2wResponses[commandId];
  if (response) {
    delete e2wResponses[commandId];
    console.log('[ST Bridge] 扩展读取 e2w 响应:', commandId);
    return res.json({ success: true, response });
  }
  res.json({ success: false, pending: true });
});

// ════════════════════════════════════════════════════════════════════════════
// w2e 通道：工坊 → 扩展
// ════════════════════════════════════════════════════════════════════════════

// 工坊发送命令
router.post('/w2e-command', (req, res) => {
  const { type, payload } = req.body;
  if (!type) return res.status(400).json({ error: '缺少 type 参数' });

  const { commandId } = enqueue(w2eCommands, w2eResponses, 'w2e', w2eCounter++, type, payload);
  console.log('[ST Bridge] 工坊→扩展 命令入队:', type, commandId);
  res.json({ success: true, commandId });
});

// 扩展长轮询获取命令
router.get('/w2e-poll', (req, res) => {
  lastW2EPollAt = Date.now(); // 记录扩展存活时间
  longPoll(req, res, w2eCommands, '扩展');
});

// 扩展提交执行结果
router.post('/w2e-response', (req, res) => {
  const { commandId, result } = req.body;
  if (!commandId) return res.status(400).json({ error: '缺少 commandId 参数' });

  w2eResponses[commandId] = result;
  setTimeout(() => { delete w2eResponses[commandId]; }, 60000);
  console.log('[ST Bridge] 扩展提交 w2e 响应:', commandId);
  res.json({ success: true });
});

// 工坊轮询获取结果
router.get('/w2e-response/:commandId', (req, res) => {
  const { commandId } = req.params;
  const response = w2eResponses[commandId];
  if (response) {
    delete w2eResponses[commandId];
    console.log('[ST Bridge] 工坊读取 w2e 响应:', commandId);
    return res.json({ success: true, response });
  }
  res.json({ success: false, pending: true });
});

// ════════════════════════════════════════════════════════════════════════════
// 健康检查
// ════════════════════════════════════════════════════════════════════════════

router.get('/ping', (req, res) => {
  res.json({
    success: true,
    e2w: { pendingCommands: e2wCommands.length, pendingResponses: Object.keys(e2wResponses).length },
    w2e: { pendingCommands: w2eCommands.length, pendingResponses: Object.keys(w2eResponses).length },
    lastW2EPollAt,  // 扩展最近一次 w2e 轮询时间（null 表示本次服务器启动后从未轮询）
  });
});

module.exports = router;
