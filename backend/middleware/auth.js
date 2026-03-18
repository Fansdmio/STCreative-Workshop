const { verifyToken } = require('../utils/jwt');
const { getDb } = require('../db/init');

/**
 * 认证中间件 - 同时支持 JWT Token 和 Session Cookie
 * 优先检查 JWT Token（用于 iframe 跨域场景）
 * 回退到 Session 认证（用于传统浏览器直接访问）
 */
function requireAuth(req, res, next) {
  // 1. 优先检查 JWT Token（Authorization: Bearer xxx）
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload && payload.id) {
      // Token 有效，从数据库获取完整用户信息
      try {
        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
        if (user) {
          if (user.is_banned) {
            return res.status(403).json({ error: 'Forbidden', message: '您的账号已被封禁' });
          }
          req.user = user;  // 设置 req.user 供后续路由使用
          return next();
        }
      } catch (err) {
        console.error('[Auth] 数据库查询用户失败:', err);
      }
    }
    // Token 无效或用户不存在，返回 401
    return res.status(401).json({ error: 'Unauthorized', message: 'Token 无效或已过期' });
  }

  // 2. 回退到 Session 认证（Passport）
  if (req.isAuthenticated && req.isAuthenticated()) {
    if (req.user && req.user.is_banned) {
      req.logout(() => {});
      return res.status(403).json({ error: 'Forbidden', message: '您的账号已被封禁' });
    }
    return next();
  }

  res.status(401).json({ error: 'Unauthorized', message: '请先登录' });
}

module.exports = { requireAuth };
