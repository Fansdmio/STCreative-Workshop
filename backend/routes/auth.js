const express = require('express');
const passport = require('passport');
const router = express.Router();

// 发起 Discord OAuth2 授权（popup=1 参数用于 iframe 模式）
router.get('/discord', (req, res, next) => {
  // 将 popup 标记存入 session，回调时用于决定返回方式
  if (req.query.popup === '1') {
    req.session.authPopup = true;
  }
  passport.authenticate('discord')(req, res, next);
});

// OAuth 完成后返回自动关闭的 HTML 页面（弹窗模式用）
function sendPopupCloseHtml(res, success) {
  const html = `<!DOCTYPE html>
<html><head><title>登录${success ? '成功' : '失败'}</title></head>
<body><p>${success ? '登录成功，正在关闭窗口...' : '登录失败，请关闭此窗口后重试'}</p>
<script>window.close();</script></body></html>`;
  res.send(html);
}

// Discord 回调
router.get('/discord/callback', (req, res, next) => {
  passport.authenticate('discord', (err, user, info) => {
    const isPopup = req.session && req.session.authPopup;
    // 清除标记
    if (req.session) delete req.session.authPopup;

    if (err) {
      console.error('[Auth] Discord callback error:', err);
      if (isPopup) return sendPopupCloseHtml(res, false);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?login=failed`);
    }
    if (!user) {
      console.warn('[Auth] Discord callback no user, info:', info);
      if (isPopup) return sendPopupCloseHtml(res, false);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?login=failed`);
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('[Auth] Login error:', loginErr);
        if (isPopup) return sendPopupCloseHtml(res, false);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?login=failed`);
      }
      if (isPopup) return sendPopupCloseHtml(res, true);
      return res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
    });
  })(req, res, next);
});

// 获取当前登录用户信息
router.get('/me', (req, res) => {
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
