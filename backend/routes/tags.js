const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');

// GET /api/tags — 获取所有标签（附带使用次数）
router.get('/', (req, res) => {
  const db = getDb();
  const tags = db
    .prepare(
      `SELECT t.name, COUNT(st.story_id) as count
       FROM tags t
       LEFT JOIN story_tags st ON t.id = st.tag_id
       GROUP BY t.id
       ORDER BY count DESC, t.name ASC`
    )
    .all();
  res.json(tags);
});

module.exports = router;
