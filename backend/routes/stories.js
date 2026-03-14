const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/auth');

// GET /api/stories — 获取故事列表（支持标签过滤 + 分页）
router.get('/', (req, res) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
  const offset = (page - 1) * limit;
  const tag = req.query.tag ? req.query.tag.trim() : null;

  let stories, total;

  if (tag) {
    total = db
      .prepare(
        `SELECT COUNT(DISTINCT s.id) as count
         FROM stories s
         JOIN story_tags st ON s.id = st.story_id
         JOIN tags t ON st.tag_id = t.id
         WHERE t.name = ?`
      )
      .get(tag)?.count || 0;

    stories = db
      .prepare(
        `SELECT s.id, s.title, s.content, s.created_at,
                u.id as author_id, u.username as author_name,
                u.avatar as author_avatar, u.discord_id as author_discord_id
         FROM stories s
         JOIN users u ON s.author_id = u.id
         JOIN story_tags st ON s.id = st.story_id
         JOIN tags tg ON st.tag_id = tg.id
         WHERE tg.name = ?
         GROUP BY s.id
         ORDER BY s.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(tag, limit, offset);
  } else {
    total = db.prepare(`SELECT COUNT(*) as count FROM stories`).get()?.count || 0;

    stories = db
      .prepare(
        `SELECT s.id, s.title, s.content, s.created_at,
                u.id as author_id, u.username as author_name,
                u.avatar as author_avatar, u.discord_id as author_discord_id
         FROM stories s
         JOIN users u ON s.author_id = u.id
         ORDER BY s.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset);
  }

  // 附加每个故事的标签
  const tagStmt = db.prepare(
    `SELECT t.name FROM tags t
     JOIN story_tags st ON t.id = st.tag_id
     WHERE st.story_id = ?`
  );

  const result = stories.map((s) => {
    const tags = tagStmt.all(s.id).map((r) => r.name);
    const preview = s.content.replace(/[#*`>_~\[\]()!]/g, '').trim().slice(0, 120);
    return {
      id: s.id,
      title: s.title,
      preview: preview + (s.content.length > 120 ? '…' : ''),
      created_at: s.created_at,
      tags,
      author: {
        id: s.author_id,
        username: s.author_name,
        avatar: s.author_avatar
          ? `https://cdn.discordapp.com/avatars/${s.author_discord_id}/${s.author_avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/${parseInt(s.author_discord_id) % 5}.png`,
      },
    };
  });

  res.json({
    stories: result,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/stories/:id — 获取单篇故事详情
router.get('/:id', (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: '无效的故事 ID' });

  const story = db
    .prepare(
      `SELECT s.id, s.title, s.content, s.created_at,
              u.id as author_id, u.username as author_name,
              u.avatar as author_avatar, u.discord_id as author_discord_id
       FROM stories s
       JOIN users u ON s.author_id = u.id
       WHERE s.id = ?`
    )
    .get(id);

  if (!story) return res.status(404).json({ error: '故事不存在' });

  const tags = db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN story_tags st ON t.id = st.tag_id
       WHERE st.story_id = ?`
    )
    .all(id)
    .map((r) => r.name);

  res.json({
    id: story.id,
    title: story.title,
    content: story.content,
    created_at: story.created_at,
    tags,
    author: {
      id: story.author_id,
      username: story.author_name,
      avatar: story.author_avatar
        ? `https://cdn.discordapp.com/avatars/${story.author_discord_id}/${story.author_avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(story.author_discord_id) % 5}.png`,
    },
  });
});

// POST /api/stories — 上传新故事（需登录）
router.post('/', requireAuth, (req, res) => {
  const db = getDb();
  const { title, content, tags } = req.body;

  if (!title || !title.trim()) return res.status(400).json({ error: '标题不能为空' });
  if (!content || !content.trim()) return res.status(400).json({ error: '内容不能为空' });
  if (title.trim().length > 200) return res.status(400).json({ error: '标题不能超过 200 字' });

  const tagList = Array.isArray(tags)
    ? tags.map((t) => t.trim()).filter(Boolean).slice(0, 10)
    : [];

  const insertStory = db.prepare(
    `INSERT INTO stories (title, content, author_id) VALUES (?, ?, ?)`
  );
  const insertTag = db.prepare(`INSERT OR IGNORE INTO tags (name) VALUES (?)`);
  const getTag = db.prepare(`SELECT id FROM tags WHERE name = ?`);
  const insertStoryTag = db.prepare(
    `INSERT OR IGNORE INTO story_tags (story_id, tag_id) VALUES (?, ?)`
  );

  const transaction = db.transaction(() => {
    const info = insertStory.run(title.trim(), content.trim(), req.user.id);
    const storyId = info.lastInsertRowid;

    for (const tagName of tagList) {
      insertTag.run(tagName);
      const tag = getTag.get(tagName);
      insertStoryTag.run(storyId, tag.id);
    }

    return storyId;
  });

  const storyId = transaction();
  res.status(201).json({ id: storyId, message: '故事发布成功' });
});

// DELETE /api/stories/:id — 删除故事（仅作者本人）
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: '无效的故事 ID' });

  const story = db.prepare(`SELECT author_id FROM stories WHERE id = ?`).get(id);
  if (!story) return res.status(404).json({ error: '故事不存在' });
  if (story.author_id !== req.user.id) return res.status(403).json({ error: '无权删除此故事' });

  db.prepare(`DELETE FROM stories WHERE id = ?`).run(id);
  res.json({ success: true, message: '故事已删除' });
});

module.exports = router;
