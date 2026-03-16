const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');

// ── 管理员凭据（硬编码） ─────────────────────────────────────────────
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'signleadmin';

// ── 管理员鉴权中间件 ──────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: '未授权，请先登录管理后台' });
}

// ── POST /admin/login ─────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: '用户名或密码错误' });
});

// ── POST /admin/logout ────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ ok: true });
});

// ── GET /admin/me ─────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.json({ ok: true, username: ADMIN_USERNAME });
  }
  res.status(401).json({ error: '未登录' });
});

// ── 以下路由全部需要管理员登录 ────────────────────────────────────────

// GET /admin/applications — 申请列表，支持 ?status=pending|approved|rejected|all
router.get('/applications', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const status = req.query.status || 'pending';
    let rows;
    if (status === 'all') {
      rows = db.prepare(`
        SELECT ca.*, u.username, u.discord_id, u.avatar, u.role
        FROM creator_applications ca
        JOIN users u ON u.id = ca.user_id
        ORDER BY ca.applied_at DESC
      `).all();
    } else {
      rows = db.prepare(`
        SELECT ca.*, u.username, u.discord_id, u.avatar, u.role
        FROM creator_applications ca
        JOIN users u ON u.id = ca.user_id
        WHERE ca.status = ?
        ORDER BY ca.applied_at DESC
      `).all(status);
    }

    const data = rows.map(r => ({
      id: r.id,
      user_id: r.user_id,
      status: r.status,
      reason: r.reason,
      platform: r.platform || '',
      published_works: r.published_works || '',
      admin_note: r.admin_note,
      applied_at: r.applied_at,
      reviewed_at: r.reviewed_at,
      user: {
        id: r.user_id,
        username: r.username,
        discord_id: r.discord_id,
        avatar: r.avatar,
        role: r.role,
      },
    }));
    res.json({ data });
  } catch (err) {
    console.error('[Admin] 获取申请列表失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// PUT /admin/applications/:id — 审批申请 { action: 'approve'|'reject', note? }
router.put('/applications/:id', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { action, note } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action 必须是 approve 或 reject' });
    }

    const app = db.prepare(`SELECT * FROM creator_applications WHERE id = ?`).get(req.params.id);
    if (!app) return res.status(404).json({ error: '申请不存在' });

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const updateApp = db.prepare(`
      UPDATE creator_applications SET status = ?, admin_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    const updateRole = db.prepare(`UPDATE users SET role = ? WHERE id = ?`);

    db.transaction(() => {
      updateApp.run(newStatus, note || '', app.id);
      if (action === 'approve') {
        updateRole.run('creator', app.user_id);
      } else {
        // 拒绝时不降级已是创作者的用户
        const user = db.prepare(`SELECT role FROM users WHERE id = ?`).get(app.user_id);
        if (user?.role === 'user') {
          // 保持 user，无需额外操作
        }
      }
    })();

    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] 审批申请失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /admin/users — 用户列表，支持分页 ?page=1&limit=20&q=
router.get('/users', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const q = req.query.q ? `%${req.query.q}%` : null;

    let rows, total;
    if (q) {
      total = db.prepare(`SELECT COUNT(*) as c FROM users WHERE username LIKE ?`).get(q).c;
      rows = db.prepare(`SELECT * FROM users WHERE username LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(q, limit, offset);
    } else {
      total = db.prepare(`SELECT COUNT(*) as c FROM users`).get().c;
      rows = db.prepare(`SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
    }

    const data = rows.map(u => ({
      id: u.id,
      discord_id: u.discord_id,
      username: u.username,
      avatar: u.avatar,
      role: u.role || 'user',
      created_at: u.created_at,
    }));

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[Admin] 获取用户列表失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// PUT /admin/users/:id/role — 修改用户角色 { role: 'user'|'creator'|'admin' }
router.put('/users/:id/role', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { role } = req.body;
    if (!['user', 'creator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'role 必须是 user、creator 或 admin' });
    }
    const info = db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: '用户不存在' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] 修改角色失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// DELETE /admin/users/:id — 删除用户（级联删除所有内容）
router.delete('/users/:id', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const info = db.prepare(`DELETE FROM users WHERE id = ?`).run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: '用户不存在' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] 删除用户失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /admin/users/:id/detail — 用户详情（工坊列表 + 条目总数）
router.get('/users/:id/detail', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare(`SELECT id, discord_id, username, avatar, role, created_at FROM users WHERE id = ?`).get(req.params.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    function avatarUrl(discordId, avatar) {
      if (avatar) return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png`;
      return `https://cdn.discordapp.com/embed/avatars/${parseInt(discordId) % 5}.png`;
    }

    // 该用户创建的工坊（packs）
    const packs = db.prepare(`
      SELECT p.id, p.title, p.section, p.like_count, p.sub_count, p.created_at,
             w.name AS workshop_name,
             (SELECT COUNT(*) FROM workshop_entries e WHERE e.pack_id = p.id) AS entry_count
      FROM workshop_packs p
      LEFT JOIN workshops w ON p.workshop_id = w.id
      WHERE p.author_id = ?
      ORDER BY p.created_at DESC
    `).all(req.params.id);

    // 该用户上传的条目总数
    const entryCount = db.prepare(`SELECT COUNT(*) as c FROM workshop_entries WHERE author_id = ?`).get(req.params.id)?.c || 0;

    res.json({
      data: {
        user: {
          id: user.id,
          username: user.username,
          discord_id: user.discord_id,
          avatar: avatarUrl(user.discord_id, user.avatar),
          role: user.role || 'user',
          created_at: user.created_at,
        },
        packs,
        entry_count: entryCount,
      },
    });
  } catch (err) {
    console.error('[Admin] 获取用户详情失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /admin/packs — 全部模组列表，支持分页 ?page=1&limit=20&q=
router.get('/packs', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const q = req.query.q ? `%${req.query.q}%` : null;

    let rows, total;
    if (q) {
      total = db.prepare(`SELECT COUNT(*) as c FROM workshop_packs WHERE title LIKE ?`).get(q).c;
      rows = db.prepare(`
        SELECT wp.*, u.username, u.discord_id, u.avatar,
               w.name AS workshop_name,
               (SELECT COUNT(*) FROM workshop_entries WHERE pack_id = wp.id) as entry_count
        FROM workshop_packs wp JOIN users u ON u.id = wp.author_id
        LEFT JOIN workshops w ON wp.workshop_id = w.id
        WHERE wp.title LIKE ?
        ORDER BY wp.created_at DESC LIMIT ? OFFSET ?
      `).all(q, limit, offset);
    } else {
      total = db.prepare(`SELECT COUNT(*) as c FROM workshop_packs`).get().c;
      rows = db.prepare(`
        SELECT wp.*, u.username, u.discord_id, u.avatar,
               w.name AS workshop_name,
               (SELECT COUNT(*) FROM workshop_entries WHERE pack_id = wp.id) as entry_count
        FROM workshop_packs wp JOIN users u ON u.id = wp.author_id
        LEFT JOIN workshops w ON wp.workshop_id = w.id
        ORDER BY wp.created_at DESC LIMIT ? OFFSET ?
      `).all(limit, offset);
    }

    function avatarUrl(discordId, avatar) {
      if (avatar) return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png`;
      return `https://cdn.discordapp.com/embed/avatars/${parseInt(discordId) % 5}.png`;
    }

    const data = rows.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      section: p.section || 'steampunk',
      workshop_name: p.workshop_name || p.section || 'steampunk',
      like_count: p.like_count,
      sub_count: p.sub_count,
      entry_count: p.entry_count || 0,
      created_at: p.created_at,
      author: {
        id: p.author_id,
        username: p.username,
        avatar: avatarUrl(p.discord_id, p.avatar),
      },
    }));

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[Admin] 获取模组列表失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// DELETE /admin/packs/:id — 删除任意模组
router.delete('/packs/:id', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const info = db.prepare(`DELETE FROM workshop_packs WHERE id = ?`).run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: '模组不存在' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] 删除模组失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
