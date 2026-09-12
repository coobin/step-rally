<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { MeResponse, SnapshotData } from '../types.ts'

const props = defineProps<{
  me: MeResponse | null
  snapshot: SnapshotData | null
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'leave-team'): void
  (e: 'open-admin-settings'): void
  (e: 'open-login'): void
}>()

const showAdminMenu = ref(false)
const avatarMenuRef = ref<HTMLElement | null>(null)

function handleAvatarClick() {
  if (props.me?.user?.isAdmin) {
    showAdminMenu.value = !showAdminMenu.value
  }
}

function handleClickOutside(event: MouseEvent) {
  if (avatarMenuRef.value && !avatarMenuRef.value.contains(event.target as Node)) {
    showAdminMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

function onOpenAdminSettings() {
  showAdminMenu.value = false
  emit('open-admin-settings')
}

function onDownloadExcel() {
  showAdminMenu.value = false
  downloadExcel()
}

function downloadExcel() {
  window.location.href = '/api/v1/export/excel'
}

function logout() {
  window.location.href = '/api/v1/auth/logout'
}
</script>

<template>
  <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
    <div class="container py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-4">
      <!-- 品牌 Logo 与主题 -->
      <div class="flex items-center gap-2.5 sm:gap-3 cursor-pointer flex-shrink-0" @click="emit('refresh')">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-red-700 via-red-800 to-amber-800 text-white flex items-center justify-center font-bold text-lg shadow-md border border-red-500/30 flex-shrink-0">
          🏃
        </div>
        <div class="whitespace-nowrap">
          <div class="flex items-center gap-1.5 sm:gap-2">
            <h1 class="text-sm sm:text-base md:text-lg font-black text-slate-900 tracking-tight leading-tight">
              {{ snapshot?.title || '荣耀征程 · 团队拉练' }}
            </h1>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 tracking-wider">
              团队竞技
            </span>
          </div>
          <p class="text-[11px] text-slate-500 hidden sm:block mt-0.5 max-w-[280px] truncate">
            {{ snapshot?.theme || '大型团队竞技与拉练争霸赛' }}
          </p>
        </div>
      </div>

      <!-- 中间微型统计胶囊 (超宽大屏展示，严格不折行) -->
      <div
        v-if="snapshot"
        class="hidden xl:flex items-center gap-3 text-xs bg-slate-50/90 px-3.5 py-1.5 rounded-full border border-slate-200/90 whitespace-nowrap flex-shrink-0 shadow-2xs"
      >
        <span class="flex items-center gap-1 text-slate-600">
          <span class="text-slate-400">名单总数</span>
          <strong class="text-slate-900 font-bold font-mono">{{ snapshot.statistics.totalCompanyEmployees }}</strong>人
        </span>
        <span class="text-slate-300">•</span>
        <span class="flex items-center gap-1 text-slate-600">
          <span class="text-slate-400">已组队</span>
          <strong class="text-red-700 font-bold font-mono">{{ snapshot.statistics.totalMembers }}</strong>人
        </span>
        <span class="text-slate-300">•</span>
        <span class="flex items-center gap-1 text-slate-600">
          <span class="text-slate-400">待组队</span>
          <strong class="text-amber-700 font-bold font-mono">{{ snapshot.statistics.unassignedCount }}</strong>人
        </span>
        <span class="text-slate-300">•</span>
        <span class="flex items-center gap-1 text-slate-600">
          <span class="text-slate-400">组队率</span>
          <strong class="text-slate-900 font-bold font-mono">{{ snapshot.statistics.registrationRate }}%</strong>
        </span>
      </div>

      <!-- 右侧用户状态与操作 (未登录显示登录按钮，已登录显示头像与身份) -->
      <div v-if="me?.user" class="flex items-center gap-2 sm:gap-3 flex-shrink-0 pl-2 sm:pl-3">
        <!-- 用户身份卡片与管理下拉菜单 -->
        <div class="relative flex items-center gap-2" ref="avatarMenuRef">
          <!-- 头像按钮：普通用户无反应(cursor-default)，管理员可点击(cursor-pointer + 齿轮角标) -->
          <button
            type="button"
            :class="[
              'w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shadow-2xs flex-shrink-0 transition-all select-none relative',
              me.user.isAdmin
                ? 'bg-gradient-to-br from-amber-100 via-amber-50 to-amber-200 text-amber-900 border-amber-300 hover:ring-2 hover:ring-amber-400/80 hover:shadow-md cursor-pointer active:scale-95'
                : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 border-slate-300/80 cursor-default'
            ]"
            :title="me.user.isAdmin ? '管理员菜单 (点击打开)' : me.user.displayName"
            @click="handleAvatarClick"
          >
            {{ me.user.displayName.slice(0, 1) }}
            <!-- 管理员专属角标 -->
            <span
              v-if="me.user.isAdmin"
              class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-600 text-white rounded-full flex items-center justify-center text-[8px] shadow-xs border border-white"
              title="管理员"
            >
              ⚙️
            </span>
          </button>

          <!-- 个人名称与队伍状态 -->
          <div class="flex flex-col text-left whitespace-nowrap">
            <!-- 第一行：姓名 + 管理员标 -->
            <div class="flex items-center gap-1.5 leading-tight">
              <span class="text-xs sm:text-sm font-bold text-slate-800">{{ me.user.displayName }}</span>
              <span
                v-if="me.user.isAdmin"
                class="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded border border-amber-200/60 cursor-pointer hover:bg-amber-200 transition"
                title="点击展开管理员选项"
                @click="handleAvatarClick"
              >
                管理员
              </span>
            </div>

            <!-- 第二行：队伍状态与退队操作 -->
            <div class="flex items-center gap-1.5 mt-0.5 text-[11px] leading-tight">
              <template v-if="me.myTeam">
                <span
                  class="font-medium text-red-700 max-w-[120px] sm:max-w-[160px] truncate"
                  :title="`第 ${me.myTeam.id} 队 (${me.myTeam.name})`"
                >
                  第{{ me.myTeam.id }}队 · {{ me.myTeam.name }}
                </span>
                <button
                  class="text-[10px] text-slate-400 hover:text-red-600 hover:underline cursor-pointer"
                  @click="emit('leave-team')"
                  title="退出当前队伍以重选其他队伍"
                >
                  [退队]
                </button>
              </template>
              <span v-else class="text-amber-600 font-medium">未加入队伍</span>
            </div>
          </div>

          <!-- 管理员下拉选项菜单 (仅管理员且展开时显示) -->
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <div
              v-if="showAdminMenu && me.user.isAdmin"
              class="absolute left-0 top-full mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-50 text-xs overflow-hidden divide-y divide-slate-100"
            >
              <div class="px-3 py-1 text-[11px] text-slate-400 font-medium">
                管理员操作
              </div>
              <div class="py-0.5">
                <button
                  type="button"
                  class="w-full text-left px-3 py-2 flex items-center gap-2 text-slate-700 hover:bg-red-50 hover:text-red-700 transition font-medium cursor-pointer"
                  @click="onOpenAdminSettings"
                >
                  <span class="text-sm">⚙️</span>
                  <span>管理员设置</span>
                </button>
                <button
                  type="button"
                  class="w-full text-left px-3 py-2 flex items-center gap-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition font-medium cursor-pointer"
                  @click="onDownloadExcel"
                >
                  <span class="text-sm">📊</span>
                  <span>导出名册</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- 退出登录按钮 -->
        <button
          class="text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-2 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1 ml-0.5"
          @click="logout"
          title="退出当前账号登录"
        >
          <span>退出</span>
        </button>
      </div>

      <!-- 未登录时显示登录 / 报名按钮 -->
      <div v-else class="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95"
          @click="emit('open-login')"
        >
          <span>👤</span>
          <span>队员登录 / 报名</span>
        </button>
      </div>
    </div>
  </header>
</template>
