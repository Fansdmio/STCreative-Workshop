import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useStoriesStore = defineStore('stories', () => {
  const stories = ref([])
  const tags = ref([])
  const pagination = ref({ total: 0, page: 1, limit: 12, totalPages: 1 })
  const loading = ref(false)
  const error = ref(null)
  const activeTag = ref(null)

  async function fetchStories(page = 1, tag = null) {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams({ page, limit: 12 })
      if (tag) params.set('tag', tag)
      const res = await fetch(`/api/stories?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch stories')
      const data = await res.json()
      stories.value = data.stories
      pagination.value = data.pagination
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchTags() {
    try {
      const res = await fetch('/api/tags', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch tags')
      tags.value = await res.json()
    } catch {
      tags.value = []
    }
  }

  async function fetchStory(id) {
    const res = await fetch(`/api/stories/${id}`, { credentials: 'include' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || '故事不存在')
    }
    return res.json()
  }

  async function createStory(payload) {
    const res = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '发布失败')
    return data
  }

  async function deleteStory(id) {
    const res = await fetch(`/api/stories/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '删除失败')
    stories.value = stories.value.filter((s) => s.id !== id)
    return data
  }

  function setActiveTag(tag) {
    activeTag.value = tag === activeTag.value ? null : tag
  }

  return {
    stories,
    tags,
    pagination,
    loading,
    error,
    activeTag,
    fetchStories,
    fetchTags,
    fetchStory,
    createStory,
    deleteStory,
    setActiveTag,
  }
})
