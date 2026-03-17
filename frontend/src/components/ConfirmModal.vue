<script setup>
defineProps({
  // 弹窗标题
  title: {
    type: String,
    default: '确认操作',
  },
  // 正文说明（支持 HTML，使用 v-html 渲染）
  message: {
    type: String,
    default: '',
  },
  // 确认按钮文字
  confirmText: {
    type: String,
    default: '确认',
  },
  // 取消按钮文字
  cancelText: {
    type: String,
    default: '取消',
  },
  // 确认按钮风格：'primary'（橙色）或 'danger'（红色）
  confirmVariant: {
    type: String,
    default: 'primary',
  },
})

const emit = defineEmits(['confirm', 'cancel'])
</script>

<template>
  <!-- 遮罩层（teleport 到 body，避免层叠上下文影响） -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        class="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style="background: rgba(67, 20, 7, 0.35);"
        @click.self="emit('cancel')"
      >
        <!-- 弹窗卡片：手绘便签风格，轻微旋转 -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-90 -translate-y-4"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-90 -translate-y-4"
          appear
        >
          <div
            class="w-full max-w-sm flex flex-col gap-4 p-6"
            style="
              background: #FFFBF0;
              border: 2.5px solid #FDBA74;
              border-radius: 20px;
              box-shadow: 6px 6px 0 #FDBA74;
              transform: rotate(-0.6deg);
            "
          >
            <!-- 标题行（铅笔小图标 + 文字） -->
            <div class="flex items-center gap-2.5">
              <svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <h3
                class="font-bold text-base"
                style="font-family: 'Fredoka', sans-serif; color: #431407;"
              >
                {{ title }}
              </h3>
            </div>

            <!-- 正文 -->
            <p
              class="text-sm leading-relaxed"
              style="font-family: 'Nunito', sans-serif; color: #78716C;"
              v-html="message"
            />

            <!-- 按钮行 -->
            <div class="flex items-center justify-end gap-3 pt-1">
              <!-- 取消 -->
              <button
                class="btn-secondary text-sm"
                @click="emit('cancel')"
              >
                {{ cancelText }}
              </button>

              <!-- 确认（橙色 primary 或红色 danger） -->
              <button
                :class="confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary'"
                class="text-sm"
                @click="emit('confirm')"
              >
                {{ confirmText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
