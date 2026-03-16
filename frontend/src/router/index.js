import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  // ── 主页（官网介绍）────────────────────────────────────────
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },

  // ── 创意工坊 ───────────────────────────────────────────────
  {
    path: '/workshop',
    name: 'workshop',
    component: () => import('@/views/WorkshopView.vue'),
  },
  {
    path: '/workshop/new',
    name: 'workshop-pack-new',
    component: () => import('@/views/WorkshopPackEditor.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/workshop/create',
    name: 'workshop-create',
    component: () => import('@/views/WorkshopCreate.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/workshop/:packId',
    name: 'workshop-pack-detail',
    component: () => import('@/views/WorkshopPackDetail.vue'),
    props: true,
  },
  {
    path: '/workshop/:packId/edit',
    name: 'workshop-pack-edit',
    component: () => import('@/views/WorkshopPackEditor.vue'),
    meta: { requiresAuth: true },
    props: true,
  },
  {
    path: '/workshop/:packId/entries/new',
    name: 'workshop-entry-new',
    component: () => import('@/views/WorkshopEntryEditor.vue'),
    meta: { requiresAuth: true },
    props: true,
  },
  {
    path: '/workshop/:packId/entries/:entryId/edit',
    name: 'workshop-entry-edit',
    component: () => import('@/views/WorkshopEntryEditor.vue'),
    meta: { requiresAuth: true },
    props: true,
  },

  // ── 旧路由（保留，不从 Navbar 入口暴露）───────────────────
  {
    path: '/story/:id',
    name: 'story-detail',
    component: () => import('@/views/StoryDetailView.vue'),
    props: true,
  },
  {
    path: '/upload',
    name: 'upload',
    component: () => import('@/views/UploadView.vue'),
    meta: { requiresAuth: true },
  },

  // ── 创作者申请 ────────────────────────────────────────────
  {
    path: '/creator/apply',
    name: 'creator-apply',
    component: () => import('@/views/CreatorApplyView.vue'),
    meta: { requiresAuth: true },
  },

  // ── 管理后台（自行管理鉴权，无需 requiresAuth） ───────────
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/AdminView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0, behavior: 'smooth' }
  },
})

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    const authStore = useAuthStore()
    if (!authStore.initialized) {
      await authStore.fetchMe()
    }
    if (!authStore.isLoggedIn) {
      return { name: 'workshop', query: { login: 'required' } }
    }
  }
})

export default router
