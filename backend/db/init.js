const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'stories.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  // 创建基础表（stories 系统保留，不删除）
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS story_tags (
      story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (story_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_stories_author ON stories(author_id);
    CREATE INDEX IF NOT EXISTS idx_stories_created ON stories(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_story_tags_story ON story_tags(story_id);
    CREATE INDEX IF NOT EXISTS idx_story_tags_tag ON story_tags(tag_id);

    -- 条目包（Pack）：作者发布的世界书条目集合
    CREATE TABLE IF NOT EXISTS workshop_packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      like_count INTEGER NOT NULL DEFAULT 0,
      sub_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_packs_author ON workshop_packs(author_id);
    CREATE INDEX IF NOT EXISTS idx_packs_hot ON workshop_packs(like_count + sub_count DESC, created_at DESC);

    -- 世界书条目：属于某个 pack
    CREATE TABLE IF NOT EXISTS workshop_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id INTEGER NOT NULL REFERENCES workshop_packs(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      content TEXT NOT NULL DEFAULT '',
      strategy_type TEXT NOT NULL DEFAULT 'selective',
      keys TEXT NOT NULL DEFAULT '[]',
      keys_secondary_logic TEXT NOT NULL DEFAULT 'and_any',
      keys_secondary TEXT NOT NULL DEFAULT '[]',
      scan_depth TEXT NOT NULL DEFAULT 'same_as_global',
      position_type TEXT NOT NULL DEFAULT 'after_character_definition',
      position_order INTEGER NOT NULL DEFAULT 100,
      position_depth INTEGER NOT NULL DEFAULT 4,
      position_role TEXT NOT NULL DEFAULT 'system',
      probability INTEGER NOT NULL DEFAULT 100,
      recursion_prevent_incoming INTEGER NOT NULL DEFAULT 0,
      recursion_prevent_outgoing INTEGER NOT NULL DEFAULT 0,
      recursion_delay_until TEXT DEFAULT NULL,
      effect_sticky TEXT DEFAULT NULL,
      effect_cooldown TEXT DEFAULT NULL,
      effect_delay TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_entries_author ON workshop_entries(author_id);

    -- 点赞：每个用户对每个 pack 只能点赞一次
    CREATE TABLE IF NOT EXISTS workshop_likes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pack_id INTEGER NOT NULL REFERENCES workshop_packs(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, pack_id)
    );

    CREATE INDEX IF NOT EXISTS idx_likes_pack ON workshop_likes(pack_id);

    -- 订阅：每个用户对每个 pack 只能订阅一次
    CREATE TABLE IF NOT EXISTS workshop_subscriptions (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pack_id INTEGER NOT NULL REFERENCES workshop_packs(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, pack_id)
    );

    CREATE INDEX IF NOT EXISTS idx_subs_pack ON workshop_subscriptions(pack_id);
  `);

  // 迁移：给旧的 workshop_entries 表添加 pack_id 列（如果不存在）
  try {
    db.exec(`ALTER TABLE workshop_entries ADD COLUMN pack_id INTEGER REFERENCES workshop_packs(id) ON DELETE CASCADE`);
  } catch (_) {
    // 列已存在，忽略
  }

  // 迁移后再建 pack_id 索引（列确保存在后才能建）
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_entries_pack ON workshop_entries(pack_id)`);
  } catch (_) {
    // 索引已存在，忽略
  }

  // 迁移：给 users 添加 role 列（user / creator / admin）
  try {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
  } catch (_) {
    // 列已存在，忽略
  }

  // 创建者申请表
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS creator_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        reason TEXT NOT NULL DEFAULT '',
        admin_note TEXT NOT NULL DEFAULT '',
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME
      );
      CREATE INDEX IF NOT EXISTS idx_applications_status ON creator_applications(status);
      CREATE INDEX IF NOT EXISTS idx_applications_user ON creator_applications(user_id);
    `);
  } catch (_) {
    // 表已存在，忽略
  }

  // 迁移：给 workshop_packs 添加 section 列（分区标识）
  try {
    db.exec(`ALTER TABLE workshop_packs ADD COLUMN section TEXT NOT NULL DEFAULT 'steampunk'`);
  } catch (_) {
    // 列已存在，忽略
  }

  // 迁移：给 workshop_packs 添加 tags 列（JSON 数组）
  try {
    db.exec(`ALTER TABLE workshop_packs ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`);
  } catch (_) {
    // 列已存在，忽略
  }

  // section 列索引
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_packs_section ON workshop_packs(section)`);
  } catch (_) {
    // 索引已存在，忽略
  }

  // 迁移：给 workshop_packs 添加 worldbook 列（工坊目标世界书名称）
  try {
    db.exec(`ALTER TABLE workshop_packs ADD COLUMN worldbook TEXT NOT NULL DEFAULT ''`);
  } catch (_) {
    // 列已存在，忽略
  }

  // 迁移：给 creator_applications 添加 platform 列（发布平台）
  try {
    db.exec(`ALTER TABLE creator_applications ADD COLUMN platform TEXT NOT NULL DEFAULT ''`);
  } catch (_) {
    // 列已存在，忽略
  }

  // 迁移：给 creator_applications 添加 published_works 列（已发布作品）
  try {
    db.exec(`ALTER TABLE creator_applications ADD COLUMN published_works TEXT NOT NULL DEFAULT ''`);
  } catch (_) {
    // 列已存在，忽略
  }

  // 迁移：创建 workshops 表（工坊顶级容器）
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workshops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        worldbook TEXT NOT NULL DEFAULT '',
        author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_workshops_slug ON workshops(slug);
    `);
  } catch (_) {
    // 表已存在，忽略
  }

  // 内置工坊种子数据（author_id = NULL 表示内置，不可编辑/删除）
  try {
    const seed = db.transaction(() => {
      const existing = db.prepare(`SELECT COUNT(*) as c FROM workshops`).get();
      if (existing.c === 0) {
        db.prepare(`INSERT INTO workshops (name, slug, description, worldbook, author_id) VALUES (?, ?, ?, ?, NULL)`)
          .run('蒸汽朋克', 'steampunk', '蒸汽朋克世界书工坊', '在这个蒸汽朋克且阶级分化的世界，多样的政治势力，外加一群可爱美少女，我的异世界冒险不可能这么丰富多彩！');
        db.prepare(`INSERT INTO workshops (name, slug, description, worldbook, author_id) VALUES (?, ?, ?, ?, NULL)`)
          .run('电锯人', 'chainsaw', '电锯人世界书工坊', '电锯人');
      }
    });
    seed();
  } catch (_) {
    // 种子已存在，忽略
  }

  // 迁移：给 workshop_packs 添加 workshop_id 列（外键关联 workshops）
  try {
    db.exec(`ALTER TABLE workshop_packs ADD COLUMN workshop_id INTEGER REFERENCES workshops(id) ON DELETE SET NULL`);
  } catch (_) {
    // 列已存在，忽略
  }

  // 迁移：回填 workshop_id（根据现有 section 字段）
  try {
    db.exec(`
      UPDATE workshop_packs
      SET workshop_id = (SELECT id FROM workshops WHERE slug = workshop_packs.section)
      WHERE workshop_id IS NULL
    `);
  } catch (_) {
    // 忽略
  }

  // workshop_id 索引
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_packs_workshop ON workshop_packs(workshop_id)`);
  } catch (_) {
    // 索引已存在，忽略
  }

  // 迁移：给 workshops 添加 status 列（审批状态）
  try {
    db.exec(`ALTER TABLE workshops ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
  } catch (_) {
    // 列已存在，忽略
  }

  // 迁移：给 users 添加 display_name 列（Discord global_name，主显示名）
  try {
    db.exec(`ALTER TABLE users ADD COLUMN display_name TEXT`);
  } catch (_) {
    // 列已存在，忽略
  }

  // 迁移：将内置工坊（steampunk、chainsaw）的作者更新为 alycesingle
  // 仅在 author_id 为 NULL 且 alycesingle 用户已存在时执行
  try {
    db.exec(`
      UPDATE workshops
      SET author_id = (SELECT id FROM users WHERE username = 'alycesingle' LIMIT 1)
      WHERE slug IN ('steampunk', 'chainsaw')
        AND author_id IS NULL
        AND (SELECT id FROM users WHERE username = 'alycesingle' LIMIT 1) IS NOT NULL
    `);
  } catch (_) {
    // 忽略（用户可能尚未登录过，待首次登录后自动回填）
  }

  // 迁移：给 users 添加 is_banned 列（黑名单）
  try {
    db.exec(`ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {
    // 列已存在，忽略
  }
}

module.exports = { getDb };
