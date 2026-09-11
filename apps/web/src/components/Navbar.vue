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
  <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
    <div class="container py-3 flex items-center justify-between gap-4">
      <!-- 品牌 Logo 与主题 -->
      <div class="flex items-center gap-3 cursor-pointer" @click="emit('refresh')">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-red-700 via-red-800 to-amber-800 text-white flex items-center justify-center font-bold text-lg shadow-md border border-red-500/30 flex-shrink-0">
          🏃
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight flex items-center gap-1.5">
              <span>一步一善 · 经典红色路</span>
            </h1>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 tracking-wider">
              公益健步拉练
            </span>
          </div>
          <p class="text-xs text-slate-500 hidden sm:block">10 支代表队自主组建 · 队内投票推选队长</p>
        </div>
      </div>

      <!-- 中间微型统计胶囊 (在桌面端展示) -->
      <div v-if="snapshot" class="hidden lg:flex items-center gap-4 text-xs text-slate-600 bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200">
        <div>在职员工 <strong class="text-slate-900 font-semibold">{{ snapshot.statistics.totalCompanyEmployees }}</strong> 人</div>
        <span class="text-slate-300">•</span>
        <div>已组队 <strong class="text-red-700 font-semibold">{{ snapshot.statistics.totalMembers }}</strong> 人</div>
        <span class="text-slate-300">•</span>
        <div>待组队 <strong class="text-amber-700 font-semibold">{{ snapshot.statistics.unassignedCount }}</strong> 人</div>
        <span class="text-slate-300">•</span>
        <div>组队率 <strong class="text-slate-900 font-semibold">{{ snapshot.statistics.registrationRate }}%</strong></div>
      </div>

      <!-- 右侧个人状态与操作 -->
      <div class="flex items-center gap-2.5">
        <!-- 仅管理员显示管理员设置与导出名册按钮 -->
        <template v-if="me?.user?.isAdmin">
          <button
            class="btn btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1 hover:border-red-400 hover:text-red-700 transition"
            @click="emit('open-admin-settings')"
            title="打开系统管理员设置中心"
          >
            <span>⚙️ 管理员设置</span>
          </button>
          <button
            class="btn btn-secondary text-xs px-2.5 py-1.5"
            @click="downloadExcel"
            title="管理员导出当前报名花名册 Excel"
          >
            <span>📊 导出名册</span>
          </button>
        </template>

        <div v-if="me?.user" class="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div class="text-right">
            <div class="flex items-center justify-end gap-1.5">
              <span class="text-sm font-semibold text-slate-800">{{ me.user.displayName }}</span>
              <span v-if="me.user.isAdmin" class="text-[10px] bg-amber-100 text-amber-800 font-medium px-1.5 rounded">管理员</span>
            </div>
            <div class="text-[11px] text-slate-500 flex items-center justify-end gap-1.5">
              <template v-if="me.myTeam">
                <span class="text-red-700 font-medium">第 {{ me.myTeam.id }} 队 ({{ me.myTeam.name }})</span>
                <button
                  class="text-[10px] text-red-600 hover:text-red-800 hover:underline cursor-pointer font-normal"
                  @click="emit('leave-team')"
                  title="退出当前队伍以重选其他队伍"
                >
                  [退出队伍]
                </button>
              </template>
              <span v-else class="text-amber-600 font-medium">未加入队伍</span>
            </div>
          </div>

          <button
            class="btn btn-ghost text-xs px-2 py-1 text-slate-400 hover:text-slate-700"
            @click="logout"
            title="退出当前账号"
          >
            退出
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
