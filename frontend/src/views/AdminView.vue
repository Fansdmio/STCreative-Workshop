<script setup>
import { ref, onMounted } from 'vue'

// ── 管理员登录状态 ────────────────────────────────────────────────────
const adminLoggedIn = ref(false)
const loginForm = ref({ username: '', password: '' })
const loginError = ref('')
const loginLoading = ref(false)

async function checkLogin() {
  try {
    const res = await fetch('/admin/me', { credentials: 'include' })
    adminLoggedIn.value = res.ok
  } catch {
    adminLoggedIn.value = false
  }
}

async function doLogin() {
  loginError.value = ''
  loginLoading.value = true
  try {
    const res = await fetch('/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm.value),
    })
    const data = await res.json()
    if (res.ok) {
      adminLoggedIn.value = true
      activeTab.value = 'applications'
      loadApplications()
    } else {
      loginError.value = data.error || '登录失败'
    }
  } catch {
    loginError.value = '网络错误，请稍后再试'
  } finally {
    loginLoading.value = false
  }
}

async function doLogout() {
  await fetch('/admin/logout', { method: 'POST', credentials: 'include' })
  adminLoggedIn.value = false
}

// ── Tab 切换 ──────────────────────────────────────────────────────────
const activeTab = ref('applications')

function switchTab(tab) {
  activeTab.value = tab
  if (tab === 'applications') loadApplications()
  else if (tab === 'users') loadUsers()
  else if (tab === 'packs') loadPacks()
}

// ── 申请管理 ──────────────────────────────────────────────────────────
const applications = ref([])
const appFilter = ref('pending')
const appLoading = ref(false)
const reviewModal = ref(null)  // { app, action }
const reviewNote = ref('')
const reviewLoading = ref(false)

async function loadApplications() {
  appLoading.value = true
  try {
    const res = await fetch(`/admin/applications?status=${appFilter.value}`, { credentials: 'include' })
    const data = await res.json()
    applications.value = data.data || []
  } catch {
    applications.value = []
  } finally {
    appLoading.value = false
  }
}

function openReview(app, action) {
  reviewModal.value = { app, action }
  reviewNote.value = ''
}

async function submitReview() {
  if (!reviewModal.value) return
  reviewLoading.value = true
  try {
    const res = await fetch(`/admin/applications/${reviewModal.value.app.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: reviewModal.value.action, note: reviewNote.value }),
    })
    if (res.ok) {
      reviewModal.value = null
      await loadApplications()
    }
  } finally {
    reviewLoading.value = false
  }
}

// ── 用户管理 ──────────────────────────────────────────────────────────
const users = ref([])
const userPage = ref(1)
const userPagination = ref({})
const userQuery = ref('')
const usersLoading = ref(false)

async function loadUsers(page = 1) {
  usersLoading.value = true
  userPage.value = page
  try {
    const q = userQuery.value ? `&q=${encodeURIComponent(userQuery.value)}` : ''
    const res = await fetch(`/admin/users?page=${page}&limit=20${q}`, { credentials: 'include' })
    const data = await res.json()
    users.value = data.data || []
    userPagination.value = data.pagination || {}
  } catch {
    users.value = []
  } finally {
    usersLoading.value = false
  }
}

async function changeRole(userId, role) {
  if (!confirm(`确认将此用户角色改为「${roleLabel(role)}」？`)) return
  await fetch(`/admin/users/${userId}/role`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  await loadUsers(userPage.value)
}

async function deleteUser(userId, username) {
  if (!confirm(`确认删除用户「${username}」？此操作不可恢复，其所有模组也将被删除。`)) return
  await fetch(`/admin/users/${userId}`, { method: 'DELETE', credentials: 'include' })
  await loadUsers(userPage.value)
}

// ── 模组管理 ──────────────────────────────────────────────────────────
const packs = ref([])
const packPage = ref(1)
const packPagination = ref({})
const packQuery = ref('')
const packsLoading = ref(false)

async function loadPacks(page = 1) {
  packsLoading.value = true
  packPage.value = page
  try {
    const q = packQuery.value ? `&q=${encodeURIComponent(packQuery.value)}` : ''
    const res = await fetch(`/admin/packs?page=${page}&limit=20${q}`, { credentials: 'include' })
    const data = await res.json()
    packs.value = data.data || []
    packPagination.value = data.pagination || {}
  } catch {
    packs.value = []
  } finally {
    packsLoading.value = false
  }
}

async function deletePack(packId, title) {
  if (!confirm(`确认删除模组「${title}」？`)) return
  await fetch(`/admin/packs/${packId}`, { method: 'DELETE', credentials: 'include' })
  await loadPacks(packPage.value)
}

// ── 用户详情弹窗 ──────────────────────────────────────────────────────
const userDetail = ref(null)        // null = 关闭；对象 = 展示详情
const userDetailLoading = ref(false)

async function loadUserDetail(userId) {
  userDetailLoading.value = true
  userDetail.value = { loading: true }  // 先打开弹窗显示加载态
  try {
    const res = await fetch(`/admin/users/${userId}/detail`, { credentials: 'include' })
    const data = await res.json()
    if (res.ok) {
      userDetail.value = data.data
    } else {
      userDetail.value = null
    }
  } catch {
    userDetail.value = null
  } finally {
    userDetailLoading.value = false
  }
}

// ── 辅助 ──────────────────────────────────────────────────────────────
const STATUS_MAP = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }
const STATUS_COLOR = {
  pending:  'background:#FEF9C3; color:#854D0E; border-color:#EAB308;',
  approved: 'background:#DCFCE7; color:#14532D; border-color:#22C55E;',
  rejected: 'background:#FEE2E2; color:#991B1B; border-color:#FCA5A5;',
}
function roleLabel(r) {
  return { user: '普通用户', creator: '创作者', admin: '管理员' }[r] || r
}
function roleStyle(r) {
  if (r === 'admin')   return 'background:#FEE2E2; color:#991B1B; border-color:#FCA5A5;'
  if (r === 'creator') return 'background:#DCFCE7; color:#14532D; border-color:#22C55E;'
  return 'background:#F1F5F9; color:#475569; border-color:#CBD5E1;'
}
function avatarUrl(discordId, avatar) {
  if (avatar) return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png`
  return `https://cdn.discordapp.com/embed/avatars/${parseInt(discordId) % 5}.png`
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

onMounted(async () => {
  await checkLogin()
  if (adminLoggedIn.value) loadApplications()
})
</script>

<template>
  <div class="page-container py-8 max-w-5xl">

    <!-- ═══ 未登录：显示登录表单 ═══════════════════════════════════════ -->
    <div v-if="!adminLoggedIn" class="max-w-sm mx-auto mt-16">
      <div class="card p-8 flex flex-col gap-5">
        <div class="text-center">
          <div class="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style="background:#FFF7ED; border:2px solid #FDBA74;">
            <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 class="text-xl font-bold" style="font-family:'Fredoka',sans-serif; color:#9A3412;">管理后台登录</h1>
        </div>
        <div class="flex flex-col gap-3">
          <input v-model="loginForm.username" class="input text-sm" placeholder="用户名" @keyup.enter="doLogin" />
          <input v-model="loginForm.password" class="input text-sm" type="password" placeholder="密码" @keyup.enter="doLogin" />
        </div>
        <div v-if="loginError" class="text-sm rounded-xl px-3 py-2 font-semibold" style="background:#FEF2F2; color:#EF4444; border:1.5px solid #FECACA;">{{ loginError }}</div>
        <button class="btn-primary" :disabled="loginLoading" @click="doLogin">
          {{ loginLoading ? '登录中…' : '登录' }}
        </button>
      </div>
    </div>

    <!-- ═══ 已登录：管理后台 ════════════════════════════════════════════ -->
    <div v-else>
      <!-- 顶栏 -->
      <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 class="text-2xl font-bold" style="font-family:'Fredoka',sans-serif; color:#9A3412;">管理后台</h1>
        <button class="btn-secondary text-sm" @click="doLogout">退出登录</button>
      </div>

      <!-- Tab 导航 -->
      <div class="flex gap-2 mb-6 flex-wrap">
        <button v-for="t in [{k:'applications',l:'申请管理'},{k:'users',l:'用户管理'},{k:'packs',l:'模组管理'}]" :key="t.k"
          class="px-5 py-2 rounded-full font-bold text-sm transition-all duration-150"
          :style="activeTab===t.k ? 'background:#F97316; color:white; box-shadow:3px 3px 0 #C2410C; transform:rotate(-0.5deg);' : 'background:#FFF7ED; color:#78350F; border:2px solid #FDBA74;'"
          @click="switchTab(t.k)">
          {{ t.l }}
        </button>
      </div>

      <!-- ─── 申请管理 ──────────────────────────────────────────────── -->
      <div v-if="activeTab==='applications'">
        <div class="flex gap-2 mb-4 flex-wrap">
          <button v-for="f in [{k:'pending',l:'待审核'},{k:'approved',l:'已通过'},{k:'rejected',l:'已拒绝'},{k:'all',l:'全部'}]" :key="f.k"
            class="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
            :style="appFilter===f.k ? 'background:#431407; color:white;' : 'background:#FFF7ED; color:#78350F; border:1.5px solid #FDBA74;'"
            @click="appFilter=f.k; loadApplications()">
            {{ f.l }}
          </button>
        </div>
        <div v-if="appLoading" class="flex justify-center py-12">
          <div class="w-8 h-8 rounded-full animate-spin" style="border:3px solid #FED7AA; border-top-color:#F97316;"></div>
        </div>
        <div v-else-if="!applications.length" class="text-center py-12 text-sm" style="color:#A8A29E; font-family:'Nunito',sans-serif;">暂无记录</div>
        <div v-else class="flex flex-col gap-3">
          <div v-for="app in applications" :key="app.id" class="card p-4 flex flex-col sm:flex-row sm:items-start gap-4">
            <img :src="app.user.avatar ? avatarUrl(app.user.discord_id, app.user.avatar) : avatarUrl(app.user.discord_id, null)"
              class="w-10 h-10 rounded-full object-cover flex-shrink-0" style="border:2px solid #FDBA74;" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <span class="font-bold text-sm" style="font-family:'Fredoka',sans-serif; color:#431407;">{{ app.user.username }}</span>
                <span class="text-xs px-2 py-0.5 rounded-full border font-bold" :style="STATUS_COLOR[app.status]">{{ STATUS_MAP[app.status] }}</span>
              </div>
              <p class="text-xs mb-2" style="color:#A8A29E; font-family:'Nunito',sans-serif;">申请于 {{ fmtDate(app.applied_at) }}</p>
              <p class="text-sm rounded-xl px-3 py-2" style="background:#FFFBF0; border:1.5px solid #FED7AA; color:#78350F; font-family:'Nunito',sans-serif; white-space:pre-wrap; word-break:break-word;">{{ app.reason }}</p>
              <div v-if="app.platform || app.published_works" class="flex flex-col gap-1 mt-1.5">
                <p v-if="app.platform" class="text-xs" style="color:#78716C; font-family:'Nunito',sans-serif;">
                  <span class="font-bold" style="color:#431407;">发布平台：</span>{{ app.platform }}
                </p>
                <p v-if="app.published_works" class="text-xs" style="color:#78716C; font-family:'Nunito',sans-serif; white-space:pre-wrap; word-break:break-word;">
                  <span class="font-bold" style="color:#431407;">已发布作品：</span>{{ app.published_works }}
                </p>
              </div>
              <p v-if="app.admin_note" class="text-xs mt-1.5" style="color:#EF4444; font-family:'Nunito',sans-serif;">备注：{{ app.admin_note }}</p>
            </div>
            <div v-if="app.status==='pending'" class="flex gap-2 flex-shrink-0">
              <button class="btn-primary text-xs px-3 py-1.5" @click="openReview(app,'approve')">通过</button>
              <button class="btn-danger text-xs px-3 py-1.5" @click="openReview(app,'reject')">拒绝</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── 用户管理 ──────────────────────────────────────────────── -->
      <div v-if="activeTab==='users'">
        <div class="flex gap-2 mb-4">
          <input v-model="userQuery" class="input text-sm flex-1" placeholder="搜索用户名…" @keyup.enter="loadUsers(1)" />
          <button class="btn-secondary text-sm" @click="loadUsers(1)">搜索</button>
        </div>
        <div v-if="usersLoading" class="flex justify-center py-12">
          <div class="w-8 h-8 rounded-full animate-spin" style="border:3px solid #FED7AA; border-top-color:#F97316;"></div>
        </div>
        <div v-else class="flex flex-col gap-3">
          <div v-for="u in users" :key="u.id"
            class="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer hover:brightness-95 transition-all duration-150"
            @click="loadUserDetail(u.id)"
          >
            <img :src="u.avatar ? avatarUrl(u.discord_id, u.avatar) : avatarUrl(u.discord_id, null)"
              class="w-9 h-9 rounded-full object-cover flex-shrink-0" style="border:2px solid #FDBA74;" />
            <div class="flex-1 min-w-0">
              <p class="font-bold text-sm" style="font-family:'Fredoka',sans-serif; color:#431407;">{{ u.username }}</p>
              <p class="text-xs" style="color:#A8A29E; font-family:'Nunito',sans-serif;">注册于 {{ fmtDate(u.created_at) }}</p>
            </div>
            <span class="text-xs px-2.5 py-1 rounded-full border font-bold" :style="roleStyle(u.role)">{{ roleLabel(u.role) }}</span>
            <div class="flex gap-1.5 flex-wrap">
              <button v-if="u.role!=='creator'" class="text-xs px-3 py-1.5 rounded-full font-bold cursor-pointer transition-all" style="background:#DCFCE7; color:#14532D; border:1.5px solid #22C55E;" @click="changeRole(u.id,'creator')">设为创作者</button>
              <button v-if="u.role!=='user'" class="text-xs px-3 py-1.5 rounded-full font-bold cursor-pointer transition-all" style="background:#F1F5F9; color:#475569; border:1.5px solid #CBD5E1;" @click="changeRole(u.id,'user')">重置为普通</button>
              <button class="text-xs px-3 py-1.5 rounded-full font-bold cursor-pointer transition-all" style="background:#FEE2E2; color:#991B1B; border:1.5px solid #FCA5A5;" @click="deleteUser(u.id,u.username)">删除</button>
            </div>
          </div>
        </div>
        <div v-if="userPagination.totalPages>1" class="flex items-center justify-center gap-3 mt-6">
          <button class="btn-secondary text-sm" :disabled="userPage<=1" @click="loadUsers(userPage-1)">上一页</button>
          <span class="text-sm" style="color:#A8A29E; font-family:'Nunito',sans-serif;">{{ userPage }} / {{ userPagination.totalPages }}</span>
          <button class="btn-secondary text-sm" :disabled="userPage>=userPagination.totalPages" @click="loadUsers(userPage+1)">下一页</button>
        </div>
      </div>

      <!-- ─── 模组管理 ──────────────────────────────────────────────── -->
      <div v-if="activeTab==='packs'">
        <div class="flex gap-2 mb-4">
          <input v-model="packQuery" class="input text-sm flex-1" placeholder="搜索模组标题…" @keyup.enter="loadPacks(1)" />
          <button class="btn-secondary text-sm" @click="loadPacks(1)">搜索</button>
        </div>
        <div v-if="packsLoading" class="flex justify-center py-12">
          <div class="w-8 h-8 rounded-full animate-spin" style="border:3px solid #FED7AA; border-top-color:#F97316;"></div>
        </div>
        <div v-else class="flex flex-col gap-3">
          <div v-for="p in packs" :key="p.id" class="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div class="flex-1 min-w-0">
              <p class="font-bold text-sm truncate" style="font-family:'Fredoka',sans-serif; color:#431407;">{{ p.title }}</p>
              <p class="text-xs" style="color:#A8A29E; font-family:'Nunito',sans-serif;">
                {{ p.author.username }} · {{ p.entry_count }} 条目 · {{ p.like_count }} 赞 · {{ p.sub_count }} 订阅 · {{ fmtDate(p.created_at) }}
              </p>
            </div>
            <span class="text-xs px-2.5 py-1 rounded-full border font-bold flex-shrink-0"
              style="background:#FFF7ED;color:#78350F;border-color:#FDBA74;">
              {{ p.workshop_name || p.section || '未知工坊' }}
            </span>
            <button class="btn-danger text-xs px-3 py-1.5 flex-shrink-0" @click="deletePack(p.id,p.title)">删除</button>
          </div>
        </div>
        <div v-if="packPagination.totalPages>1" class="flex items-center justify-center gap-3 mt-6">
          <button class="btn-secondary text-sm" :disabled="packPage<=1" @click="loadPacks(packPage-1)">上一页</button>
          <span class="text-sm" style="color:#A8A29E; font-family:'Nunito',sans-serif;">{{ packPage }} / {{ packPagination.totalPages }}</span>
          <button class="btn-secondary text-sm" :disabled="packPage>=packPagination.totalPages" @click="loadPacks(packPage+1)">下一页</button>
        </div>
      </div>
    </div>

    <!-- ═══ 用户详情弹窗 ══════════════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="userDetail" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.35);" @click.self="userDetail=null">
          <div class="w-full max-w-lg flex flex-col gap-4 max-h-[85vh]" style="background:#FFFBF0; border:2.5px solid #FDBA74; border-radius:20px; box-shadow:6px 6px 0 #FDBA74; overflow:hidden;">

            <!-- 加载态 -->
            <div v-if="userDetail.loading" class="flex items-center justify-center py-16">
              <div class="w-8 h-8 rounded-full animate-spin" style="border:3px solid #FED7AA; border-top-color:#F97316;"></div>
            </div>

            <!-- 内容 -->
            <template v-else>
              <!-- 顶部：用户信息 -->
              <div class="flex items-center gap-4 px-6 pt-6 pb-4" style="border-bottom:1.5px solid #FED7AA;">
                <img :src="userDetail.user.avatar" class="w-12 h-12 rounded-full object-cover flex-shrink-0" style="border:2px solid #FDBA74;" />
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-lg leading-tight truncate" style="font-family:'Fredoka',sans-serif; color:#431407;">{{ userDetail.user.username }}</p>
                  <div class="flex items-center gap-2 mt-1 flex-wrap">
                    <span class="text-xs px-2 py-0.5 rounded-full border font-bold" :style="roleStyle(userDetail.user.role)">{{ roleLabel(userDetail.user.role) }}</span>
                    <span class="text-xs" style="color:#A8A29E; font-family:'Nunito',sans-serif;">注册于 {{ fmtDate(userDetail.user.created_at) }}</span>
                  </div>
                </div>
                <button class="flex-shrink-0 p-1.5 rounded-full transition-colors" style="color:#A8A29E; border:1.5px solid #E7E5E4;" @click="userDetail=null">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <!-- 统计栏 -->
              <div class="flex gap-6 px-6 text-center">
                <div>
                  <p class="text-2xl font-bold" style="font-family:'Fredoka',sans-serif; color:#F97316;">{{ userDetail.packs.length }}</p>
                  <p class="text-xs" style="color:#A8A29E; font-family:'Nunito',sans-serif;">工坊数</p>
                </div>
                <div>
                  <p class="text-2xl font-bold" style="font-family:'Fredoka',sans-serif; color:#F97316;">{{ userDetail.entry_count }}</p>
                  <p class="text-xs" style="color:#A8A29E; font-family:'Nunito',sans-serif;">条目总数</p>
                </div>
              </div>

              <!-- 工坊列表 -->
              <div class="px-6 pb-6 overflow-y-auto flex-1">
                <p class="text-sm font-bold mb-3" style="font-family:'Fredoka',sans-serif; color:#78350F;">工坊列表</p>
                <div v-if="!userDetail.packs.length" class="text-sm text-center py-6" style="color:#A8A29E; font-family:'Nunito',sans-serif;">暂无工坊</div>
                <div v-else class="flex flex-col gap-2">
                  <div v-for="pack in userDetail.packs" :key="pack.id"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style="background:#FFF7ED; border:1.5px solid #FED7AA;"
                  >
                    <div class="flex-1 min-w-0">
                      <p class="font-bold text-sm truncate" style="font-family:'Fredoka',sans-serif; color:#431407;">{{ pack.title }}</p>
                      <p class="text-xs mt-0.5" style="color:#A8A29E; font-family:'Nunito',sans-serif;">
                        {{ pack.entry_count }} 条目 · {{ pack.like_count }} 赞 · {{ pack.sub_count }} 订阅 · {{ fmtDate(pack.created_at) }}
                      </p>
                    </div>
                    <span class="text-xs px-2 py-0.5 rounded-full border font-bold flex-shrink-0"
                      style="background:#FFF7ED;color:#78350F;border-color:#FDBA74;">
                      {{ pack.workshop_name || pack.section || '未知工坊' }}
                    </span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ═══ 审批弹窗 ═════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="reviewModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.35);" @click.self="reviewModal=null">
          <div class="w-full max-w-sm p-6 flex flex-col gap-4" style="background:#FFFBF0; border:2.5px solid #FDBA74; border-radius:20px; box-shadow:6px 6px 0 #FDBA74;">
            <h3 class="font-bold text-lg" style="font-family:'Fredoka',sans-serif; color:#431407;">
              {{ reviewModal.action==='approve' ? '通过申请' : '拒绝申请' }}
            </h3>
            <p class="text-sm" style="color:#78716C; font-family:'Nunito',sans-serif;">
              用户：<strong>{{ reviewModal.app.user.username }}</strong>
            </p>
            <div>
              <label class="block text-sm font-bold mb-1.5" style="font-family:'Fredoka',sans-serif; color:#431407;">
                管理员备注（可选）
              </label>
              <textarea v-model="reviewNote" class="input resize-none text-sm" rows="3"
                :placeholder="reviewModal.action==='approve' ? '欢迎加入…（可不填）' : '请说明拒绝原因…'"
                style="font-family:'Nunito',sans-serif;"></textarea>
            </div>
            <div class="flex gap-3">
              <button v-if="reviewModal.action==='approve'" class="btn-primary flex-1" :disabled="reviewLoading" @click="submitReview">
                {{ reviewLoading ? '处理中…' : '确认通过' }}
              </button>
              <button v-else class="btn-danger flex-1" :disabled="reviewLoading" @click="submitReview">
                {{ reviewLoading ? '处理中…' : '确认拒绝' }}
              </button>
              <button class="btn-secondary flex-1" @click="reviewModal=null">取消</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>
