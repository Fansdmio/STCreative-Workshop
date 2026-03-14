# AGENTS.md — StoryShare (SteamPunkStore_demo)

Coding-agent instructions for this repository. Read this before making any changes.

---

## Project Overview

**StoryShare** is a story-sharing platform with Discord OAuth2 login.

| Layer    | Stack                                                              |
| -------- | ------------------------------------------------------------------ |
| Backend  | Node.js 20, Express 5, better-sqlite3, Passport + passport-discord |
| Frontend | Vue 3 (`<script setup>`), Vite 8, Pinia 3, Vue Router 4, Tailwind CSS v4 |
| Database | SQLite (WAL mode) — auto-created at `backend/db/stories.db`        |
| Auth     | Discord OAuth2 only; session cookie (`connect.sid`); no JWT        |

The project is **not a monorepo** — `backend/` and `frontend/` are two independent Node projects with separate `package.json` files and `node_modules/`. There is no root-level `package.json`.

---

## Directory Structure

```
SteamPunkStore_demo/
├── backend/
│   ├── db/init.js            # SQLite schema + getDb() singleton
│   ├── middleware/auth.js    # requireAuth middleware
│   ├── routes/
│   │   ├── auth.js           # /auth/* Discord OAuth2 routes
│   │   ├── stories.js        # /api/stories CRUD
│   │   └── tags.js           # /api/tags
│   ├── .env                  # Real secrets — never commit
│   ├── .env.example          # Template for all env vars
│   └── server.js             # Express entry point
├── frontend/
│   ├── src/
│   │   ├── components/       # Navbar.vue, StoryCard.vue, TagFilter.vue
│   │   ├── router/index.js   # Vue Router + auth guard
│   │   ├── stores/           # Pinia: auth.js, stories.js
│   │   ├── views/            # HomeView, StoryDetailView, UploadView
│   │   ├── App.vue
│   │   ├── main.js
│   │   └── style.css         # Tailwind v4 + global component classes
│   └── vite.config.js
├── nginx.conf                 # Nginx config template
├── storyshare.service         # systemd service unit
└── DEPLOY.md                  # Production deployment guide (Chinese)
```

---

## Build & Dev Commands

### Backend

```bash
cd backend

# Install dependencies
npm install

# Development (nodemon auto-restart)
npm run dev          # nodemon server.js

# Production
npm start            # node server.js

# Syntax check a file (no test runner exists)
node --check server.js
node --check routes/stories.js
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Development server (port 5173, proxies /api and /auth to localhost:3000)
npm run dev

# Production build → frontend/dist/
npm run build

# Preview production build locally
npm run preview
```

### No Test Framework

There are **no tests** in this project. Neither `jest`, `vitest`, nor any other testing library is installed. Do not reference test commands. If adding tests, install `vitest` in the relevant sub-project and add a `"test": "vitest"` script.

### No Linter / Formatter

There is no ESLint, Prettier, or TypeScript config. There is no `npm run lint` command. Code style is enforced by convention only (see below).

---

## Environment Variables

Backend reads from `backend/.env`. Never commit this file. See `backend/.env.example` for all required variables:

| Variable               | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `DISCORD_CLIENT_ID`    | Discord application client ID                    |
| `DISCORD_CLIENT_SECRET`| Discord application client secret               |
| `DISCORD_REDIRECT_URI` | Must match exactly what is set in Discord portal |
| `SESSION_SECRET`       | Secret for express-session cookie signing        |
| `FRONTEND_URL`         | e.g. `http://localhost:5173` in dev              |
| `PORT`                 | Backend port (default `3000`)                    |
| `NODE_ENV`             | `development` or `production`                    |
| `HTTP_PROXY`           | Optional: `http://127.0.0.1:10808` for CN proxy  |

When `HTTP_PROXY` is set, `server.js` injects an `HttpsProxyAgent` (v5, CJS) into the passport-discord oauth2 instance via `discordStrategy._oauth2.setAgent(agent)`.

---

## Code Style Guidelines

### Language & Module System

- **Backend**: CommonJS throughout — always use `require()` / `module.exports`. Do **not** use `import`/`export` in any backend file.
- **Frontend**: ES Modules (`"type": "module"` in `frontend/package.json`) — always use `import`/`export`.
- **No TypeScript** — all files are plain `.js` / `.vue`.
- **UI text and code comments are in Chinese (zh-CN)**. Continue this convention for any new UI strings and inline comments.

### Imports Order (Backend)

1. Node built-ins (`path`, `querystring`)
2. Third-party packages (`express`, `passport`, `better-sqlite3`)
3. Local modules (`./db/init`, `./routes/auth`)

No blank lines between groups is the existing convention, though a blank line before local imports is acceptable.

### Vue Components (Frontend)

- Always use `<script setup>` Composition API — never Options API.
- Single-File Components: `<script setup>` → `<template>` → `<style>` (scoped styles are rare; prefer Tailwind utility classes).
- Props defined with `defineProps()`, emits with `defineEmits()`.
- Composable logic goes in `src/composables/` (currently empty — use it for reusable logic).

### Naming Conventions

| Thing               | Convention                        | Example                     |
| ------------------- | --------------------------------- | --------------------------- |
| Vue components      | PascalCase filename + name        | `StoryCard.vue`             |
| Vue views           | PascalCase + `View` suffix        | `HomeView.vue`              |
| Pinia stores        | camelCase file, `use*Store` export| `useAuthStore`              |
| Backend route files | camelCase                         | `stories.js`                |
| DB columns          | snake_case                        | `author_id`, `created_at`   |
| JS variables/funcs  | camelCase                         | `fetchStories`, `activeTag` |
| Constants           | UPPER_SNAKE_CASE                  | `PORT`, `NODE_ENV`          |
| CSS classes         | Tailwind utilities + kebab-case component classes in `style.css` |

### Error Handling

**Backend:**
- Route handlers use `try/catch` around all DB operations.
- On error, return JSON: `res.status(500).json({ error: '服务器内部错误' })`.
- Auth errors return `401`: `res.status(401).json({ error: 'Unauthorized', message: '请先登录' })`.
- Validation errors return `400` with a descriptive `error` string in Chinese.
- Log errors with `console.error('[Module] description:', err)` using a bracketed module tag.

**Frontend:**
- Pinia store actions catch fetch errors and set a store-level `error` ref.
- Views read `store.error` and display user-facing messages in Chinese.
- Never `throw` from a store action; always handle and surface via state.

### Database Access (Backend)

- All DB access is **synchronous** via `better-sqlite3` prepared statements.
- Always call `getDb()` at the top of each route handler — never store the `db` reference in module scope inside routes.
- Wrap multi-step writes (insert story + insert tags) in `db.transaction()`.
- Never interpolate values into SQL strings — always use `?` placeholders.

### Tailwind CSS (Frontend)

- Tailwind v4 is configured entirely via `@tailwindcss/vite` plugin — there is no `tailwind.config.js`.
- Custom component classes (`.btn-primary`, `.card`, `.input`, `.tag-badge`, `.page-container`, etc.) are defined in `src/style.css` using `@layer components { @apply ... }`.
- Add new reusable utility classes to `src/style.css`, not as inline `class` attributes in templates.
- The `@tailwindcss/typography` plugin is available via the `.prose` class for Markdown rendering.

### API Conventions

- All API routes are prefixed `/api/` (stories, tags).
- Auth routes use `/auth/` prefix.
- Successful list responses return `{ data: [...], pagination: { page, limit, total, totalPages } }`.
- Successful single-item responses return `{ data: { ... } }`.
- All error responses return `{ error: '<message in Chinese>' }`.

---

## Key Architectural Notes

- **Production mode**: `server.js` detects `NODE_ENV=production` and serves `frontend/dist/` as static files with an SPA fallback (`*` → `index.html`). In dev, the Vite dev server handles the frontend and proxies API calls.
- **Session**: `express-session` with an in-memory store (dev). For production, consider `connect-sqlite3` or `better-sqlite3-session-store`.
- **Proxy for CN network**: The `HTTP_PROXY` env var injects an agent into the Discord OAuth2 token exchange. This is required in mainland China development environments. `https-proxy-agent` must remain at **v5.x** (CJS-compatible) — do not upgrade to v6+.
- **Express 5**: The project uses Express 5 (`^5.2.1`). Async route handlers do not need explicit `try/catch` for unhandled promise rejections (Express 5 forwards them to the error handler), but explicit handling is still used for clarity.
