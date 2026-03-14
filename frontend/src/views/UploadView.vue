<template>
  <div class="flex-1 page-container py-10 max-w-3xl">
    <!-- Back -->
    <button
      @click="$router.back()"
      class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-700 transition-colors duration-200 mb-8 cursor-pointer group"
    >
      <svg class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      返回列表
    </button>

    <div class="bg-white rounded-2xl border border-violet-100 shadow-sm p-6 sm:p-8">
      <h1 class="text-2xl font-bold text-gray-900 mb-1">发布新故事</h1>
      <p class="text-sm text-gray-500 mb-8">内容支持 Markdown 格式</p>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Title -->
        <div>
          <label for="title" class="block text-sm font-semibold text-gray-700 mb-1.5">
            标题 <span class="text-red-500">*</span>
          </label>
          <input
            id="title"
            v-model="form.title"
            type="text"
            placeholder="给你的故事起个好标题…"
            maxlength="200"
            class="input"
            :class="{ 'ring-2 ring-red-300 border-red-300': errors.title }"
            required
          />
          <div class="flex justify-between mt-1">
            <p v-if="errors.title" class="text-xs text-red-500">{{ errors.title }}</p>
            <p v-else class="text-xs text-gray-400">最多 200 字</p>
            <p class="text-xs text-gray-400">{{ form.title.length }}/200</p>
          </div>
        </div>

        <!-- Tags -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">
            标签 <span class="text-gray-400 font-normal text-xs">（最多 10 个，回车/逗号添加）</span>
          </label>
          <div class="flex flex-wrap gap-2 mb-2">
            <span
              v-for="(tag, index) in form.tags"
              :key="tag"
              class="tag-badge gap-1.5"
            >
              {{ tag }}
              <button
                type="button"
                @click="removeTag(index)"
                class="hover:text-red-500 transition-colors duration-150 cursor-pointer"
                :aria-label="`删除标签 ${tag}`"
              >
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </span>
          </div>
          <input
            v-model="tagInput"
            type="text"
            placeholder="输入标签名，回车或逗号确认"
            class="input"
            :disabled="form.tags.length >= 10"
            @keydown.enter.prevent="addTag"
            @keydown.comma.prevent="addTag"
            @blur="addTag"
          />
          <!-- Suggested tags -->
          <div v-if="suggestedTags.length" class="flex flex-wrap gap-1.5 mt-2">
            <span class="text-xs text-gray-400 self-center">已有标签：</span>
            <button
              v-for="tag in suggestedTags"
              :key="tag.name"
              type="button"
              class="tag-badge text-xs"
              :class="form.tags.includes(tag.name) ? 'tag-badge-active' : ''"
              @click="toggleSuggestedTag(tag.name)"
            >{{ tag.name }}</button>
          </div>
        </div>

        <!-- Content -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label for="content" class="block text-sm font-semibold text-gray-700">
              故事内容 <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-1.5">
              <button
                type="button"
                @click="previewMode = false"
                class="text-xs px-3 py-1 rounded-lg transition-colors duration-150 cursor-pointer"
                :class="!previewMode ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100'"
              >编辑</button>
              <button
                type="button"
                @click="previewMode = true"
                class="text-xs px-3 py-1 rounded-lg transition-colors duration-150 cursor-pointer"
                :class="previewMode ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100'"
              >预览</button>
            </div>
          </div>

          <!-- Editor -->
          <textarea
            v-if="!previewMode"
            id="content"
            v-model="form.content"
            rows="16"
            placeholder="在这里写下你的故事，支持 Markdown 格式…&#10;&#10;例如：&#10;# 标题&#10;**加粗** *斜体*&#10;> 引用&#10;&#10;---"
            class="input font-mono text-sm leading-relaxed resize-y min-h-[300px]"
            :class="{ 'ring-2 ring-red-300 border-red-300': errors.content }"
            required
          ></textarea>

          <!-- Preview -->
          <div
            v-else
            class="min-h-[300px] p-4 rounded-xl border border-violet-200 bg-violet-50/30"
          >
            <div
              v-if="renderedPreview"
              class="prose prose-violet max-w-none prose-sm
                     prose-headings:font-bold prose-p:text-gray-700
                     prose-a:text-violet-600 prose-code:bg-violet-100 prose-code:text-violet-700"
              v-html="renderedPreview"
            ></div>
            <p v-else class="text-gray-400 text-sm italic">暂无内容可预览</p>
          </div>

          <p v-if="errors.content" class="text-xs text-red-500 mt-1">{{ errors.content }}</p>
          <p class="text-xs text-gray-400 mt-1">{{ form.content.length }} 字</p>
        </div>

        <!-- Markdown tips -->
        <details class="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 cursor-pointer">
          <summary class="font-medium select-none">Markdown 语法速查</summary>
          <div class="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono">
            <span># 一级标题</span><span>## 二级标题</span><span>**加粗**</span>
            <span>*斜体*</span><span>> 引用</span><span>`代码`</span>
            <span>- 无序列表</span><span>1. 有序列表</span><span>[链接](url)</span>
            <span>--- 分隔线</span><span>~~删除线~~</span><span>```代码块```</span>
          </div>
        </details>

        <!-- Submit -->
        <div class="flex items-center gap-3 pt-2">
          <button
            type="submit"
            class="btn-primary"
            :disabled="submitting"
          >
            <svg v-if="submitting" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            {{ submitting ? '发布中…' : '发布故事' }}
          </button>
          <button type="button" @click="$router.back()" class="btn-secondary">取消</button>
        </div>

        <!-- Submit error -->
        <p v-if="submitError" class="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl border border-red-100">
          {{ submitError }}
        </p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useStoriesStore } from '@/stores/stories'

const router = useRouter()
const storiesStore = useStoriesStore()

const form = ref({ title: '', content: '', tags: [] })
const tagInput = ref('')
const previewMode = ref(false)
const submitting = ref(false)
const submitError = ref(null)
const errors = ref({})

const suggestedTags = computed(() =>
  storiesStore.tags.filter((t) => t.name.length < 20).slice(0, 15)
)

const renderedPreview = computed(() => {
  if (!form.value.content) return ''
  const raw = marked.parse(form.value.content, { breaks: true, gfm: true })
  return DOMPurify.sanitize(raw)
})

function addTag() {
  const raw = tagInput.value.replace(/,/g, '').trim()
  if (!raw) return
  if (form.value.tags.length >= 10) return
  if (!form.value.tags.includes(raw)) {
    form.value.tags.push(raw)
  }
  tagInput.value = ''
}

function removeTag(index) {
  form.value.tags.splice(index, 1)
}

function toggleSuggestedTag(name) {
  const idx = form.value.tags.indexOf(name)
  if (idx >= 0) {
    form.value.tags.splice(idx, 1)
  } else if (form.value.tags.length < 10) {
    form.value.tags.push(name)
  }
}

function validate() {
  errors.value = {}
  if (!form.value.title.trim()) errors.value.title = '标题不能为空'
  else if (form.value.title.trim().length > 200) errors.value.title = '标题不能超过 200 字'
  if (!form.value.content.trim()) errors.value.content = '内容不能为空'
  return Object.keys(errors.value).length === 0
}

async function handleSubmit() {
  if (!validate()) return
  submitting.value = true
  submitError.value = null
  try {
    const result = await storiesStore.createStory({
      title: form.value.title.trim(),
      content: form.value.content.trim(),
      tags: form.value.tags,
    })
    router.push(`/story/${result.id}`)
  } catch (e) {
    submitError.value = e.message || '发布失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

// Load tags for suggestions
storiesStore.fetchTags()
</script>
