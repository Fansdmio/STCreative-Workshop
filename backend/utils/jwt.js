/**
 * JWT 工具函数和临时 token 存储
 * 用于支持 iframe 跨域场景下的认证
 */
const jwt = require('jsonwebtoken');

// JWT 密钥（使用 session secret 或单独配置）
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'jwt-secret-change-me';
// Token 过期时间：7 天
const JWT_EXPIRES_IN = '7d';

/**
 * 临时 token 存储（内存）
 * key -> { token, user, createdAt }
 * 用于 OAuth 回调后前端轮询获取 token
 */
const pendingTokens = new Map();

// 清理过期的 pending tokens（5 分钟过期）
const PENDING_TOKEN_TTL = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of pendingTokens.entries()) {
    if (now - data.createdAt > PENDING_TOKEN_TTL) {
      pendingTokens.delete(key);
    }
  }
}, 60 * 1000); // 每分钟清理一次

/**
 * 生成 JWT token
 * @param {Object} user - 用户对象
 * @returns {string} JWT token
 */
function signToken(user) {
  const payload = {
    id: user.id,
    discord_id: user.discord_id,
    username: user.username,
    role: user.role || 'user',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 验证 JWT token
 * @param {string} token - JWT token
 * @returns {Object|null} 解码后的 payload，验证失败返回 null
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.error('[JWT] Token 验证失败:', err.message);
    return null;
  }
}

/**
 * 存储 pending token（OAuth 回调后调用）
 * @param {string} key - 前端生成的随机 key
 * @param {string} token - JWT token
 * @param {Object} user - 用户信息
 */
function storePendingToken(key, token, user) {
  pendingTokens.set(key, {
    token,
    user: {
      id: user.id,
      discord_id: user.discord_id,
      username: user.username,
      display_name: user.display_name || null,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discord_id) % 5}.png`,
      role: user.role || 'user',
      created_at: user.created_at,
    },
    createdAt: Date.now(),
  });
  console.log('[JWT] 存储 pending token, key:', key);
}

/**
 * 获取并删除 pending token（前端轮询调用，一次性）
 * @param {string} key - 前端生成的随机 key
 * @returns {Object|null} { token, user } 或 null
 */
function consumePendingToken(key) {
  const data = pendingTokens.get(key);
  if (data) {
    pendingTokens.delete(key);
    console.log('[JWT] 消费 pending token, key:', key);
    return { token: data.token, user: data.user };
  }
  return null;
}

module.exports = {
  signToken,
  verifyToken,
  storePendingToken,
  consumePendingToken,
};
