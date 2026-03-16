const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/auth');

// GET /api/creator/status — 返回当前用户的角色与申请状态
router.get('/status', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare(`SELECT role FROM users WHERE id = ?`).get(req.user.id);
    const application = db
      .prepare(`SELECT status, reason, platform, published_works, admin_note, applied_at, reviewed_at FROM creator_applications WHERE user_id = ?`)
      .get(req.user.id);

    res.json({
      role: user?.role || 'user',
      application: application || null,
    });
  } catch (err) {
    console.error('[Creator] 获取状态失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// POST /api/creator/apply — 提交创作者申请
router.post('/apply', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare(`SELECT role FROM users WHERE id = ?`).get(req.user.id);

    if (user?.role === 'creator' || user?.role === 'admin') {
      return res.status(400).json({ error: '你已经是创作者或管理员' });
    }

    // 检查是否已有待审核或已批准的申请
    const existing = db
      .prepare(`SELECT status FROM creator_applications WHERE user_id = ?`)
      .get(req.user.id);

    if (existing?.status === 'pending') {
      return res.status(400).json({ error: '你已有一条待审核的申请，请耐心等待' });
    }

    const { reason, platform, published_works } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({ error: '请填写至少 5 个字的申请理由' });
    }
    if (reason.trim().length > 500) {
      return res.status(400).json({ error: '申请理由不能超过 500 字' });
    }

    const VALID_PLATFORMS = ['类脑', '旅程', '其他平台'];
    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: '请选择有效的发布平台（类脑/旅程/其他平台）' });
    }

    if (!published_works || typeof published_works !== 'string' || published_works.trim().length < 2) {
      return res.status(400).json({ error: '请填写至少一个已发布作品名称或链接' });
    }
    if (published_works.trim().length > 1000) {
      return res.status(400).json({ error: '已发布作品信息不能超过 1000 字' });
    }

    // 已有被拒绝的申请则更新，否则插入
    if (existing) {
      db.prepare(
        `UPDATE creator_applications SET status = 'pending', reason = ?, platform = ?, published_works = ?, admin_note = '', applied_at = CURRENT_TIMESTAMP, reviewed_at = NULL WHERE user_id = ?`
      ).run(reason.trim(), platform, published_works.trim(), req.user.id);
    } else {
      db.prepare(
        `INSERT INTO creator_applications (user_id, reason, platform, published_works) VALUES (?, ?, ?, ?)`
      ).run(req.user.id, reason.trim(), platform, published_works.trim());
    }

    res.json({ ok: true, message: '申请已提交，请等待管理员审核' });
  } catch (err) {
    console.error('[Creator] 提交申请失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
