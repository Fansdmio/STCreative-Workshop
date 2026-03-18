<template>
  <div class="min-h-screen flex flex-col" style="background-color: #FFFBF0;">
    <!-- 手绘背景装饰涂鸦 -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true" style="z-index: 0;">
      <!-- 大色块光晕装饰（无紫色） -->
      <div class="absolute -top-16 -left-16 w-64 h-64 rounded-full opacity-20"
           style="background: radial-gradient(circle, #F97316, transparent); animation: blob-pulse 6s ease-in-out infinite;"></div>
      <div class="absolute top-1/3 -right-20 w-80 h-80 rounded-full opacity-15"
           style="background: radial-gradient(circle, #EC4899, transparent); animation: blob-pulse 8s ease-in-out infinite 2s;"></div>
      <div class="absolute bottom-1/4 -left-10 w-56 h-56 rounded-full opacity-15"
           style="background: radial-gradient(circle, #06B6D4, transparent); animation: blob-pulse 7s ease-in-out infinite 1s;"></div>
      <div class="absolute -bottom-10 right-1/4 w-72 h-72 rounded-full opacity-15"
           style="background: radial-gradient(circle, #EAB308, transparent); animation: blob-pulse 9s ease-in-out infinite 3s;"></div>
      <div class="absolute top-2/3 left-1/2 w-48 h-48 rounded-full opacity-10"
           style="background: radial-gradient(circle, #22C55E, transparent); animation: blob-pulse 10s ease-in-out infinite 4s;"></div>

      <!-- 手绘涂鸦 SVG 装饰 -->
      <svg class="absolute top-24 left-8 opacity-20 w-20 h-20" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: float-up 5s ease-in-out infinite;">
        <path d="M10 40 Q20 10 40 20 Q60 30 70 15 Q65 35 50 45 Q35 55 40 70 Q25 60 10 40Z" stroke="#F97316" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg class="absolute top-1/2 right-12 opacity-20 w-16 h-16" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: float-up 6s ease-in-out infinite 1.5s;">
        <circle cx="32" cy="32" r="22" stroke="#06B6D4" stroke-width="2.5" fill="none" stroke-dasharray="8 4"/>
        <circle cx="32" cy="32" r="10" stroke="#06B6D4" stroke-width="2" fill="none"/>
      </svg>
      <svg class="absolute bottom-32 left-1/4 opacity-15 w-14 h-14" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: float-up 7s ease-in-out infinite 2s;">
        <path d="M28 6 L52 50 L4 50Z" stroke="#22C55E" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg class="absolute top-1/4 left-1/3 opacity-10 w-12 h-12" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: wiggle 3s ease-in-out infinite;">
        <path d="M8 8 L40 8 L40 40 L8 40 Z" stroke="#EAB308" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6 3"/>
      </svg>
      <!-- 涂鸦小星星 -->
      <svg class="absolute top-16 right-1/3 opacity-25 w-8 h-8" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: float-up 4s ease-in-out infinite 0.5s;">
        <path d="M16 4 L18.5 13 L28 13 L20 19 L23 28 L16 22 L9 28 L12 19 L4 13 L13.5 13 Z" stroke="#EC4899" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg class="absolute bottom-48 right-1/3 opacity-20 w-6 h-6" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: float-up 5s ease-in-out infinite 2.5s;">
        <path d="M16 4 L18.5 13 L28 13 L20 19 L23 28 L16 22 L9 28 L12 19 L4 13 L13.5 13 Z" stroke="#F97316" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <!-- 涂鸦螺旋 -->
      <svg class="absolute bottom-1/3 right-8 opacity-15 w-10 h-10" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: float-up 8s ease-in-out infinite 1s;">
        <path d="M20 20 Q30 10 25 5 Q15 0 10 10 Q5 20 15 25 Q25 30 30 20 Q35 10 28 6" stroke="#EAB308" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
    </div>

    <!-- 主内容 -->
    <div style="position: relative; z-index: 1;" class="flex flex-col min-h-screen">
      <Navbar />
      <main class="flex-1 flex flex-col">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import Navbar from '@/components/Navbar.vue'
import { useAuthStore } from '@/stores/auth'
import { useWorkshopStore } from '@/stores/workshop'

const authStore = useAuthStore()
const workshopStore = useWorkshopStore()

onMounted(async () => {
  // 初始化认证状态（从 localStorage 恢复 JWT token 或验证 session）
  await authStore.init()
  
  // 检测是否从 ST 扩展打开（iframe 或弹窗模式），立即初始化消息监听
  // 必须在应用启动时就设置监听器，否则会错过扩展发送的 st_extension_opener 消息
  const isInIframe = window.parent && window.parent !== window
  const hasOpener = window.opener && window.opener !== window
  if (isInIframe || hasOpener) {
    console.log('[App] 检测到扩展模式，初始化 postMessage 监听器...')
    await workshopStore.initStExtensionMode()
  }
})
</script>
