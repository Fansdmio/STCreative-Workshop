/**
 * SillyTavern 扩展 ↔ 工坊通信桥接
 * 
 * 解决跨域 postMessage 无法工作的问题
 * 使用 HTTP 轮询机制实现双向通信
 */

const express = require('express');
const router = express.Router();

// 内存存储（简单实现，重启后清空）
// 生产环境可以考虑使用 Redis
const pendingCommands = []; // 待工坊处理的命令队列
const pendingResponses = {}; // 待扩展获取的响应 { commandId: response }
let commandIdCounter = 0;

// ═══════════════════════════════════════════════════════════════════════════
// 扩展 → 后端：发送命令
// ═══════════════════════════════════════════════════════════════════════════

router.post('/command', (req, res) => {
  const { type, payload } = req.body;
  
  if (!type) {
    return res.status(400).json({ error: '缺少 type 参数' });
  }

  const commandId = `cmd_${++commandIdCounter}_${Date.now()}`;
  const command = {
    id: commandId,
    type,
    payload,
    timestamp: Date.now(),
  };

  pendingCommands.push(command);
  
  // 30 秒后自动清理未处理的命令
  setTimeout(() => {
    const idx = pendingCommands.findIndex(c => c.id === commandId);
    if (idx !== -1) {
      pendingCommands.splice(idx, 1);
      console.log('[ST Bridge] 命令超时已清理:', commandId);
    }
  }, 30000);

  console.log('[ST Bridge] 扩展发送命令:', type, commandId);
  res.json({ success: true, commandId });
});

// ═══════════════════════════════════════════════════════════════════════════
// 扩展 → 后端：轮询获取响应
// ═══════════════════════════════════════════════════════════════════════════

router.get('/response/:commandId', (req, res) => {
  const { commandId } = req.params;
  const response = pendingResponses[commandId];

  if (response) {
    // 返回响应并清理
    delete pendingResponses[commandId];
    console.log('[ST Bridge] 扩展获取响应:', commandId);
    return res.json({ success: true, response });
  }

  // 还没有响应
  res.json({ success: false, pending: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// 工坊 → 后端：长轮询获取待处理命令
// ═══════════════════════════════════════════════════════════════════════════

router.get('/poll', (req, res) => {
  // 如果有待处理的命令，立即返回
  if (pendingCommands.length > 0) {
    const command = pendingCommands.shift(); // 取出第一个命令
    console.log('[ST Bridge] 工坊获取命令:', command.type, command.id);
    return res.json({ success: true, command });
  }

  // 长轮询：等待最多 25 秒，如果有新命令则立即返回
  const timeout = setTimeout(() => {
    res.json({ success: true, command: null });
  }, 25000);

  // 每 500ms 检查一次是否有新命令
  const checkInterval = setInterval(() => {
    if (pendingCommands.length > 0) {
      clearTimeout(timeout);
      clearInterval(checkInterval);
      const command = pendingCommands.shift();
      console.log('[ST Bridge] 工坊获取命令（轮询中）:', command.type, command.id);
      res.json({ success: true, command });
    }
  }, 500);

  // 请求关闭时清理定时器
  req.on('close', () => {
    clearTimeout(timeout);
    clearInterval(checkInterval);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 工坊 → 后端：提交命令执行结果
// ═══════════════════════════════════════════════════════════════════════════

router.post('/response', (req, res) => {
  const { commandId, result } = req.body;

  if (!commandId) {
    return res.status(400).json({ error: '缺少 commandId 参数' });
  }

  pendingResponses[commandId] = result;
  
  // 60 秒后自动清理未被获取的响应
  setTimeout(() => {
    if (pendingResponses[commandId]) {
      delete pendingResponses[commandId];
      console.log('[ST Bridge] 响应超时已清理:', commandId);
    }
  }, 60000);

  console.log('[ST Bridge] 工坊提交响应:', commandId);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// 健康检查
// ═══════════════════════════════════════════════════════════════════════════

router.get('/ping', (req, res) => {
  res.json({ 
    success: true, 
    pendingCommands: pendingCommands.length,
    pendingResponses: Object.keys(pendingResponses).length,
  });
});

module.exports = router;
