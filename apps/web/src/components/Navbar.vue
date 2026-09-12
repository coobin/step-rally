<script setup lang="ts">
import type { MeResponse, SnapshotData } from '../types.ts'

defineProps<{
  me: MeResponse | null
  snapshot: SnapshotData | null
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'leave-team'): void
  (e: 'open-admin-settings'): void
}>()

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
              一步一善 · 经典红色路
            </h1>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 tracking-wider">
              公益健步拉练
            </span>
          </div>
          <p class="text-[11px] text-slate-500 hidden md:block mt-0.5">10 支代表队自主组建 · 队内投票推选队长</p>
        </div>
      </div>

      <!-- 中间微型统计胶囊 (超宽大屏展示，严格不折行) -->
      <div
        v-if="snapshot"
        class="hidden xl:flex items-center gap-3 text-xs bg-slate-50/90 px-3.5 py-1.5 rounded-full border border-slate-200/90 whitespace-nowrap flex-shrink-0 shadow-2xs"
      >
        <span class="flex items-center gap-1 text-slate-600">
          <span class="text-slate-400">在职</span>
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

      <!-- 右侧功能操作与用户状态 -->
      <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <!-- 管理员快捷按钮组 -->
        <div v-if="me?.user?.isAdmin" class="flex items-center gap-1.5">
          <button
            class="btn btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1 hover:border-red-400 hover:text-red-700 transition whitespace-nowrap shadow-2xs"
            @click="emit('open-admin-settings')"
            title="打开系统管理员设置中心"
          >
            <span>⚙️</span>
            <span class="hidden sm:inline">管理员设置</span>
          </button>
          <button
            class="btn btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1 hover:border-emerald-400 hover:text-emerald-700 transition whitespace-nowrap shadow-2xs"
            @click="downloadExcel"
            title="管理员导出当前报名花名册 Excel"
          >
            <span>📊</span>
            <span class="hidden sm:inline">导出名册</span>
          </button>
        </div>

        <!-- 用户身份卡片与退出登录 -->
        <div v-if="me?.user" class="flex items-center gap-2 sm:gap-2.5 pl-2 sm:pl-3 border-l border-slate-200">
          <!-- 用户头像与信息 -->
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 border border-slate-300/80 flex items-center justify-center font-bold text-xs shadow-2xs flex-shrink-0">
              {{ me.user.displayName.slice(0, 1) }}
            </div>

            <div class="flex flex-col text-left whitespace-nowrap">
              <!-- 第一行：姓名 + 管理员标 -->
              <div class="flex items-center gap-1.5 leading-tight">
                <span class="text-xs sm:text-sm font-bold text-slate-800">{{ me.user.displayName }}</span>
                <span v-if="me.user.isAdmin" class="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded border border-amber-200/60">
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
      </div>
    </div>
  </header>
</template>
