<script setup lang="ts">
import { ref, computed } from 'vue'
import type { LdapEmployee, ExcludedUser, MeResponse } from '../types.ts'

const props = defineProps<{
  employees: LdapEmployee[]
  excludedEmployees?: ExcludedUser[]
  departments: string[]
  me: MeResponse | null
}>()

const emit = defineEmits<{
  (e: 'invite-to-my-team', employee: LdapEmployee): void
  (e: 'exclude-user', employee: { username: string; displayName?: string; department?: string }, reason?: string): void
  (e: 'restore-user', username: string): void
}>()

const activeTab = ref<'unassigned' | 'excluded'>('unassigned')
const searchQuery = ref('')
const selectedDept = ref('全部')

// 设为免报名弹窗状态
const excludeModalTarget = ref<{ username: string; displayName: string; department?: string } | null>(null)
const excludeReason = ref('')

// 手动输入账号设为免报名弹窗
const showManualModal = ref(false)
const manualUsername = ref('')
const manualDisplayName = ref('')
const manualReason = ref('')

const canInvite = computed(() => {
  return Boolean(props.me?.myTeam)
})

const isAdmin = computed(() => {
  return Boolean(props.me?.user?.isAdmin)
})

// 过滤待整装同事
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

// 过滤已免报名同事
const filteredExcluded = computed(() => {
  const list = props.excludedEmployees || []
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return list
  return list.filter((emp) => {
    const matchName = emp.displayName.toLowerCase().includes(query)
    const matchUser = emp.username.toLowerCase().includes(query)
    const matchDept = (emp.department || '').toLowerCase().includes(query)
    const matchReason = (emp.reason || '').toLowerCase().includes(query)
    return matchName || matchUser || matchDept || matchReason
  })
})

function openExcludeModal(target: { username: string; displayName: string; department?: string }) {
  excludeModalTarget.value = target
  excludeReason.value = '免参与健步拉练'
}

function handleConfirmExclude() {
  if (!excludeModalTarget.value) return
  emit('exclude-user', excludeModalTarget.value, excludeReason.value)
  excludeModalTarget.value = null
  excludeReason.value = ''
}

function handleManualExclude() {
  const username = manualUsername.value.trim()
  if (!username) return
  emit('exclude-user', {
    username,
    displayName: manualDisplayName.value.trim() || username,
  }, manualReason.value.trim() || '免参与健步拉练')
  showManualModal.value = false
  manualUsername.value = ''
  manualDisplayName.value = ''
  manualReason.value = ''
}

function handleRestore(username: string) {
  emit('restore-user', username)
}
</script>

<template>
  <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
    <!-- 头部：标签栏与搜索 -->
    <div class="p-4 border-b border-slate-100 bg-slate-50/70">
      <!-- 标签页切换：仅管理员可见免报名标签，普通员工仅展示待整装标题 -->
      <div class="flex items-center justify-between gap-2 mb-3">
        <div v-if="isAdmin" class="inline-flex p-1 bg-slate-200/70 rounded-lg text-xs font-semibold">
          <button
            class="px-3 py-1 rounded-md transition flex items-center gap-1.5"
            :class="activeTab === 'unassigned' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
            @click="activeTab = 'unassigned'"
          >
            <span>👟 待整装</span>
            <span
              class="px-1.5 py-0.2 rounded-full text-[10px]"
              :class="activeTab === 'unassigned' ? 'bg-amber-100 text-amber-800' : 'bg-slate-300/60 text-slate-600'"
            >
              {{ employees.length }}
            </span>
          </button>

          <button
            class="px-3 py-1 rounded-md transition flex items-center gap-1.5"
            :class="activeTab === 'excluded' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
            @click="activeTab = 'excluded'"
          >
            <span>🚫 免报名</span>
            <span
              class="px-1.5 py-0.2 rounded-full text-[10px]"
              :class="activeTab === 'excluded' ? 'bg-red-100 text-red-800' : 'bg-slate-300/60 text-slate-600'"
            >
              {{ (excludedEmployees || []).length }}
            </span>
          </button>
        </div>

        <div v-else class="flex items-center gap-2">
          <span class="text-base">👟</span>
          <h3 class="font-bold text-sm text-slate-900">待整装战友 (未报名)</h3>
        </div>

        <span v-if="!isAdmin" class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
          {{ employees.length }} 位待入列
        </span>

        <!-- 管理员快速添加免报按钮 -->
        <button
          v-if="isAdmin && activeTab === 'excluded'"
          class="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium border border-red-200 transition flex items-center gap-1"
          @click="showManualModal = true"
        >
          <span>+</span>
          <span>添加免报</span>
        </button>
      </div>

      <!-- 搜索输入框 -->
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="activeTab === 'unassigned' ? '搜索姓名 / 工号 / 部门...' : '搜索免报人员 / 原因...'"
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

      <!-- 部门快速筛选胶囊 (仅待整装标签显示) -->
      <div v-if="activeTab === 'unassigned' && departments.length > 0" class="flex gap-1.5 overflow-x-auto mt-2.5 pb-1 text-[11px] no-scrollbar">
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

    <!-- 列表展示区 -->
    <div class="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[620px]">
      <!-- Tab 1: 待整装战友列表 -->
      <template v-if="activeTab === 'unassigned'">
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

          <!-- 动作按钮栏 -->
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <!-- 若当前用户是该同事本人且还没组队 -->
            <span v-if="emp.username === me?.user?.username" class="text-[11px] text-red-700 font-medium">
              👈 请在左侧选择队伍
            </span>

            <!-- 管理员快捷设为免报 -->
            <button
              v-if="isAdmin"
              class="text-[11px] px-2 py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 border border-slate-200 font-medium transition"
              title="将该员工设为免报名人员（不计入参赛基数）"
              @click="openExcludeModal(emp)"
            >
              🚫 免报
            </button>

            <!-- 若当前用户已在队伍中，支持快捷拉入自己队伍 -->
            <button
              v-if="canInvite && emp.username !== me?.user?.username"
              class="btn btn-secondary text-[11px] px-2.5 py-1 hover:border-red-400 hover:bg-red-50 hover:text-red-700 font-medium transition"
              :title="`将 ${emp.displayName} 邀入【${me?.myTeam?.name}】`"
              @click="emit('invite-to-my-team', emp)"
            >
              + 邀入
            </button>
          </div>
        </div>
      </template>

      <!-- Tab 2: 已免报名人员列表 -->
      <template v-else>
        <div v-if="filteredExcluded.length === 0" class="text-center py-10 text-xs text-slate-400">
          {{ searchQuery ? '未找到符合条件的免报人员' : '暂无免报名人员（全员均需参赛）' }}
        </div>

        <div
          v-for="item in filteredExcluded"
          :key="item.username"
          class="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-between gap-2"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {{ item.displayName.slice(0, 1) }}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-semibold text-xs text-slate-800 truncate">{{ item.displayName }}</span>
                <span class="text-[10px] text-slate-400 font-mono">({{ item.username }})</span>
                <span class="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded">
                  {{ item.reason || '免参与' }}
                </span>
              </div>
              <div class="text-[11px] text-slate-400 truncate mt-0.5">
                <span>{{ item.department || '无部门' }}</span>
                <span class="mx-1">·</span>
                <span>{{ new Date(item.excludedAt).toLocaleDateString() }} 设为免报</span>
              </div>
            </div>
          </div>

          <!-- 管理员恢复报名资格按钮 -->
          <div v-if="isAdmin" class="flex-shrink-0">
            <button
              class="text-[11px] px-2.5 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition"
              @click="handleRestore(item.username)"
            >
              ↩ 恢复报名
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- 弹窗 1：设置员工为免报人员 -->
    <div
      v-if="excludeModalTarget"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      @click.self="excludeModalTarget = null"
    >
      <div class="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 border border-slate-200">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <span>🚫</span>
            <span>设为免报名人员</span>
          </h4>
          <button class="text-slate-400 hover:text-slate-600 text-xs" @click="excludeModalTarget = null">✕</button>
        </div>

        <p class="text-xs text-slate-500 mb-3 leading-relaxed">
          将 <strong class="text-slate-900 font-bold">【{{ excludeModalTarget.displayName }}】</strong>（{{ excludeModalTarget.department }}）设为免报名后，该员工将移出待整装名单，且自动扣减参赛应报基数。
        </p>

        <div class="mb-4">
          <label class="block text-xs font-semibold text-slate-700 mb-1.5">免报原因 / 备注</label>
          <input
            v-model="excludeReason"
            type="text"
            placeholder="如：驻外出差、长期病休、产假、特殊岗位等..."
            class="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-red-600 transition"
            maxlength="40"
            @keydown.enter="handleConfirmExclude"
          />
        </div>

        <div class="flex justify-end gap-2 text-xs">
          <button
            class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            @click="excludeModalTarget = null"
          >
            取消
          </button>
          <button
            class="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm transition"
            @click="handleConfirmExclude"
          >
            确认免报
          </button>
        </div>
      </div>
    </div>

    <!-- 弹窗 2：管理员手动按账号添加免报 -->
    <div
      v-if="showManualModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      @click.self="showManualModal = false"
    >
      <div class="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 border border-slate-200">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <span>➕</span>
            <span>手动添加免报名人员</span>
          </h4>
          <button class="text-slate-400 hover:text-slate-600 text-xs" @click="showManualModal = false">✕</button>
        </div>

        <div class="space-y-3 mb-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">员工工号 / 登录账号 *</label>
            <input
              v-model="manualUsername"
              type="text"
              placeholder="例如：zhangsan 或 10086"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-red-600"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">员工姓名 (选填)</label>
            <input
              v-model="manualDisplayName"
              type="text"
              placeholder="例如：张三"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-red-600"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">免报原因 (选填)</label>
            <input
              v-model="manualReason"
              type="text"
              placeholder="例如：借调外派、产假等"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-red-600"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 text-xs">
          <button
            class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            @click="showManualModal = false"
          >
            取消
          </button>
          <button
            class="px-4 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-medium shadow-sm transition disabled:opacity-50"
            :disabled="!manualUsername.trim()"
            @click="handleManualExclude"
          >
            确认添加
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
