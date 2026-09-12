<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../api.ts'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
  (e: 'toast', msg: string, type?: 'success' | 'error'): void
}>()

const username = ref('')
const displayName = ref('')
const loading = ref(false)

const presets = [
  { username: 'hekaixuan', displayName: '何恺旋 (管理员)' },
  { username: 'zhangwei', displayName: '张伟' },
  { username: 'wangfang', displayName: '王芳' },
  { username: 'liming', displayName: '李明' },
  { username: 'chenxi', displayName: '陈曦' },
  { username: 'liulei', displayName: '刘磊' },
]

function selectPreset(p: { username: string; displayName: string }) {
  username.value = p.username
  displayName.value = p.displayName.replace(/\s*\(.*\)/, '')
}

async function handleLogin() {
  if (!username.value.trim() || !displayName.value.trim()) {
    emit('toast', '请输入用户名和中文姓名', 'error')
    return
  }
  try {
    loading.value = true
    await api.mockLogin(username.value, displayName.value)
    emit('toast', `已成功以【${displayName.value}】身份登录`, 'success')
    emit('success')
    emit('close')
  } catch (err: any) {
    emit('toast', err.message || '登录失败', 'error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content max-w-md p-6 relative">
      <button
        class="absolute top-4 right-4 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-xs font-bold"
        @click="$emit('close')"
      >
        ✕
      </button>

      <div class="flex items-center gap-2 mb-2">
        <span class="text-2xl">⚡</span>
        <h3 class="text-lg font-bold text-gray-900">快速模拟同事登录</h3>
      </div>
      <p class="text-xs text-gray-500 mb-4">
        输入您的员工姓名与账号即可快捷进入系统体验组队与推选队长。正式生产环境也可使用顶部 OIDC 统一登录。
      </p>

      <!-- 快速填充预设 -->
      <div class="mb-4">
        <label class="block text-xs font-medium text-gray-600 mb-1.5">快捷选择模拟同事：</label>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="p in presets"
            :key="p.username"
            type="button"
            class="text-xs px-2.5 py-1 rounded bg-stone-100 hover:bg-red-50 hover:text-red-700 text-stone-700 border border-stone-200 transition"
            @click="selectPreset(p)"
          >
            {{ p.displayName }}
          </button>
        </div>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">中文姓名：</label>
          <input
            v-model="displayName"
            type="text"
            required
            placeholder="例如：何恺旋 / 张伟"
            class="w-full text-sm px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">员工工号 / 登录账号：</label>
          <input
            v-model="username"
            type="text"
            required
            placeholder="例如：hekaixuan / zhangwei"
            class="w-full text-sm px-3 py-2 border rounded-lg focus:outline-none focus:border-red-500 font-mono"
          />
        </div>

        <button
          type="submit"
          class="btn btn-primary w-full py-2.5 mt-2 font-medium"
          :disabled="loading"
        >
          <span v-if="loading">登录中...</span>
          <span v-else>立即登录系统</span>
        </button>
      </form>
    </div>
  </div>
</template>
