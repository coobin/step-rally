<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../api.ts'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'login-success'): void
  (e: 'toast', msg: string, type?: 'success' | 'error'): void
}>()

const mode = ref<'name' | 'admin'>('name')
const nameInput = ref('')
const departmentInput = ref('')
const adminPassword = ref('')
const loading = ref(false)

async function handleNameLogin() {
  const name = nameInput.value.trim()
  if (!name) {
    emit('toast', '请输入姓名', 'error')
    return
  }

  try {
    loading.value = true
    const res = await api.loginByName(name, departmentInput.value.trim() || undefined)
    emit('toast', res.message || `欢迎回来，${res.user.displayName}！`, 'success')
    emit('login-success')
    emit('close')
  } catch (err: any) {
    emit('toast', err.message || '登录失败，请确认姓名是否录入名单', 'error')
  } finally {
    loading.value = false
  }
}

async function handleAdminLogin() {
  const pwd = adminPassword.value.trim()
  if (!pwd) {
    emit('toast', '请输入管理员密码', 'error')
    return
  }

  try {
    loading.value = true
    const res = await api.adminLogin(pwd)
    emit('toast', res.message || '管理员验证通过！', 'success')
    emit('login-success')
    emit('close')
  } catch (err: any) {
    emit('toast', err.message || '密码错误，请重试', 'error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
    <div
      class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 transition-all transform animate-scale-in"
      @click.stop
    >
      <!-- 头部渐变栏 -->
      <div class="bg-gradient-to-r from-red-700 via-red-800 to-amber-800 px-6 py-5 text-white flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-xl shadow-inner border border-white/20">
            🏃
          </div>
          <div>
            <h3 class="font-bold text-lg leading-tight">参赛队员登入</h3>
            <p class="text-xs text-red-100/80 mt-0.5">大型团队竞技与拉练争霸赛</p>
          </div>
        </div>
        <button
          type="button"
          class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-base transition cursor-pointer"
          @click="emit('close')"
          title="关闭"
        >
          ✕
        </button>
      </div>

      <!-- 模式切换 Tab -->
      <div class="flex border-b border-slate-100 bg-slate-50/70 p-1 m-4 mb-2 rounded-xl">
        <button
          type="button"
          :class="[
            'flex-1 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5',
            mode === 'name' ? 'bg-white text-red-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
          ]"
          @click="mode = 'name'"
        >
          <span>👤</span>
          <span>队员姓名登录</span>
        </button>
        <button
          type="button"
          :class="[
            'flex-1 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5',
            mode === 'admin' ? 'bg-white text-amber-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
          ]"
          @click="mode = 'admin'"
        >
          <span>🔑</span>
          <span>管理员通道</span>
        </button>
      </div>

      <!-- 表单内容 -->
      <div class="p-6 pt-3">
        <!-- 模式 1: 姓名登录 -->
        <form v-if="mode === 'name'" @submit.prevent="handleNameLogin" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">
              参赛队员姓名 <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <input
                v-model="nameInput"
                type="text"
                placeholder="请输入已录入花名册的真实姓名"
                required
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-red-600/30 focus:border-red-600 transition"
                autofocus
              />
            </div>
            <p class="text-[11px] text-slate-400 mt-1.5">
              提示：只有输入管理员已录入名单的姓名方可登录进入系统组队。
            </p>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">
              所属部门 <span class="text-slate-400 font-normal">(选填，用于重名区分)</span>
            </label>
            <input
              v-model="departmentInput"
              type="text"
              placeholder="如：技术部、市场部（非重名可留空）"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-red-600/30 focus:border-red-600 transition"
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 px-4 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer active:scale-98 mt-2"
          >
            {{ loading ? '验证中...' : '验证姓名并登录 🚀' }}
          </button>
        </form>

        <!-- 模式 2: 管理员密码登录 -->
        <form v-else @submit.prevent="handleAdminLogin" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">
              管理员专属密码 <span class="text-amber-600">*</span>
            </label>
            <input
              v-model="adminPassword"
              type="password"
              placeholder="请输入管理员管理密码"
              required
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
              autofocus
            />
            <p class="text-[11px] text-slate-400 mt-1.5">
              初始管理员密码为：<code class="px-1 py-0.5 bg-slate-100 rounded text-slate-600">admin888</code>
            </p>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 px-4 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer active:scale-98 mt-2"
          >
            {{ loading ? '验证中...' : '管理员登录 ⚙️' }}
          </button>
        </form>
      </div>

      <!-- 底部说明 -->
      <div class="bg-slate-50 border-t border-slate-100 px-6 py-3 text-center text-xs text-slate-400">
        如需批量导入花名册名单，请使用管理员账号登入后台进行 Excel 导入。
      </div>
    </div>
  </div>
</template>
