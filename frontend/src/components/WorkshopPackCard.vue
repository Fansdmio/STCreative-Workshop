<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkshopStore } from '@/stores/workshop'
import { useAuthStore } from '@/stores/auth'
import ConfirmModal from '@/components/ConfirmModal.vue'

const props = defineProps({
  pack: {
    type: Object,
    required: true,
  },
})

const router = useRouter()
const workshopStore = useWorkshopStore()
const authStore = useAuthStore()

const isOwner = computed(() => authStore.user && authStore.user.id === props.pack.author.id)

// 订阅确认弹窗状态
const showSubConfirm = ref(false)

async function handleLike(e) {
  e.stopPropagation()
  if (!authStore.isLoggedIn) {
    authStore.loginWithDiscord()
    return
  }
  await workshopStore.toggleLike(props.pack.id)
}

function handleSubscribe(e) {
  e.stopPropagation()
  if (!authStore.isLoggedIn) {
    authStore.loginWithDiscord()
    return
  }
  // 取消订阅：无需确认，直接执行
  if (props.pack.is_subscribed) {
    workshopStore.toggleSubscribe(props.pack)
    return
  }
  // 订阅：弹出确认框
  showSubConfirm.value = true
}

async function confirmSubscribe() {
  showSubConfirm.value = false
  await workshopStore.toggleSubscribe(props.pack)
}

function cancelSubscribe() {
  showSubConfirm.value = false
}

function goToDetail() {
  router.push({ name: 'workshop-pack-detail', params: { packId: props.pack.id } })
}
</script>

<template>
  <div
    class="card flex flex-col gap-3 p-5 cursor-pointer"
    @click="goToDetail"
  >
    <!-- 作者 -->
    <div class="flex items-center gap-2">
      <img
        :src="pack.author.avatar"
        :alt="pack.author.username"
        class="w-7 h-7 rounded-full object-cover flex-shrink-0"
        style="border: 2px solid #FDBA74;"
      />
      <span class="text-xs font-semibold truncate" style="color: #A8A29E; font-family: 'Nunito', sans-serif;">
        {{ pack.author.display_name || pack.author.username }}
      </span>
      <span v-if="isOwner" class="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style="background: #FFF7ED; color: #EA580C; border: 1.5px solid #FDBA74;">
        我的
      </span>
    </div>

    <!-- 标题 -->
    <h3
      class="font-bold text-base leading-snug line-clamp-2"
      style="font-family: 'Fredoka', sans-serif; color: #431407;"
    >
      {{ pack.title }}
    </h3>

    <!-- 描述 -->
    <p
      v-if="pack.description"
      class="text-sm line-clamp-2 flex-1"
      style="color: #78716C; font-family: 'Nunito', sans-serif;"
    >
      {{ pack.description }}
    </p>
    <div v-else class="flex-1"></div>

    <!-- Tags -->
    <div v-if="pack.tags && pack.tags.length" class="flex flex-wrap gap-1.5">
      <span
        v-for="tag in pack.tags"
        :key="tag"
        class="tag-badge"
      >
        {{ tag }}
      </span>
    </div>

    <!-- 底部元数据 -->
    <div class="flex items-center justify-between mt-1 flex-wrap gap-2">
      <!-- 条目数 -->
      <span class="text-xs" style="color: #A8A29E; font-family: 'Nunito', sans-serif;">
        {{ pack.entry_count }} 条条目
      </span>

      <!-- 点赞 + 订阅按钮 -->
      <div class="flex items-center gap-2">
        <!-- 点赞 -->
        <button
          class="btn-action-like flex items-center gap-1 px-2.5 py-1 rounded-full transition-all duration-150 text-xs font-bold"
          :style="pack.is_liked
            ? 'background:#FFF7ED; color:#EA580C; border:2px solid #F97316; box-shadow:2px 2px 0 #F97316;'
            : 'background:#FFFBF0; color:#A8A29E; border:2px solid #E7E5E4; box-shadow:2px 2px 0 #E7E5E4;'"
          @click="handleLike"
          :title="pack.is_liked ? '取消点赞' : '点赞'"
        >
          <svg class="like-icon w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          {{ pack.like_count }}
        </button>

        <!-- 订阅 -->
        <button
          class="btn-action-sub flex items-center gap-1 px-2.5 py-1 rounded-full transition-all duration-150 text-xs font-bold"
          :style="pack.is_subscribed
            ? 'background:#F0FDF4; color:#16A34A; border:2px solid #22C55E; box-shadow:2px 2px 0 #22C55E;'
            : 'background:#FFFBF0; color:#A8A29E; border:2px solid #E7E5E4; box-shadow:2px 2px 0 #E7E5E4;'"
          @click="handleSubscribe"
          :title="pack.is_subscribed ? '取消订阅' : '订阅'"
        >
          <svg class="sub-icon w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22c1.1 0 2-.9 2-2H10c0 1.1.9 2 2 2z"/>
            <path d="M18 16V11a6 6 0 0 0-5-5.91V4a1 1 0 0 0-2 0v1.09A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z"/>
          </svg>
          {{ pack.sub_count }}
        </button>
      </div>
    </div>
  </div>

  <!-- 订阅确认弹窗 -->
  <ConfirmModal
    v-if="showSubConfirm"
    title="订阅模组"
    :message="`确定要订阅「<strong>${pack.title}</strong>」吗？`"
    confirm-text="确认订阅"
    cancel-text="取消"
    @confirm="confirmSubscribe"
    @cancel="cancelSubscribe"
  />
</template>
