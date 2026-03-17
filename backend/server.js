require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const cors = require('cors');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

const { getDb } = require('./db/init');
const authRouter = require('./routes/auth');
const storiesRouter = require('./routes/stories');
const tagsRouter = require('./routes/tags');
const workshopRouter = require('./routes/workshop');
const creatorRouter = require('./routes/creator');
const adminRouter = require('./routes/admin');
const stBridgeRouter = require('./routes/st-bridge');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// ─── 信任 Nginx 反向代理（生产环境必须） ───────────────────────
if (isProd) {
  app.set('trust proxy', 1);
}

// ─── CORS ────────────────────────────────────────────────────────
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: function (origin, callback) {
      // 无 origin（curl / 服务端请求）直接放行
      if (!origin) return callback(null, true);
      // 精确匹配配置的前端地址
      if (origin === ALLOWED_ORIGIN) return callback(null, true);
      // 开发环境：放行所有 localhost/127.0.0.1 来源（兼容 SillyTavern 各端口）
      if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS: ' + origin));
    },
    credentials: true,
  })
);

// ─── Body Parser ─────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Session ─────────────────────────────────────────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
    },
  })
);

// ─── Passport + 代理注入 ─────────────────────────────────────────
const proxyUrl = process.env.HTTP_PROXY || process.env.http_proxy || null;

const discordStrategy = new DiscordStrategy(
  {
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_REDIRECT_URI,
    scope: ['identify'],
  },
  function (accessToken, refreshToken, profile, done) {
    const db = getDb();
    try {
      const existing = db
        .prepare(`SELECT * FROM users WHERE discord_id = ?`)
        .get(profile.id);

      if (existing) {
        db.prepare(
          `UPDATE users SET username = ?, avatar = ?, display_name = ? WHERE discord_id = ?`
        ).run(profile.username, profile.avatar, profile.global_name || null, profile.id);
        return done(null, { ...existing, username: profile.username, avatar: profile.avatar, display_name: profile.global_name || null });
      }

      const info = db
        .prepare(`INSERT INTO users (discord_id, username, avatar, display_name) VALUES (?, ?, ?, ?)`)
        .run(profile.id, profile.username, profile.avatar, profile.global_name || null);

      const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(info.lastInsertRowid);
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
);

// 给 passport-discord 底层的 oauth2 实例注入代理 agent
if (proxyUrl) {
  const agent = new HttpsProxyAgent(proxyUrl);
  discordStrategy._oauth2.setAgent(agent);
  console.log(`[Proxy] Using HTTP proxy: ${proxyUrl}`);
}

passport.use(discordStrategy);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  try {
    const db = getDb();
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
    done(null, user || false);
  } catch (err) {
    done(err, null);
  }
});

app.use(passport.initialize());
app.use(passport.session());

// ─── 路由 ─────────────────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/api/stories', storiesRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/workshop', workshopRouter);
app.use('/api/creator', creatorRouter);
app.use('/admin', adminRouter);
app.use('/api/st-bridge', stBridgeRouter);

// ─── 健康检查 ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

// ─── 生产环境：托管前端静态文件 ───────────────────────────────────
if (isProd) {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('/*splat', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ─── 错误处理 ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack || err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

// ─── 启动 ─────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  getDb();
  console.log('[DB] SQLite initialized');
});
