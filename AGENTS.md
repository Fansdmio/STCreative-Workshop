# AGENTS.md — SillyTavern Creative Workshop

Coding-agent instructions for this repository. Read this file in full before making any changes.

---

## Project Overview

A SillyTavern worldbook workshop platform with Discord OAuth2 login. Users browse/subscribe to worldbook entry packs; subscriptions are injected directly into SillyTavern via a companion extension.

| Layer     | Stack |
|-----------|-------|
| Backend   | Node.js 20, Express 5, better-sqlite3, Passport + passport-discord |
| Frontend  | Vue 3 (`<script setup>`), Vite 8, Pinia 3, Vue Router 4, Tailwind CSS v4 |
| Database  | SQLite (WAL mode) — auto-created at `backend/db/stories.db` |
| Auth      | Discord OAuth2 only; session cookie (`connect.sid`); no JWT |
| Extension | `st-extension/` — SillyTavern extension that opens the workshop in a popup and proxies TavernHelper calls |

Not a monorepo — `backend/` and `frontend/` are independent Node projects with separate `package.json` and `node_modules/`. No root-level `package.json`.

---

## Directory Structure

```
STCreativeWorkshop/
├── backend/
│   ├── db/init.js              # SQLite schema + getDb() singleton; migrations at bottom
│   ├── middleware/auth.js      # requireAuth middleware
│   ├── routes/
│   │   ├── auth.js             # /auth/* Discord OAuth2 + /auth/me
│   │   ├── stories.js          # /api/stories CRUD (legacy)
│   │   ├── tags.js             # /api/tags (legacy)
│   │   └── workshop.js         # /api/workshop — workshops, packs, entries, like/subscribe
│   ├── .env                    # Real secrets — NEVER commit
│   ├── .env.example            # Env var template
│   └── server.js               # Express entry point
├── frontend/src/
│   ├── components/             # ConfirmModal, Navbar, WorkshopPackCard, WorkshopEntryCard, StoryCard, TagFilter
│   ├── config/sections.js      # TAG_GROUPS, DEFAULT_TAGS, localStorage worldbook helpers
│   ├── router/index.js         # Vue Router; auth guard redirects to { name: 'workshop' }
│   ├── stores/                 # Pinia: auth.js, stories.js, workshop.js
│   ├── views/                  # HomeView, WorkshopView, WorkshopPackDetail, WorkshopPackEditor,
│   │                           # WorkshopEntryEditor, WorkshopCreate, WorkshopEdit,
│   │                           # ProfileView, CreatorApplyView, AdminView
│   ├── style.css               # Tailwind v4 + @layer component classes
│   └── main.js
├── st-extension/               # SillyTavern extension (vanilla JS, no build step)
│   ├── index.js                # Extension entry; opens popup, relays TavernHelper calls
│   ├── manifest.json
│   └── style.css
└── @types/                     # Global JS type stubs
```

---

## Build & Dev Commands

### Backend
```bash
cd backend
npm install
npm run dev        # nodemon server.js — auto-restart, port 3000
npm start          # node server.js — production

# Syntax check (no test runner exists):
node --check server.js
node --check routes/workshop.js
node --check db/init.js
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # Vite dev server — port 5173, proxies /api & /auth → localhost:3000
npm run build      # Production build → frontend/dist/
npm run preview    # Preview built output locally
```

**There are no tests and no linter.** Do not reference `npm test` or `npm run lint`.
To add tests, install `vitest` in the relevant sub-project and add `"test": "vitest"` to its scripts.

---

## Environment Variables (`backend/.env`)

| Variable                | Description |
|-------------------------|-------------|
| `DISCORD_CLIENT_ID`     | Discord app client ID |
| `DISCORD_CLIENT_SECRET` | Discord app client secret |
| `DISCORD_REDIRECT_URI`  | Must match Discord portal exactly |
| `SESSION_SECRET`        | express-session signing secret |
| `FRONTEND_URL`          | e.g. `http://localhost:5173` in dev |
| `PORT`                  | Backend port (default `3000`) |
| `NODE_ENV`              | `development` or `production` |
| `HTTP_PROXY`            | Optional: `http://127.0.0.1:10808` for CN proxy |

`HTTP_PROXY` patches passport-discord via `discordStrategy._oauth2.setAgent(agent)` using `https-proxy-agent` v5 (CJS).  
**Do not upgrade `https-proxy-agent` to v6+** — it is ESM-only and will break `require()`.

---

## Code Style

### Language & Modules
- **Backend**: CommonJS only — `require()` / `module.exports`. Never `import`/`export`.
- **Frontend**: ES Modules — `import`/`export` only.
- **No TypeScript** — plain `.js` / `.vue` files.
- **All UI text and code comments must be in Chinese (zh-CN).**

### Backend Import Order
1. Node built-ins (`path`, `querystring`)
2. Third-party packages (`express`, `passport`, `better-sqlite3`)
3. Local modules (`../db/init`, `../middleware/auth`)

### Vue Components
- Always `<script setup>` Composition API — never Options API.
- SFC block order: `<script setup>` → `<template>` → `<style>`.
- Use `defineProps()` / `defineEmits()`. Place reusable logic in `src/composables/`.
- Import order inside `<script setup>`: Vue core → vue-router/pinia → local components → stores → config/utils.

### Naming Conventions
| Thing | Convention | Example |
|-------|------------|---------|
| Vue components | PascalCase | `WorkshopPackCard.vue` |
| Vue views | PascalCase + `View` suffix | `HomeView.vue` |
| Pinia stores | camelCase file + `use*Store` export | `useWorkshopStore` |
| Backend route files | camelCase | `workshop.js` |
| DB columns | snake_case | `author_id`, `created_at` |
| JS vars/functions | camelCase | `fetchPacks`, `workshopSlug` |
| Constants | UPPER_SNAKE_CASE | `TAG_GROUPS`, `PORT` |

### Design Language
- Background: `#FFFBF0` (cream). Primary: `#F97316` (orange). Danger: `#EF4444`.
- Fonts: `'Fredoka'` for headings/titles, `'Nunito'` for body/labels.
- Hand-drawn aesthetic: `border-radius: 16px`, `box-shadow: 3px 3px 0 <color>`, dashed borders.
- Define new reusable styles in `src/style.css` under `@layer components`. Avoid long inline `class` strings.

### Error Handling
**Backend:**
- Wrap all DB operations in `try/catch`.
- `500` → `res.status(500).json({ error: '服务器内部错误' })`
- `401` → `res.status(401).json({ error: 'Unauthorized', message: '请先登录' })`
- `400` → `res.status(400).json({ error: '<具体中文描述>' })`
- Log with: `console.error('[Module] description:', err)`

**Frontend:**
- Store actions catch all errors and set a `error` ref. Never `throw` from a store action.
- Views display `store.error` as user-facing Chinese messages.

### Database Access
- All DB access is **synchronous** (`better-sqlite3`). Use prepared statements with `?` placeholders.
- Call `getDb()` at the top of each route handler — never cache `db` at module scope in routes.
- Multi-step writes use `db.transaction()`.
- Schema changes go at the **bottom** of `db/init.js` inside `try/catch` migration guards.

### API Conventions
- API prefix: `/api/`. Auth prefix: `/auth/`.
- List: `{ data: [...], pagination: { page, limit, total, totalPages } }`
- Single item: `{ data: { ... } }`
- Errors: `{ error: '<Chinese message>' }`
- Workshop packs list uses `{ packs: [...], pagination: { ... } }` (not `data`).

### Tags
- Only preset tags from `TAG_GROUPS` in `config/sections.js` are allowed — no custom input.
- `DEFAULT_TAGS` is the flat array for validation or legacy use.

---

## Key Architecture Notes

- **Routing — home vs workshop**: `{ name: 'home' }` is `/` (landing page). `{ name: 'workshop' }` is `/workshop` (pack browser). Back buttons in `ProfileView` and `WorkshopCreate` must go to `{ name: 'home' }`.
- **WorkshopView default**: `workshopSlug` defaults to `null` (show all workshops). Do **not** default to `'steampunk'`.
- **Workshop worldbook**: Each workshop has a `worldbook` field (its default target worldbook name). Users can override it per-slug in `localStorage` via `getWorldbookName(slug)` / `saveWorldbookName(slug, name)`. The "恢复默认" button resets to `currentWorkshop.worldbook`.
- **Production**: `NODE_ENV=production` → Express serves `frontend/dist/` as static files with SPA fallback (`/*splat` → `index.html`).
- **Vite base path**: `vite.config.js` sets `base: '/StoryShare/'`. All built asset URLs are relative to this sub-path.
- **SillyTavern integration**: `workshop.js` store detects `window.SillyTavern` (direct iframe) and `window.opener` (extension popup). Subscribe/unsubscribe calls `window.TavernHelper` API to read/write worldbook entries. Gracefully no-ops outside ST.
- **ST extension** (`st-extension/`): Vanilla JS, no build step. Opens the workshop site in a popup and relays `TavernHelper` API calls from the popup back into ST. Edit and test manually.
- **`https-proxy-agent`** must stay at v5 (CJS). v6+ is ESM-only.
- **Known bug**: `WorkshopEntryCard.vue` calls `router.push({ name: 'workshop-edit', ... })` — the correct route name is `workshop-entry-edit`. Fix when touching that component.
