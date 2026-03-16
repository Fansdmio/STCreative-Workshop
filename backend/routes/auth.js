const express = require('express');
const passport = require('passport');
const router = express.Router();

// 发起 Discord OAuth2 授权
router.get('/discord', passport.authenticate('discord'));

// Discord 回调
router.get('/discord/callback', (req, res, next) => {
  passport.authenticate('discord', (err, user, info) => {
    if (err) {
      console.error('[Auth] Discord callback error:', err);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?login=failed`);
    }
    if (!user) {
      console.warn('[Auth] Discord callback no user, info:', info);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?login=failed`);
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('[Auth] Login error:', loginErr);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?login=failed`);
      }
      return res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
    });
  })(req, res, next);
});

// 获取当前登录用户信息
router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const { id, discord_id, username, avatar, role, created_at } = req.user;
    res.json({
      id,
      discord_id,
      username,
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
