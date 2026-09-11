<script setup lang="ts">
import { ref, computed } from 'vue'
import type { LdapEmployee, MeResponse } from '../types.ts'

const props = defineProps<{
  employees: LdapEmployee[]
  departments: string[]
  me: MeResponse | null
}>()

const emit = defineEmits<{
  (e: 'invite-to-my-team', employee: LdapEmployee): void
  (e: 'select-employee', employee: LdapEmployee): void
}>()

const searchQuery = ref('')
const selectedDept = ref('全部')

const filteredEmployees = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return props.employees.filter((emp) => {
    // 部门过滤
    if (selectedDept.value !== '全部' && emp.department !== selectedDept.value) {
      return false
    }
    // 关键字搜索
    if (query) {
      const matchName = emp.displayName.toLowerCase().includes(query)
      const matchUser = emp.username.toLowerCase().includes(query)
      const matchDept = emp.department.toLowerCase().includes(query)
      return matchName || matchUser || matchDept
    }
    return true
  })
})

const canInvite = computed(() => {
  return Boolean(props.me?.myTeam)
})
</script>

<template>
  <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
    <!-- 头部与搜索 -->
    <div class="p-4 border-b border-slate-100 bg-slate-50/70">
      <div class="flex items-center justify-between gap-2 mb-2.5">
        <div class="flex items-center gap-2">
          <span class="text-base">👟</span>
          <h3 class="font-bold text-sm text-slate-900">待整装战友 (未报名)</h3>
        </div>
        <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
          {{ employees.length }} 位待入列
        </span>
      </div>

      <!-- 搜索输入框 -->
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索姓名 / 工号 / 部门..."
          class="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-red-600 transition"
        />
        <span class="absolute left-2.5 top-2.5 text-xs text-slate-400">🔍</span>
        <button
          v-if="searchQuery"
          class="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
          @click="searchQuery = ''"
        >
          ✕
        </button>
      </div>

      <!-- 部门快速筛选胶囊 -->
      <div v-if="departments.length > 0" class="flex gap-1.5 overflow-x-auto mt-2.5 pb-1 text-[11px] no-scrollbar">
        <button
          class="px-2.5 py-1 rounded-md transition whitespace-nowrap font-medium"
          :class="selectedDept === '全部' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'"
          @click="selectedDept = '全部'"
        >
          全部 ({{ employees.length }})
        </button>
        <button
          v-for="dept in departments"
          :key="dept"
          class="px-2 py-1 rounded-md transition whitespace-nowrap"
          :class="selectedDept === dept ? 'bg-slate-800 text-white font-medium' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'"
          @click="selectedDept = dept"
        >
          {{ dept }}
        </button>
      </div>
    </div>

    <!-- 同事列表 -->
    <div class="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[620px]">
      <div v-if="filteredEmployees.length === 0" class="text-center py-10 text-xs text-slate-400">
        {{ searchQuery ? '未找到符合条件的同事' : '全员均已完成组队报名！🎉' }}
      </div>

      <div
        v-for="emp in filteredEmployees"
        :key="emp.username"
        class="p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2"
        :class="[
          emp.username === me?.user?.username
            ? 'bg-red-50/60 border-red-200 ring-1 ring-red-300'
            : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50/80',
        ]"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
            {{ emp.displayName.slice(0, 1) }}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="font-semibold text-xs text-slate-900 truncate">{{ emp.displayName }}</span>
              <span v-if="emp.username === me?.user?.username" class="text-[10px] bg-red-600 text-white px-1 rounded font-medium">我</span>
            </div>
            <div class="text-[11px] text-slate-400 truncate">
              <span>{{ emp.department }}</span>
            </div>
          </div>
        </div>

        <!-- 动作按钮 -->
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <!-- 若当前用户是该同事本人且还没组队 -->
          <span v-if="emp.username === me?.user?.username" class="text-[11px] text-red-700 font-medium">
            👈 请在左侧选择队伍
          </span>

          <!-- 若当前用户已在队伍中，支持快捷拉入自己队伍 -->
          <button
            v-else-if="canInvite"
            class="btn btn-secondary text-[11px] px-2.5 py-1 hover:border-red-400 hover:bg-red-50 hover:text-red-700 font-medium transition"
            @click="emit('invite-to-my-team', emp)"
            :title="`将 ${emp.displayName} 邀入【${me?.myTeam?.name}】`"
          >
            + 邀入战队
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
