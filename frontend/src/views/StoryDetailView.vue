<template>
  <div class="flex-1 page-container py-10 max-w-4xl">
    <!-- Back button -->
    <button
      @click="$router.back()"
      class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-700 transition-colors duration-200 mb-8 cursor-pointer group"
    >
      <svg class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      返回列表
    </button>

    <!-- Loading skeleton -->
    <div v-if="loading" class="animate-pulse">
      <div class="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div class="flex gap-2 mb-6">
        <div class="h-5 w-16 bg-violet-100 rounded-full"></div>
        <div class="h-5 w-12 bg-violet-100 rounded-full"></div>
      </div>
      <div class="flex items-center gap-3 mb-8 pb-6 border-b border-gray-100">
        <div class="w-10 h-10 bg-gray-200 rounded-full"></div>
        <div>
          <div class="h-4 bg-gray-200 rounded w-24 mb-1.5"></div>
          <div class="h-3 bg-gray-100 rounded w-20"></div>
        </div>
      </div>
      <div class="space-y-3">
        <div v-for="i in 6" :key="i" class="h-4 bg-gray-100 rounded" :class="i % 3 === 0 ? 'w-2/3' : 'w-full'"></div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center py-20">
      <div class="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
        <svg class="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p class="text-red-600 font-medium mb-2">{{ error }}</p>
      <RouterLink to="/" class="btn-secondary">返回首页</RouterLink>
    </div>

    <!-- Story content -->
    <article v-else-if="story">
      <!-- Tags -->
      <div v-if="story.tags?.length" class="flex flex-wrap gap-2 mb-4">
        <RouterLink
          v-for="tag in story.tags"
          :key="tag"
          :to="`/?tag=${encodeURIComponent(tag)}`"
          class="tag-badge"
        >{{ tag }}</RouterLink>
      </div>

      <!-- Title -->
      <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 leading-tight">
        {{ story.title }}
      </h1>

      <!-- Author info -->
      <div class="flex items-center justify-between flex-wrap gap-4 pb-6 mb-8 border-b border-gray-100">
        <div class="flex items-center gap-3">
          <img
            :src="story.author.avatar"
            :alt="story.author.username"
            class="w-11 h-11 rounded-full border-2 border-violet-100 object-cover"
          />
          <div>
            <p class="font-semibold text-gray-800">{{ story.author.username }}</p>
            <time class="text-sm text-gray-400" :datetime="story.created_at">
              发布于 {{ formatFullDate(story.created_at) }}
            </time>
          </div>
        </div>

        <!-- Delete button (own story) -->
        <button
          v-if="authStore.isLoggedIn && authStore.user?.id === story.author.id"
          @click="confirmDelete"
          class="btn-danger text-sm"
          :disabled="deleting"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          {{ deleting ? '删除中…' : '删除故事' }}
        </button>
      </div>

      <!-- Markdown content -->
      <div
        class="prose prose-violet prose-lg max-w-none
               prose-headings:font-bold prose-headings:text-gray-900
               prose-p:text-gray-700 prose-p:leading-relaxed
               prose-a:text-violet-600 prose-a:no-underline hover:prose-a:underline
               prose-blockquote:border-violet-400 prose-blockquote:text-gray-600
               prose-code:text-violet-700 prose-code:bg-violet-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
               prose-pre:bg-gray-900 prose-pre:text-gray-100
               prose-img:rounded-xl
               prose-hr:border-violet-100"
        v-html="renderedContent"
      ></div>
    </article>

    <!-- Delete confirmation modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeleteModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showDeleteModal = false"></div>
          <div class="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 class="text-lg font-bold text-gray-900 mb-2">确认删除</h3>
            <p class="text-gray-500 text-sm mb-6">删除后无法恢复，确认要删除这篇故事吗？</p>
            <div class="flex gap-3">
              <button @click="showDeleteModal = false" class="btn-secondary flex-1">取消</button>
              <button @click="handleDelete" class="btn-danger flex-1" :disabled="deleting">
                {{ deleting ? '删除中…' : '确认删除' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useAuthStore } from '@/stores/auth'
import { useStoriesStore } from '@/stores/stories'

const props = defineProps({ id: { type: String, required: true } })

const authStore = useAuthStore()
const storiesStore = useStoriesStore()
const router = useRouter()

const story = ref(null)
const loading = ref(true)
const error = ref(null)
const showDeleteModal = ref(false)
const deleting = ref(false)

const renderedContent = computed(() => {
  if (!story.value?.content) return ''
  const raw = marked.parse(story.value.content, { breaks: true, gfm: true })
  return DOMPurify.sanitize(raw)
})

function formatFullDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function confirmDelete() {
  showDeleteModal.value = true
}

async function handleDelete() {
  deleting.value = true
  try {
    await storiesStore.deleteStory(parseInt(props.id))
    showDeleteModal.value = false
    router.push('/')
  } catch (e) {
    alert(e.message || '删除失败')
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  try {
    story.value = await storiesStore.fetchStory(props.id)
  } catch (e) {
    error.value = e.message || '故事不存在或已被删除'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
