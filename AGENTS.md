# AGENTS.md — StoryShare / SillyTavern Creative Workshop

Coding-agent instructions for this repository. Read this before making any changes.

---

## Project Overview

**StoryShare** is a story-sharing and SillyTavern worldbook workshop platform with Discord OAuth2 login.

| Layer    | Stack                                                                    |
| -------- | ------------------------------------------------------------------------ |
| Backend  | Node.js 20, Express 5, better-sqlite3, Passport + passport-discord      |
| Frontend | Vue 3 (`<script setup>`), Vite 8, Pinia 3, Vue Router 4, Tailwind CSS v4 |
| Database | SQLite (WAL mode) — auto-created at `backend/db/stories.db`             |
| Auth     | Discord OAuth2 only; session cookie (`connect.sid`); no JWT             |
| Markdown | `marked` + `DOMPurify` for rendering user-generated content             |

Not a monorepo — `backend/` and `frontend/` are independent Node projects with separate `package.json` files and `node_modules/`. There is no root-level `package.json`.

---

## Directory Structure

```
SteamPunkStore_demo/
├── backend/
│   ├── db/init.js              # SQLite schema + getDb() singleton; migration guards at bottom
│   ├── middleware/auth.js      # requireAuth middleware
│   ├── routes/
│   │   ├── auth.js             # /auth/* Discord OAuth2 routes
│   │   ├── stories.js          # /api/stories CRUD
│   │   ├── tags.js             # /api/tags
│   │   └── workshop.js         # /api/workshop — pack/entry CRUD, like/subscribe toggles
│   ├── .env                    # Real secrets — never commit
│   ├── .env.example            # Template for all env vars
│   └── server.js               # Express entry point
├── frontend/
│   ├── src/
│   │   ├── components/         # Navbar, StoryCard, TagFilter, WorkshopPackCard, WorkshopEntryCard
│   │   ├── composables/        # Empty — place reusable composable logic here
│   │   ├── config/sections.js  # SECTION_CONFIG, DEFAULT_TAGS, localStorage worldbook name helpers
│   │   ├── router/index.js     # Vue Router + auth guard
│   │   ├── stores/             # Pinia: auth.js, stories.js, workshop.js
│   │   ├── views/              # HomeView, StoryDetailView, UploadView, WorkshopView,
│   │   │                       # WorkshopPackDetail, WorkshopPackEditor, WorkshopEntryEditor
│   │   ├── App.vue
│   │   ├── main.js
│   │   └── style.css           # Tailwind v4 imports + @layer component classes
│   └── vite.config.js          # base: '/StoryShare/', proxy /api & /auth → localhost:3000
├── @types/                     # Global type stubs (root level)
├── nginx.conf                  # Nginx config template
├── storyshare.service          # systemd service unit
└── DEPLOY.md                   # Production deployment guide (Chinese)
```

---

## Build & Dev Commands

### Backend

```bash
cd backend
npm install
npm run dev          # nodemon server.js (auto-restart, port 3000)
npm start            # node server.js (production)
# Syntax-check only (no test runner):
node --check server.js
node --check routes/workshop.js
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # Vite dev server — port 5173, proxies /api and /auth to localhost:3000
npm run build        # Production build → frontend/dist/
npm run preview      # Preview production build locally
```

### No Tests, No Linter

There are **no tests** and no `npm run test` or `npm run lint` commands. Do not reference them.
If adding tests, install `vitest` in the relevant sub-project and add `"test": "vitest"` to its scripts.

---

## Environment Variables

Backend reads from `backend/.env`. Never commit this file.

| Variable                | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `DISCORD_CLIENT_ID`     | Discord application client ID                    |
| `DISCORD_CLIENT_SECRET` | Discord application client secret               |
| `DISCORD_REDIRECT_URI`  | Must match exactly what is set in Discord portal |
| `SESSION_SECRET`        | Secret for express-session cookie signing        |
| `FRONTEND_URL`          | e.g. `http://localhost:5173` in dev              |
| `PORT`                  | Backend port (default `3000`)                    |
| `NODE_ENV`              | `development` or `production`                    |
| `HTTP_PROXY`            | Optional: `http://127.0.0.1:10808` for CN proxy  |

When `HTTP_PROXY` is set, `server.js` patches the passport-discord OAuth2 instance via
`discordStrategy._oauth2.setAgent(agent)` using `HttpsProxyAgent` v5 (CJS).
**Do not upgrade `https-proxy-agent` to v6+** — it is ESM-only and will break the require().

---

## Code Style Guidelines

### Language & Module System

- **Backend**: CommonJS throughout — always `require()` / `module.exports`. Never `import`/`export`.
- **Frontend**: ES Modules (`"type": "module"`) — always `import`/`export`.
- **No TypeScript** — all files are plain `.js` / `.vue`.
- **UI text and comments are in Chinese (zh-CN)**. Continue this for all new strings and inline comments.

### Backend Import Order

1. Node built-ins (`path`, `querystring`)
2. Third-party packages (`express`, `passport`, `better-sqlite3`)
3. Local modules (`./db/init`, `./routes/auth`)

### Vue Components

- Always `<script setup>` Composition API — never Options API.
- SFC block order: `<script setup>` → `<template>` → `<style>`.
- Props: `defineProps()`, emits: `defineEmits()`. Reusable logic: `src/composables/`.

### Naming Conventions

| Thing               | Convention                         | Example                     |
| ------------------- | ---------------------------------- | --------------------------- |
| Vue components      | PascalCase filename                | `StoryCard.vue`             |
| Vue views           | PascalCase + `View` suffix         | `HomeView.vue`              |
| Pinia stores        | camelCase file, `use*Store` export | `useAuthStore`              |
| Backend route files | camelCase                          | `stories.js`                |
| DB columns          | snake_case                         | `author_id`, `created_at`   |
| JS variables/funcs  | camelCase                          | `fetchStories`, `activeTag` |
| Constants           | UPPER_SNAKE_CASE                   | `PORT`, `NODE_ENV`          |
| CSS classes         | Tailwind utilities + kebab-case component classes in `style.css` |

### Error Handling

**Backend:**
- `try/catch` around all DB operations in route handlers.
- `500`: `res.status(500).json({ error: '服务器内部错误' })`
- `401`: `res.status(401).json({ error: 'Unauthorized', message: '请先登录' })`
- `400`: `res.status(400).json({ error: '<descriptive Chinese message>' })`
- Log format: `console.error('[Module] description:', err)`

**Frontend:**
- Pinia store actions `catch` errors and set a store-level `error` ref. Never `throw` from a store action.
- Views read `store.error` and display user-facing messages in Chinese.

### Database Access

- All DB access is **synchronous** via `better-sqlite3` prepared statements.
- Call `getDb()` at the top of each route handler — never cache `db` in module scope inside routes.
- Multi-step writes (e.g. insert story + tags) use `db.transaction()`.
- Always use `?` placeholders; never interpolate values into SQL strings.
- Schema additions use `try/catch ALTER TABLE` migration guards at the bottom of `db/init.js`.

### Tailwind CSS

- Tailwind v4 — no `tailwind.config.js`. Configured via `@tailwindcss/vite` plugin only.
- Global component classes (`.btn-primary`, `.card`, `.input`, `.tag-badge`, `.page-container`, etc.)
  are defined in `src/style.css` under `@layer components { @apply ... }`.
- Add new utility classes to `src/style.css`; avoid long inline `class` strings in templates.
- `@tailwindcss/typography` is available as `.prose` for Markdown content.

### API Conventions

- API routes: `/api/` prefix. Auth routes: `/auth/` prefix.
- List responses: `{ data: [...], pagination: { page, limit, total, totalPages } }` (stories);
  workshop uses `{ packs: [...], pagination: { ... } }`.
- Single-item: `{ data: { ... } }`. All errors: `{ error: '<Chinese message>' }`.

---

## Key Architectural Notes

- **Production**: `NODE_ENV=production` → Express serves `frontend/dist/` as static files with
  SPA fallback via Express 5's `/*splat` → `index.html`.
- **Vite base path**: `vite.config.js` sets `base: '/StoryShare/'`. All built asset URLs are
  relative to this sub-path; keep this in mind when adjusting routing or static paths.
- **Session**: `express-session` with in-memory store. For production use `connect-sqlite3` or
  `better-sqlite3-session-store`.
- **Express 5**: async route handlers forward unhandled rejections to the global error handler
  automatically, but explicit `try/catch` is still used throughout for clarity.
- **SillyTavern integration**: Workshop detects `window.SillyTavern` at runtime. If present,
  subscribe/unsubscribe triggers `loadWorldInfo/saveWorldInfo/reloadWorldInfoEditor` to manage
  worldbook entries. Gracefully no-ops when not embedded in SillyTavern.
- **Sections**: Workshop is split into sections (`steampunk`, `chainsaw`) defined in
  `frontend/src/config/sections.js`. Each section has its own default SillyTavern worldbook name
  persisted to `localStorage` via `getWorldbookName(section)` / `saveWorldbookName(section, name)`.
- **Known bug**: `WorkshopEntryCard.vue` calls `router.push({ name: 'workshop-edit', ... })` but
  the correct route name is `workshop-entry-edit`. Fix this if editing that component.
