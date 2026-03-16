const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/auth');

// ── 辅助函数 ────────────────────────────────────────────────────────

// 格式化用户头像 URL
function avatarUrl(discordId, avatar) {
  if (avatar) return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png`;
  return `https://cdn.discordapp.com/embed/avatars/${parseInt(discordId) % 5}.png`;
}

// 将数据库行格式化为 workshop API 响应
function formatWorkshop(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    worldbook: row.worldbook || '',
    author_id: row.author_id || null,
    status: row.status || 'active',
    created_at: row.created_at,
  };
}

// 将数据库行格式化为 pack API 响应
function formatPack(row, isLiked = false, isSubscribed = false) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    section: row.section || 'steampunk',
    tags: JSON.parse(row.tags || '[]'),
    worldbook: row.worldbook || '',
    like_count: row.like_count,
    sub_count: row.sub_count,
    entry_count: row.entry_count || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_liked: isLiked,
    is_subscribed: isSubscribed,
    author: {
      id: row.author_id,
      username: row.username,
      avatar: avatarUrl(row.discord_id, row.avatar),
    },
    workshop: row.w_id ? { id: row.w_id, slug: row.w_slug, name: row.w_name } : null,
  };
}

// 将数据库行格式化为 entry API 响应
function formatEntry(row) {
  return {
    id: row.id,
    pack_id: row.pack_id,
    author_id: row.author_id,    // 条目作者（用于前端判断编辑权限）
    name: row.name,
    enabled: !!row.enabled,
    content: row.content,
    strategy_type: row.strategy_type,
    keys: JSON.parse(row.keys || '[]'),
    keys_secondary_logic: row.keys_secondary_logic,
    keys_secondary: JSON.parse(row.keys_secondary || '[]'),
    scan_depth: row.scan_depth,
    position_type: row.position_type,
    position_order: row.position_order,
    position_depth: row.position_depth,
    position_role: row.position_role,
    probability: row.probability,
    recursion_prevent_incoming: !!row.recursion_prevent_incoming,
    recursion_prevent_outgoing: !!row.recursion_prevent_outgoing,
    recursion_delay_until: row.recursion_delay_until || null,
    effect_sticky: row.effect_sticky || null,
    effect_cooldown: row.effect_cooldown || null,
    effect_delay: row.effect_delay || null,
    created_at: row.created_at,
  };
}

// 枚举校验常量
const VALID_STRATEGY_TYPES = ['constant', 'selective'];
const VALID_POSITION_TYPES = [
  'before_character_definition', 'after_character_definition',
  'before_example_messages', 'after_example_messages',
  'before_author_note', 'after_author_note', 'at_depth',
];
const VALID_LOGICS = ['and_any', 'not_all', 'not_any', 'and_all'];
const VALID_ROLES = ['system', 'user', 'assistant'];

// ── Workshop 路由 ────────────────────────────────────────────────────

// GET /api/workshop/workshops — 公开获取所有工坊列表
router.get('/workshops', (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare(`SELECT * FROM workshops WHERE status = 'active' ORDER BY id ASC`).all();
    res.json({ data: rows.map(formatWorkshop) });
  } catch (err) {
    console.error('[Workshop] 获取工坊列表失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// POST /api/workshop/workshops — 创建工坊（仅创作者或管理员）
router.post('/workshops', requireAuth, (req, res) => {
  const db = getDb();
  const userRow = db.prepare(`SELECT role FROM users WHERE id = ?`).get(req.user.id);
  if (!userRow || (userRow.role !== 'creator' && userRow.role !== 'admin')) {
    return res.status(403).json({ error: '只有创作者或管理员才能创建工坊' });
  }

  const { name, description, worldbook } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: '工坊名称不能为空' });
  if (String(name).trim().length > 50) return res.status(400).json({ error: '工坊名称不能超过 50 字' });

  // 自动生成 slug：去除非字母数字汉字字符 + 追加时间戳保证唯一
  const base = String(name).trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_');
  const slug = `${base}_${Date.now()}`;

  try {
    // 管理员直接激活，创作者需等待审批
    const status = (userRow.role === 'admin') ? 'active' : 'pending';
    const info = db.prepare(`
      INSERT INTO workshops (name, slug, description, worldbook, author_id, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      String(name).trim(),
      slug,
      String(description || '').trim(),
      String(worldbook || '').trim(),
      req.user.id,
      status
    );
    const created = db.prepare(`SELECT * FROM workshops WHERE id = ?`).get(info.lastInsertRowid);
    const msg = status === 'pending' ? '工坊申请已提交，等待管理员审批' : '工坊创建成功';
    res.status(201).json({ data: formatWorkshop(created), message: msg });
  } catch (err) {
    console.error('[Workshop] 创建工坊失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// PUT /api/workshop/workshops/:id — 编辑工坊（作者或管理员；内置工坊不可编辑）
router.put('/workshops/:id', requireAuth, (req, res) => {
  const db = getDb();
  const wid = parseInt(req.params.id);
  if (isNaN(wid)) return res.status(400).json({ error: '无效的工坊 ID' });

  const existing = db.prepare(`SELECT * FROM workshops WHERE id = ?`).get(wid);
  if (!existing) return res.status(404).json({ error: '工坊不存在' });
  if (existing.author_id === null) return res.status(403).json({ error: '内置工坊不可编辑' });

  const userRow = db.prepare(`SELECT role FROM users WHERE id = ?`).get(req.user.id);
  const isAdmin = userRow && userRow.role === 'admin';
  if (!isAdmin && existing.author_id !== req.user.id) {
    return res.status(403).json({ error: '无权编辑此工坊' });
  }

  const { name, description, worldbook } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: '工坊名称不能为空' });
  if (String(name).trim().length > 50) return res.status(400).json({ error: '工坊名称不能超过 50 字' });

  try {
    db.prepare(`UPDATE workshops SET name = ?, description = ?, worldbook = ? WHERE id = ?`)
      .run(String(name).trim(), String(description || '').trim(), String(worldbook || '').trim(), wid);
    const updated = db.prepare(`SELECT * FROM workshops WHERE id = ?`).get(wid);
    res.json({ data: formatWorkshop(updated), message: '工坊更新成功' });
  } catch (err) {
    console.error('[Workshop] 更新工坊失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// DELETE /api/workshop/workshops/:id — 删除工坊（作者或管理员；内置工坊不可删除）
router.delete('/workshops/:id', requireAuth, (req, res) => {
  const db = getDb();
  const wid = parseInt(req.params.id);
  if (isNaN(wid)) return res.status(400).json({ error: '无效的工坊 ID' });

  const existing = db.prepare(`SELECT * FROM workshops WHERE id = ?`).get(wid);
  if (!existing) return res.status(404).json({ error: '工坊不存在' });
  if (existing.author_id === null) return res.status(403).json({ error: '内置工坊不可删除' });

  const userRow = db.prepare(`SELECT role FROM users WHERE id = ?`).get(req.user.id);
  const isAdmin = userRow && userRow.role === 'admin';
  if (!isAdmin && existing.author_id !== req.user.id) {
    return res.status(403).json({ error: '无权删除此工坊' });
  }

  try {
    db.prepare(`DELETE FROM workshops WHERE id = ?`).run(wid);
    res.json({ success: true, message: '工坊已删除' });
  } catch (err) {
    console.error('[Workshop] 删除工坊失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ── Pack 路由 ────────────────────────────────────────────────────────

// GET /api/workshop — 获取 pack 列表，按热度排序（like_count + sub_count）
router.get('/', (req, res) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const userId = req.user ? req.user.id : null;

  // 过滤参数：workshop slug（新），兼容旧 section
  const workshopSlug = req.query.workshop || req.query.section || null;
  const search = req.query.q ? String(req.query.q).trim() : null;
  const tag = req.query.tag ? String(req.query.tag).trim() : null;
  const authorId = req.query.author_id ? parseInt(req.query.author_id) : null;

  // 动态构建 WHERE 子句
  const whereClauses = [];
  const params = [];

  if (workshopSlug) {
    whereClauses.push(`w.slug = ?`);
    params.push(workshopSlug);
  }
  if (search) {
    // 仅按模组名称（标题）搜索
    whereClauses.push(`p.title LIKE '%' || ? || '%'`);
    params.push(search);
  }
  if (tag) {
    whereClauses.push(`EXISTS (SELECT 1 FROM json_each(p.tags) WHERE value = ?)`);
    params.push(tag);
  }
  if (authorId && !isNaN(authorId)) {
    whereClauses.push(`p.author_id = ?`);
    params.push(authorId);
  }

  const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM workshop_packs p
    LEFT JOIN workshops w ON p.workshop_id = w.id
    ${whereSQL}
  `).get(...params)?.count || 0;

  const rows = db.prepare(`
    SELECT p.*,
           u.username, u.avatar, u.discord_id,
           (SELECT COUNT(*) FROM workshop_entries e WHERE e.pack_id = p.id) AS entry_count,
           w.id as w_id, w.slug as w_slug, w.name as w_name
    FROM workshop_packs p
    JOIN users u ON p.author_id = u.id
    LEFT JOIN workshops w ON p.workshop_id = w.id
    ${whereSQL}
    ORDER BY (p.like_count + p.sub_count) DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // 批量查询当前用户的点赞/订阅状态
  let likedSet = new Set();
  let subbedSet = new Set();
  if (userId) {
    const packIds = rows.map((r) => r.id);
    if (packIds.length > 0) {
      const placeholders = packIds.map(() => '?').join(',');
      db.prepare(`SELECT pack_id FROM workshop_likes WHERE user_id = ? AND pack_id IN (${placeholders})`)
        .all(userId, ...packIds)
        .forEach((r) => likedSet.add(r.pack_id));
      db.prepare(`SELECT pack_id FROM workshop_subscriptions WHERE user_id = ? AND pack_id IN (${placeholders})`)
        .all(userId, ...packIds)
        .forEach((r) => subbedSet.add(r.pack_id));
    }
  }

  const data = rows.map((row) => formatPack(row, likedSet.has(row.id), subbedSet.has(row.id)));

  res.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /api/workshop/packs/:packId — 获取单个 pack 详情（含条目列表）
router.get('/packs/:packId', (req, res) => {
  const db = getDb();
  const packId = parseInt(req.params.packId);
  if (isNaN(packId)) return res.status(400).json({ error: '无效的模组 ID' });
  const userId = req.user ? req.user.id : null;

  const row = db.prepare(`
    SELECT p.*,
           u.username, u.avatar, u.discord_id,
           (SELECT COUNT(*) FROM workshop_entries e WHERE e.pack_id = p.id) AS entry_count,
           w.id as w_id, w.slug as w_slug, w.name as w_name
    FROM workshop_packs p
    JOIN users u ON p.author_id = u.id
    LEFT JOIN workshops w ON p.workshop_id = w.id
    WHERE p.id = ?
  `).get(packId);

  if (!row) return res.status(404).json({ error: '模组不存在' });

  let isLiked = false;
  let isSubscribed = false;
  if (userId) {
    isLiked = !!db.prepare(`SELECT 1 FROM workshop_likes WHERE user_id = ? AND pack_id = ?`).get(userId, packId);
    isSubscribed = !!db.prepare(`SELECT 1 FROM workshop_subscriptions WHERE user_id = ? AND pack_id = ?`).get(userId, packId);
  }

  const entries = db.prepare(`
    SELECT * FROM workshop_entries WHERE pack_id = ? ORDER BY position_order ASC, id ASC
  `).all(packId);

  res.json({
    data: {
      ...formatPack(row, isLiked, isSubscribed),
      entries: entries.map(formatEntry),
    },
  });
});

// POST /api/workshop/packs — 创建新 pack（任意登录用户均可创建）
router.post('/packs', requireAuth, (req, res) => {
  const db = getDb();

  const { title, description, workshop_id, tags, worldbook } = req.body;

  if (!title || !String(title).trim()) return res.status(400).json({ error: '模组标题不能为空' });
  if (String(title).trim().length > 200) return res.status(400).json({ error: '模组标题不能超过 200 字' });

  // 校验 workshop_id（可选；若传了则必须存在）
  let sectionVal = 'steampunk';
  let workshopIdVal = null;
  if (workshop_id != null) {
    const wid = parseInt(workshop_id);
    if (isNaN(wid)) return res.status(400).json({ error: '无效的工坊 ID' });
    const workshopRow = db.prepare(`SELECT id, slug FROM workshops WHERE id = ?`).get(wid);
    if (!workshopRow) return res.status(400).json({ error: '指定的工坊不存在' });
    workshopIdVal = workshopRow.id;
    sectionVal = workshopRow.slug;
  }

  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags.map(String).filter(Boolean) : []);
  const worldbookVal = String(worldbook || '').trim();

  try {
    const info = db.prepare(`
      INSERT INTO workshop_packs (author_id, title, description, section, tags, worldbook, workshop_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, String(title).trim(), String(description || '').trim(), sectionVal, tagsJson, worldbookVal, workshopIdVal);

    res.status(201).json({ data: { id: info.lastInsertRowid }, message: '模组创建成功' });
  } catch (err) {
    console.error('[Workshop] 创建 Pack 失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// PUT /api/workshop/packs/:packId — 编辑 pack 元数据（仅作者）
router.put('/packs/:packId', requireAuth, (req, res) => {
  const db = getDb();
  const packId = parseInt(req.params.packId);
  if (isNaN(packId)) return res.status(400).json({ error: '无效的模组 ID' });

  const existing = db.prepare(`SELECT author_id FROM workshop_packs WHERE id = ?`).get(packId);
  if (!existing) return res.status(404).json({ error: '模组不存在' });
  if (existing.author_id !== req.user.id) return res.status(403).json({ error: '无权编辑此模组' });

  const { title, description, tags, worldbook, workshop_id } = req.body;
  if (!title || !String(title).trim()) return res.status(400).json({ error: '模组标题不能为空' });

  const tagsJson = Array.isArray(tags)
    ? JSON.stringify(tags.map(String).filter(Boolean))
    : null;
  const worldbookVal = worldbook !== undefined ? String(worldbook).trim() : null;

  // 校验并解析 workshop_id（可选）
  let newWorkshopId = undefined; // undefined 表示不更新
  let newSection = undefined;
  if (workshop_id !== undefined && workshop_id !== null) {
    const wid = parseInt(workshop_id);
    if (isNaN(wid)) return res.status(400).json({ error: '无效的工坊 ID' });
    const workshopRow = db.prepare(`SELECT id, slug FROM workshops WHERE id = ?`).get(wid);
    if (!workshopRow) return res.status(400).json({ error: '指定的工坊不存在' });
    newWorkshopId = workshopRow.id;
    newSection = workshopRow.slug;
  }

  try {
    // 动态构建 SET 子句
    const setClauses = ['title = ?', 'description = ?'];
    const runParams = [String(title).trim(), String(description || '').trim()];
    if (tagsJson !== null) { setClauses.push('tags = ?'); runParams.push(tagsJson); }
    if (worldbookVal !== null) { setClauses.push('worldbook = ?'); runParams.push(worldbookVal); }
    if (newWorkshopId !== undefined) {
      setClauses.push('workshop_id = ?');
      runParams.push(newWorkshopId);
      setClauses.push('section = ?');
      runParams.push(newSection);
    }
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    runParams.push(packId);

    db.prepare(`UPDATE workshop_packs SET ${setClauses.join(', ')} WHERE id = ?`).run(...runParams);

    res.json({ message: '模组更新成功' });
  } catch (err) {
    console.error('[Workshop] 更新 Pack 失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// DELETE /api/workshop/packs/:packId — 删除 pack（仅作者，级联删除条目）
router.delete('/packs/:packId', requireAuth, (req, res) => {
  const db = getDb();
  const packId = parseInt(req.params.packId);
  if (isNaN(packId)) return res.status(400).json({ error: '无效的模组 ID' });

  const existing = db.prepare(`SELECT author_id FROM workshop_packs WHERE id = ?`).get(packId);
  if (!existing) return res.status(404).json({ error: '模组不存在' });
  if (existing.author_id !== req.user.id) return res.status(403).json({ error: '无权删除此模组' });

  db.prepare(`DELETE FROM workshop_packs WHERE id = ?`).run(packId);
  res.json({ success: true, message: '模组已删除' });
});

// ── 点赞路由 ─────────────────────────────────────────────────────────

// POST /api/workshop/packs/:packId/like — 点赞（需登录）
router.post('/packs/:packId/like', requireAuth, (req, res) => {
  const db = getDb();
  const packId = parseInt(req.params.packId);
  if (isNaN(packId)) return res.status(400).json({ error: '无效的模组 ID' });

  const pack = db.prepare(`SELECT id FROM workshop_packs WHERE id = ?`).get(packId);
  if (!pack) return res.status(404).json({ error: '模组不存在' });

  try {
    const toggleLike = db.transaction(() => {
      const existing = db.prepare(`SELECT 1 FROM workshop_likes WHERE user_id = ? AND pack_id = ?`).get(req.user.id, packId);
      if (existing) {
        // 取消点赞
        db.prepare(`DELETE FROM workshop_likes WHERE user_id = ? AND pack_id = ?`).run(req.user.id, packId);
        db.prepare(`UPDATE workshop_packs SET like_count = MAX(0, like_count - 1) WHERE id = ?`).run(packId);
        return false;
      } else {
        // 点赞
        db.prepare(`INSERT INTO workshop_likes (user_id, pack_id) VALUES (?, ?)`).run(req.user.id, packId);
        db.prepare(`UPDATE workshop_packs SET like_count = like_count + 1 WHERE id = ?`).run(packId);
        return true;
      }
    });

    const liked = toggleLike();
    const row = db.prepare(`SELECT like_count FROM workshop_packs WHERE id = ?`).get(packId);
    res.json({ liked, like_count: row.like_count });
  } catch (err) {
    console.error('[Workshop] 点赞操作失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ── 订阅路由 ─────────────────────────────────────────────────────────

// POST /api/workshop/packs/:packId/subscribe — 订阅（需登录）
router.post('/packs/:packId/subscribe', requireAuth, (req, res) => {
  const db = getDb();
  const packId = parseInt(req.params.packId);
  if (isNaN(packId)) return res.status(400).json({ error: '无效的模组 ID' });

  const pack = db.prepare(`SELECT id FROM workshop_packs WHERE id = ?`).get(packId);
  if (!pack) return res.status(404).json({ error: '模组不存在' });

  try {
    const toggleSub = db.transaction(() => {
      const existing = db.prepare(`SELECT 1 FROM workshop_subscriptions WHERE user_id = ? AND pack_id = ?`).get(req.user.id, packId);
      if (existing) {
        // 取消订阅
        db.prepare(`DELETE FROM workshop_subscriptions WHERE user_id = ? AND pack_id = ?`).run(req.user.id, packId);
        db.prepare(`UPDATE workshop_packs SET sub_count = MAX(0, sub_count - 1) WHERE id = ?`).run(packId);
        return false;
      } else {
        // 订阅
        db.prepare(`INSERT INTO workshop_subscriptions (user_id, pack_id) VALUES (?, ?)`).run(req.user.id, packId);
        db.prepare(`UPDATE workshop_packs SET sub_count = sub_count + 1 WHERE id = ?`).run(packId);
        return true;
      }
    });

    const subscribed = toggleSub();
    const row = db.prepare(`SELECT sub_count FROM workshop_packs WHERE id = ?`).get(packId);
    res.json({ subscribed, sub_count: row.sub_count });
  } catch (err) {
    console.error('[Workshop] 订阅操作失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ── 条目路由（必须在 /:packId 之前定义，防止路由冲突）────────────────

// POST /api/workshop/packs/:packId/entries — 新建条目（需登录，且为 pack 作者）
router.post('/packs/:packId/entries', requireAuth, (req, res) => {
  const db = getDb();
  const packId = parseInt(req.params.packId);
  if (isNaN(packId)) return res.status(400).json({ error: '无效的模组 ID' });

  const pack = db.prepare(`SELECT author_id FROM workshop_packs WHERE id = ?`).get(packId);
  if (!pack) return res.status(404).json({ error: '模组不存在' });
  // 任何登录用户均可向工坊添加条目（无需为 pack 作者）

  const {
    name, enabled, content, strategy_type,
    keys, keys_secondary_logic, keys_secondary,
    scan_depth, position_type, position_order, position_depth, position_role,
    probability,
    recursion_prevent_incoming, recursion_prevent_outgoing, recursion_delay_until,
    effect_sticky, effect_cooldown, effect_delay,
  } = req.body;

  if (!name || !String(name).trim()) return res.status(400).json({ error: '条目名称不能为空' });
  if (String(name).trim().length > 200) return res.status(400).json({ error: '条目名称不能超过 200 字' });
  if (strategy_type && !VALID_STRATEGY_TYPES.includes(strategy_type)) return res.status(400).json({ error: '无效的策略类型' });
  if (position_type && !VALID_POSITION_TYPES.includes(position_type)) return res.status(400).json({ error: '无效的位置类型' });
  if (keys_secondary_logic && !VALID_LOGICS.includes(keys_secondary_logic)) return res.status(400).json({ error: '无效的逻辑类型' });
  if (position_role && !VALID_ROLES.includes(position_role)) return res.status(400).json({ error: '无效的角色类型' });

  const keysJson = JSON.stringify(Array.isArray(keys) ? keys : []);
  const keysSecondaryJson = JSON.stringify(Array.isArray(keys_secondary) ? keys_secondary : []);

  try {
    const info = db.prepare(`
      INSERT INTO workshop_entries (
        pack_id, author_id, name, enabled, content, strategy_type,
        keys, keys_secondary_logic, keys_secondary,
        scan_depth, position_type, position_order, position_depth, position_role,
        probability,
        recursion_prevent_incoming, recursion_prevent_outgoing, recursion_delay_until,
        effect_sticky, effect_cooldown, effect_delay
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      packId, req.user.id,
      String(name).trim(),
      enabled !== false ? 1 : 0,
      String(content || ''),
      strategy_type || 'selective',
      keysJson,
      keys_secondary_logic || 'and_any',
      keysSecondaryJson,
      scan_depth || 'same_as_global',
      position_type || 'after_character_definition',
      parseInt(position_order) || 100,
      parseInt(position_depth) || 4,
      position_role || 'system',
      Math.min(100, Math.max(0, parseInt(probability) ?? 100)),
      recursion_prevent_incoming ? 1 : 0,
      recursion_prevent_outgoing ? 1 : 0,
      recursion_delay_until || null,
      effect_sticky || null,
      effect_cooldown || null,
      effect_delay || null
    );

    // 更新 pack 的 updated_at
    db.prepare(`UPDATE workshop_packs SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(packId);

    res.status(201).json({ data: { id: info.lastInsertRowid }, message: '条目添加成功' });
  } catch (err) {
    console.error('[Workshop] 添加条目失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /api/workshop/entries/:entryId — 获取单条条目
router.get('/entries/:entryId', (req, res) => {
  const db = getDb();
  const entryId = parseInt(req.params.entryId);
  if (isNaN(entryId)) return res.status(400).json({ error: '无效的条目 ID' });

  const row = db.prepare(`SELECT * FROM workshop_entries WHERE id = ?`).get(entryId);
  if (!row) return res.status(404).json({ error: '条目不存在' });

  res.json({ data: formatEntry(row) });
});

// PUT /api/workshop/entries/:entryId — 编辑条目（仅 pack 作者）
router.put('/entries/:entryId', requireAuth, (req, res) => {
  const db = getDb();
  const entryId = parseInt(req.params.entryId);
  if (isNaN(entryId)) return res.status(400).json({ error: '无效的条目 ID' });

  const existing = db.prepare(`SELECT e.*, p.author_id as pack_author_id FROM workshop_entries e JOIN workshop_packs p ON e.pack_id = p.id WHERE e.id = ?`).get(entryId);
  if (!existing) return res.status(404).json({ error: '条目不存在' });
  // 条目作者或 pack 作者均可编辑
  const isEntryAuthor = existing.author_id === req.user.id;
  const isPackAuthor = existing.pack_author_id === req.user.id;
  if (!isEntryAuthor && !isPackAuthor) return res.status(403).json({ error: '无权编辑此条目' });

  const {
    name, enabled, content, strategy_type,
    keys, keys_secondary_logic, keys_secondary,
    scan_depth, position_type, position_order, position_depth, position_role,
    probability,
    recursion_prevent_incoming, recursion_prevent_outgoing, recursion_delay_until,
    effect_sticky, effect_cooldown, effect_delay,
  } = req.body;

  if (!name || !String(name).trim()) return res.status(400).json({ error: '条目名称不能为空' });

  const keysJson = JSON.stringify(Array.isArray(keys) ? keys : []);
  const keysSecondaryJson = JSON.stringify(Array.isArray(keys_secondary) ? keys_secondary : []);

  try {
    db.prepare(`
      UPDATE workshop_entries SET
        name = ?, enabled = ?, content = ?, strategy_type = ?,
        keys = ?, keys_secondary_logic = ?, keys_secondary = ?,
        scan_depth = ?, position_type = ?, position_order = ?, position_depth = ?, position_role = ?,
        probability = ?,
        recursion_prevent_incoming = ?, recursion_prevent_outgoing = ?, recursion_delay_until = ?,
        effect_sticky = ?, effect_cooldown = ?, effect_delay = ?
      WHERE id = ?
    `).run(
      String(name).trim(),
      enabled !== false ? 1 : 0,
      String(content || ''),
      strategy_type || 'selective',
      keysJson,
      keys_secondary_logic || 'and_any',
      keysSecondaryJson,
      scan_depth || 'same_as_global',
      position_type || 'after_character_definition',
      parseInt(position_order) || 100,
      parseInt(position_depth) || 4,
      position_role || 'system',
      Math.min(100, Math.max(0, parseInt(probability) ?? 100)),
      recursion_prevent_incoming ? 1 : 0,
      recursion_prevent_outgoing ? 1 : 0,
      recursion_delay_until || null,
      effect_sticky || null,
      effect_cooldown || null,
      effect_delay || null,
      entryId
    );

    // 更新 pack 的 updated_at
    db.prepare(`UPDATE workshop_packs SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(existing.pack_id);

    res.json({ message: '条目更新成功' });
  } catch (err) {
    console.error('[Workshop] 更新条目失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// DELETE /api/workshop/entries/:entryId — 删除条目（仅 pack 作者）
router.delete('/entries/:entryId', requireAuth, (req, res) => {
  const db = getDb();
  const entryId = parseInt(req.params.entryId);
  if (isNaN(entryId)) return res.status(400).json({ error: '无效的条目 ID' });

  const existing = db.prepare(`SELECT e.pack_id, e.author_id, p.author_id as pack_author_id FROM workshop_entries e JOIN workshop_packs p ON e.pack_id = p.id WHERE e.id = ?`).get(entryId);
  if (!existing) return res.status(404).json({ error: '条目不存在' });
  // 条目作者或 pack 作者均可删除
  const isEntryAuthor = existing.author_id === req.user.id;
  const isPackAuthor = existing.pack_author_id === req.user.id;
  if (!isEntryAuthor && !isPackAuthor) return res.status(403).json({ error: '无权删除此条目' });

  db.prepare(`DELETE FROM workshop_entries WHERE id = ?`).run(entryId);
  db.prepare(`UPDATE workshop_packs SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(existing.pack_id);
  res.json({ success: true, message: '条目已删除' });
});

module.exports = router;
