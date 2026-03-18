const express = require('express');
const passport = require('passport');
const { getDb } = require('../db/init');
const { signToken, verifyToken, storePendingToken, consumePendingToken } = require('../utils/jwt');
const router = express.Router();

// 发起 Discord OAuth2 授权
// - popup=1：传统弹窗模式
// - authKey=xxx：JWT 模式，OAuth 完成后通过此 key 传递 token
router.get('/discord', (req, res, next) => {
  // 将 popup 标记存入 session，回调时用于决定返回方式
  if (req.query.popup === '1') {
    req.session.authPopup = true;
  }
  // JWT 模式：存储 authKey 用于回调后生成 token
  if (req.query.authKey) {
    req.session.authKey = req.query.authKey;
  }
  passport.authenticate('discord')(req, res, next);
});

// OAuth 完成后返回自动关闭的 HTML 页面（弹窗模式用）
function sendPopupCloseHtml(res, success, frontendUrl) {
  // 重定向到前端的 oauth-callback 页面，让前端完成登录确认后再关闭弹窗
  // 这样可以确保 session cookie 在前端域上也被正确设置
  const callbackUrl = `${frontendUrl}/oauth-callback?success=${success ? '1' : '0'}`
  res.redirect(callbackUrl);
}

// JWT 模式：返回一个自动关闭的页面
function sendJwtModeCloseHtml(res) {
  res.send(`<!DOCTYPE html>
<html>
<head><title>登录成功</title></head>
<body>
<p>登录成功，正在关闭窗口...</p>
<script>
  // 尝试关闭弹窗
  try { window.close(); } catch(e) {}
  // 如果无法关闭，显示提示
  setTimeout(function() {
    document.body.innerHTML = '<p>登录成功！请手动关闭此窗口。</p>';
  }, 500);
</script>
</body>
</html>`);
}

// Discord 回调
router.get('/discord/callback', (req, res, next) => {
  passport.authenticate('discord', (err, user, info) => {
    const isPopup = req.session && req.session.authPopup;
    const authKey = req.session && req.session.authKey;
    // 清除标记
    if (req.session) {
      delete req.session.authPopup;
      delete req.session.authKey;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (err) {
      console.error('[Auth] Discord callback error:', err);
      if (authKey) return sendJwtModeCloseHtml(res); // JWT 模式，前端会通过 poll 得知失败
      if (isPopup) return sendPopupCloseHtml(res, false, frontendUrl);
      return res.redirect(`${frontendUrl}?login=failed`);
    }
    if (!user) {
      console.warn('[Auth] Discord callback no user, info:', info);
      if (authKey) return sendJwtModeCloseHtml(res);
      if (isPopup) return sendPopupCloseHtml(res, false, frontendUrl);
      return res.redirect(`${frontendUrl}?login=failed`);
    }

    // JWT 模式：生成 token 并存储，然后关闭弹窗
    if (authKey) {
      const token = signToken(user);
      storePendingToken(authKey, token, user);
      console.log('[Auth] JWT 模式登录成功, authKey:', authKey);
      return sendJwtModeCloseHtml(res);
    }

    // 传统模式：使用 session
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('[Auth] Login error:', loginErr);
        if (isPopup) return sendPopupCloseHtml(res, false, frontendUrl);
        return res.redirect(`${frontendUrl}?login=failed`);
      }
      if (isPopup) return sendPopupCloseHtml(res, true, frontendUrl);
      return res.redirect(frontendUrl);
    });
  })(req, res, next);
});

// 获取当前登录用户信息
// 支持两种认证方式：
// 1. JWT Token（Authorization: Bearer xxx）- 用于 iframe 跨域场景
// 2. Session Cookie - 传统方式
router.get('/me', (req, res) => {
  // 优先检查 JWT Token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      // Token 有效，从数据库获取最新用户信息
      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
      if (user) {
        return res.json({
          id: user.id,
          discord_id: user.discord_id,
          username: user.username,
          display_name: user.display_name || null,
          avatar: user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discord_id) % 5}.png`,
          role: user.role || 'user',
          created_at: user.created_at,
        });
      }
    }
    // Token 无效或用户不存在
    return res.json(null);
  }

  // 回退到 Session 认证
  if (req.isAuthenticated && req.isAuthenticated()) {
    const { id, discord_id, username, display_name, avatar, role, created_at } = req.user;
    res.json({
      id,
      discord_id,
      username,
      display_name: display_name || null,
      avatar: avatar
        ? `https://cdn.discordapp.com/avatars/${discord_id}/${avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(discord_id) % 5}.png`,
      role: role || 'user',
      created_at,
    });
  } else {
    res.json(null);
  }
});

// 轮询获取 JWT Token（用于 OAuth 回调后）
// 前端在打开 OAuth 弹窗前生成 authKey，然后轮询此端点获取 token
router.get('/poll', (req, res) => {
  const { key } = req.query;
  if (!key) {
    return res.status(400).json({ error: '缺少 key 参数' });
  }

  const result = consumePendingToken(key);
  if (result) {
    // 找到 token，返回给前端
    res.json({ token: result.token, user: result.user });
  } else {
    // 尚未完成或已过期
    res.json({ token: null, user: null });
  }
});

// 登出
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

module.exports = router;
