<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { MeResponse, SnapshotData, AdminSettingsData, AdminItem } from '../types.ts'
import { api } from '../api.ts'

const props = defineProps<{
  me: MeResponse | null
  snapshot: SnapshotData | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'refresh'): void
  (e: 'toast', msg: string, type?: 'success' | 'error'): void
}>()

const activeTab = ref<'admins' | 'excluded' | 'teams' | 'rules'>('admins')
const loading = ref(true)
const settings = ref<AdminSettingsData | null>(null)

// 添加管理员
const newAdminUsername = ref('')
const submittingAdmin = ref(false)

// 添加免报人员
const manualUsername = ref('')
const manualDisplayName = ref('')
const manualReason = ref('')
const submittingExcluded = ref(false)

// 队伍独立上限设置与批量调整
const teamCapacities = ref<Record<number, number>>({})
const batchCapacityInput = ref(14)
const savingAllCapacities = ref(false)

// 统计总人数与参训人数
const totalCompanyEmployees = computed(() => {
  return props.snapshot?.statistics.totalCompanyEmployees || 142
})

const excludedCount = computed(() => {
  return settings.value?.excludedUsers.length ?? (props.snapshot?.statistics.excludedCount || 0)
})

const eligibleEmployeesCount = computed(() => {
  return props.snapshot?.statistics.eligibleEmployeesCount || Math.max(0, totalCompanyEmployees.value - excludedCount.value)
})

// 计算各队当前设置的人数上限总和
const totalCapacitySum = computed(() => {
  if (!settings.value?.teams) return 0
  return settings.value.teams.reduce((acc, t) => {
    const val = teamCapacities.value[t.id] !== undefined ? teamCapacities.value[t.id] : t.maxMembers
    return acc + (Number(val) || 0)
  }, 0)
})

// 是否超过总人数（硬限制）
const isOverCapacityLimit = computed(() => {
  return totalCapacitySum.value > totalCompanyEmployees.value
})

// 是否有队伍上限低于当前已有成员人数
const hasUnderflowTeam = computed(() => {
  if (!settings.value?.teams) return false
  return settings.value.teams.some((t) => {
    const limit = teamCapacities.value[t.id] !== undefined ? teamCapacities.value[t.id] : t.maxMembers
    return Number(limit) < t.memberCount
  })
})

async function fetchSettings() {
  try {
    loading.value = true
    const data = await api.getAdminSettings()
    settings.value = data
    if (data?.teams) {
      const caps: Record<number, number> = {}
      for (const t of data.teams) {
        caps[t.id] = t.maxMembers
      }
      teamCapacities.value = caps
    }
    if (data?.activityRules?.maxPerTeam) {
      batchCapacityInput.value = data.activityRules.maxPerTeam
    }
  } catch (err: any) {
    emit('toast', err.message || '加载管理员配置失败', 'error')
  } finally {
    loading.value = false
  }
}

// 快速批量填入相同上限
function applyBatchLimit(num: number) {
  if (!settings.value?.teams) return
  const newCaps: Record<number, number> = { ...teamCapacities.value }
  for (const t of settings.value.teams) {
    newCaps[t.id] = Math.max(num, t.memberCount)
  }
  teamCapacities.value = newCaps
}

// 单队微调增减
function adjustTeamLimit(teamId: number, delta: number) {
  const t = settings.value?.teams.find((item) => item.id === teamId)
  if (!t) return
  const current = teamCapacities.value[teamId] !== undefined ? teamCapacities.value[teamId] : t.maxMembers
  const updated = current + delta
  if (updated < t.memberCount) {
    emit('toast', `【${t.name}】已有 ${t.memberCount} 人，上限不能低于当前人数`, 'error')
    return
  }
  if (updated > 100) return
  teamCapacities.value = { ...teamCapacities.value, [teamId]: updated }
}

// 智能一键对齐应参训总人数（优先保证现有各队人数，自动配齐剩余空位）
function autoAlignToEligible() {
  if (!settings.value?.teams) return
  const targetTotal = eligibleEmployeesCount.value
  const teams = settings.value.teams

  // 先把每队上限设为当前已有队员数
  const newCaps: Record<number, number> = {}
  let currentAssigned = 0
  for (const t of teams) {
    newCaps[t.id] = t.memberCount
    currentAssigned += t.memberCount
  }

  // 剩余可分配的名额分配给各队（平分）
  let remaining = Math.max(0, targetTotal - currentAssigned)
  let idx = 0
  while (remaining > 0) {
    const t = teams[idx % teams.length]
    newCaps[t.id] = (newCaps[t.id] || 0) + 1
    remaining--
    idx++
  }

  teamCapacities.value = newCaps
  emit('toast', `已自动调整各队上限，合计刚好为 ${targetTotal} 人！`, 'success')
}

// 保存所有队伍的独立上限配置
async function handleSaveAllCapacities() {
  if (isOverCapacityLimit.value) {
    emit(
      'toast',
      `队伍合计人数（${totalCapacitySum.value}人）不能超过公司总人数（${totalCompanyEmployees.value}人）`,
      'error',
    )
    return
  }
  if (hasUnderflowTeam.value) {
    emit('toast', '存在队伍设置的上限低于该队现有成员数，请调整后再保存', 'error')
    return
  }

  try {
    savingAllCapacities.value = true
    const res = await api.updateTeamCapacity({ teamCapacities: teamCapacities.value })
    emit('toast', res.message || '各队独立人数上限已保存', 'success')
    await fetchSettings()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '保存队伍上限失败', 'error')
  } finally {
    savingAllCapacities.value = false
  }
}

async function handleAddAdmin() {
  const u = newAdminUsername.value.trim()
  if (!u) {
    emit('toast', '请输入员工工号或登录账号', 'error')
    return
  }
  try {
    submittingAdmin.value = true
    const res = await api.updateAdminUser(u, 'add')
    emit('toast', res.message || `已添加【${u}】为管理员`, 'success')
    newAdminUsername.value = ''
    await fetchSettings()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '添加管理员失败', 'error')
  } finally {
    submittingAdmin.value = false
  }
}

async function handleRemoveAdmin(item: AdminItem) {
  if (item.isBuiltin) {
    emit('toast', '系统内置管理员无法在此移除', 'error')
    return
  }
  if (!confirm(`确定要移除管理员【${item.username}】的管理权限吗？`)) {
    return
  }
  try {
    const res = await api.updateAdminUser(item.username, 'remove')
    emit('toast', res.message || `已移除【${item.username}】管理员权限`, 'success')
    await fetchSettings()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '移除失败', 'error')
  }
}

async function handleAddExcluded() {
  const u = manualUsername.value.trim()
  if (!u) {
    emit('toast', '请输入员工工号或登录账号', 'error')
    return
  }
  try {
    submittingExcluded.value = true
    const res = await api.adminExcludeUser(u, 'exclude', {
      displayName: manualDisplayName.value.trim() || u,
      reason: manualReason.value.trim() || '免参与健步拉练',
    })
    emit('toast', res.message || '已成功设为免报人员', 'success')
    manualUsername.value = ''
    manualDisplayName.value = ''
    manualReason.value = ''
    await fetchSettings()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '设置失败', 'error')
  } finally {
    submittingExcluded.value = false
  }
}

async function handleRestoreExcluded(username: string) {
  try {
    const res = await api.adminExcludeUser(username, 'restore')
    emit('toast', res.message || '已恢复该员工报名资格', 'success')
    await fetchSettings()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '恢复失败', 'error')
  }
}

async function handleResetTeam(teamId: number, teamName: string) {
  const confirmCode = prompt(`⚠️ 危险操作：即将清空重置【${teamName}】的全部队员与选票！\n\n如确认请在下方输入：重置${teamId}`)
  if (confirmCode !== `重置${teamId}`) {
    if (confirmCode !== null) emit('toast', '确认码不一致，已取消重置', 'error')
    return
  }
  try {
    const res = await api.resetTeam(teamId)
    emit('toast', res.message || `【${teamName}】已清空重置`, 'success')
    await fetchSettings()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '重置失败', 'error')
  }
}

function downloadExcel() {
  window.location.href = api.getExportUrl()
}

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
      <!-- 弹窗顶部栏 -->
      <div class="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-red-950 text-white flex items-center justify-between flex-shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-base border border-white/15">
            ⚙️
          </div>
          <div>
            <h3 class="font-bold text-base text-white flex items-center gap-2">
              <span>系统管理员设置中心</span>
              <span class="text-[10px] font-normal px-2 py-0.5 rounded-full bg-red-600/80 text-white">最高权限</span>
            </h3>
            <p class="text-xs text-slate-300 mt-0.5">管理人员权限、免报名名单、战队配置与数据导出</p>
          </div>
        </div>

        <button
          class="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition text-sm"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <!-- 标签页导航栏 -->
      <div class="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs font-semibold overflow-x-auto flex-shrink-0 no-scrollbar">
        <button
          class="px-3.5 py-2.5 border-b-2 transition whitespace-nowrap flex items-center gap-1.5"
          :class="activeTab === 'admins' ? 'border-red-600 text-red-700 bg-white rounded-t-lg' : 'border-transparent text-slate-600 hover:text-slate-900'"
          @click="activeTab = 'admins'"
        >
          <span>👥 管理员名单</span>
          <span v-if="settings" class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
            {{ settings.admins.length }}
          </span>
        </button>

        <button
          class="px-3.5 py-2.5 border-b-2 transition whitespace-nowrap flex items-center gap-1.5"
          :class="activeTab === 'excluded' ? 'border-red-600 text-red-700 bg-white rounded-t-lg' : 'border-transparent text-slate-600 hover:text-slate-900'"
          @click="activeTab = 'excluded'"
        >
          <span>🚫 免报名人员</span>
          <span v-if="settings" class="px-1.5 py-0.2 rounded-full text-[10px] bg-red-100 text-red-800">
            {{ settings.excludedUsers.length }}
          </span>
        </button>

        <button
          class="px-3.5 py-2.5 border-b-2 transition whitespace-nowrap flex items-center gap-1.5"
          :class="activeTab === 'teams' ? 'border-red-600 text-red-700 bg-white rounded-t-lg' : 'border-transparent text-slate-600 hover:text-slate-900'"
          @click="activeTab = 'teams'"
        >
          <span>🚩 战队管理</span>
        </button>

        <button
          class="px-3.5 py-2.5 border-b-2 transition whitespace-nowrap flex items-center gap-1.5"
          :class="activeTab === 'rules' ? 'border-red-600 text-red-700 bg-white rounded-t-lg' : 'border-transparent text-slate-600 hover:text-slate-900'"
          @click="activeTab = 'rules'"
        >
          <span>📊 导出与规则</span>
        </button>
      </div>

      <!-- 弹窗内容区 -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-5">
        <div v-if="loading" class="text-center py-12 text-slate-400 text-xs">
          正在加载管理配置详情...
        </div>

        <!-- Tab 1: 管理员名单设置 -->
        <div v-else-if="activeTab === 'admins'" class="space-y-4">
          <!-- 添加管理员输入条 -->
          <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <h4 class="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <span>➕</span>
              <span>新增系统管理员</span>
            </h4>
            <p class="text-[11px] text-slate-500 mb-2.5">
              被添加为管理员的员工将拥有免报名人员设置、管理员管理、队伍重置与名册导出等权限。
            </p>
            <div class="flex gap-2">
              <input
                v-model="newAdminUsername"
                type="text"
                placeholder="输入员工工号或 LDAP 登录账号（如：zhangsan）"
                class="flex-1 text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-red-600"
                @keydown.enter="handleAddAdmin"
              />
              <button
                class="btn btn-primary text-xs px-4 py-2 font-medium"
                :disabled="submittingAdmin || !newAdminUsername.trim()"
                @click="handleAddAdmin"
              >
                {{ submittingAdmin ? '添加中...' : '确认添加' }}
              </button>
            </div>
          </div>

          <!-- 管理员名单列表 -->
          <div>
            <h4 class="text-xs font-bold text-slate-800 mb-2">当前系统管理员名单 ({{ settings?.admins.length || 0 }})</h4>
            <div class="space-y-2">
              <div
                v-for="item in settings?.admins"
                :key="item.username"
                class="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3 shadow-2xs"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-full bg-red-100 text-red-800 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {{ item.username.slice(0, 1).toUpperCase() }}
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-xs text-slate-900 font-mono">{{ item.username }}</span>
                      <span
                        v-if="item.isBuiltin"
                        class="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded"
                      >
                        系统内置
                      </span>
                      <span
                        v-else
                        class="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded"
                      >
                        手动授权
                      </span>
                      <span
                        v-if="item.username === me?.user?.username?.toLowerCase()"
                        class="text-[10px] bg-red-600 text-white px-1.5 py-0.2 rounded font-medium"
                      >
                        当前登录
                      </span>
                    </div>
                    <div class="text-[11px] text-slate-400 mt-0.5">具备全系统最高管理权限</div>
                  </div>
                </div>

                <div>
                  <button
                    v-if="!item.isBuiltin && item.username !== me?.user?.username?.toLowerCase()"
                    class="text-[11px] px-2.5 py-1 rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-medium transition"
                    @click="handleRemoveAdmin(item)"
                  >
                    移除权限
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: 免报名人员管理 -->
        <div v-else-if="activeTab === 'excluded'" class="space-y-4">
          <!-- 手工添加免报条 -->
          <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <h4 class="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <span>🚫</span>
              <span>手动添加免报名人员</span>
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
              <input
                v-model="manualUsername"
                type="text"
                placeholder="工号/账号 *"
                class="text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-red-600"
              />
              <input
                v-model="manualDisplayName"
                type="text"
                placeholder="员工姓名 (选填)"
                class="text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-red-600"
              />
              <input
                v-model="manualReason"
                type="text"
                placeholder="免报原因 (选填，如出差/产假)"
                class="text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-red-600"
              />
            </div>
            <div class="flex justify-end">
              <button
                class="btn btn-primary text-xs px-4 py-1.5 font-medium"
                :disabled="submittingExcluded || !manualUsername.trim()"
                @click="handleAddExcluded"
              >
                {{ submittingExcluded ? '设置中...' : '确认添加为免报人员' }}
              </button>
            </div>
          </div>

          <!-- 免报名人员列表 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs font-bold text-slate-800">
                已设免报名人员 ({{ settings?.excludedUsers.length || 0 }})
              </h4>
              <span class="text-[11px] text-slate-400">免报人员不计入参赛应报基数</span>
            </div>

            <div v-if="settings?.excludedUsers.length === 0" class="text-center py-8 text-xs text-slate-400">
              暂无免报名人员，全员均需参与组队。
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="item in settings?.excludedUsers"
                :key="item.username"
                class="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {{ item.displayName.slice(0, 1) }}
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-bold text-xs text-slate-900">{{ item.displayName }}</span>
                      <span class="text-[11px] text-slate-400 font-mono">({{ item.username }})</span>
                      <span class="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                        {{ item.reason || '免报' }}
                      </span>
                    </div>
                    <div class="text-[11px] text-slate-400 mt-0.5 truncate">
                      <span>{{ item.department || '未设部门' }}</span>
                      <span class="mx-1">·</span>
                      <span>{{ new Date(item.excludedAt).toLocaleDateString() }} 由 {{ item.excludedBy || '系统' }} 设置</span>
                    </div>
                  </div>
                </div>

                <button
                  class="text-[11px] px-2.5 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition whitespace-nowrap"
                  @click="handleRestoreExcluded(item.username)"
                >
                  ↩ 恢复资格
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: 战队管理与独立人数上限设置 -->
        <div v-else-if="activeTab === 'teams'" class="space-y-4">
          <!-- 统计与校验大看板 -->
          <div class="p-4 bg-gradient-to-r from-slate-50 via-amber-50/40 to-slate-50 rounded-xl border border-slate-200 shadow-2xs">
            <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <h4 class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>⚡</span>
                <span>各队独立人数上限设置</span>
              </h4>
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border"
                  :class="isOverCapacityLimit ? 'bg-red-100 text-red-800 border-red-300' : 'bg-amber-100 text-amber-900 border-amber-300'"
                >
                  各队上限合计: {{ totalCapacitySum }} / {{ totalCompanyEmployees }} 人
                </span>
              </div>
            </div>

            <!-- 人数统计指标条 -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
              <div class="p-2 bg-white rounded-lg border border-slate-200/80">
                <span class="text-slate-400 text-[10px] block">公司在职总人数</span>
                <span class="font-bold text-slate-800 font-mono text-sm">{{ totalCompanyEmployees }} 人</span>
              </div>
              <div class="p-2 bg-white rounded-lg border border-slate-200/80">
                <span class="text-slate-400 text-[10px] block">免报名人员</span>
                <span class="font-bold text-amber-700 font-mono text-sm">{{ excludedCount }} 人</span>
              </div>
              <div class="p-2 bg-white rounded-lg border border-slate-200/80">
                <span class="text-slate-400 text-[10px] block">实际应参训总人数</span>
                <span class="font-bold text-emerald-700 font-mono text-sm">{{ eligibleEmployeesCount }} 人</span>
              </div>
              <div class="p-2 bg-white rounded-lg border border-slate-200/80">
                <span class="text-slate-400 text-[10px] block">当前上限总和</span>
                <span class="font-bold font-mono text-sm" :class="isOverCapacityLimit ? 'text-red-700' : 'text-blue-700'">
                  {{ totalCapacitySum }} 人
                </span>
              </div>
            </div>

            <!-- 规则校验提示横幅 -->
            <div
              v-if="isOverCapacityLimit"
              class="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-bold flex items-center gap-2 mb-3"
            >
              <span>⚠️</span>
              <span>
                队伍合计人数（{{ totalCapacitySum }}人）已超过公司总人数（{{ totalCompanyEmployees }}人）！队伍合计人数不能超过总人数，请调低部分队伍人数上限后再保存。
              </span>
            </div>
            <div
              v-else-if="totalCapacitySum > eligibleEmployeesCount"
              class="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3"
            >
              <div class="flex items-center gap-1.5">
                <span>💡</span>
                <span>
                  当前各队上限合计为 {{ totalCapacitySum }} 人，超过实际可参训人数（{{ eligibleEmployeesCount }}人，{{ excludedCount }}人免报）。若要达成全部队满员，建议上限总和设为 {{ eligibleEmployeesCount }} 人。
                </span>
              </div>
              <button
                class="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded text-[11px] whitespace-nowrap transition cursor-pointer flex-shrink-0"
                @click="autoAlignToEligible"
              >
                ⚡ 一键对齐参训人数 ({{ eligibleEmployeesCount }}人)
              </button>
            </div>
            <div
              v-else
              class="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2 mb-3 font-medium"
            >
              <span>✅</span>
              <span>各队人数上限总和为 {{ totalCapacitySum }} 人，完全符合总人数限制要求。</span>
            </div>

            <!-- 快捷批量操作工具 -->
            <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70">
              <span class="text-xs text-slate-500 font-medium">快速批量填入:</span>
              <button
                v-for="num in [12, 13, 14, 15]"
                :key="num"
                class="text-xs px-2.5 py-1 rounded-lg border bg-white hover:bg-slate-100 hover:border-slate-300 text-slate-700 font-medium transition cursor-pointer"
                @click="applyBatchLimit(num)"
                :title="`将所有队伍统一预设为 ${num} 人`"
              >
                全部 {{ num }} 人
              </button>

              <div class="flex items-center gap-1.5 ml-auto">
                <input
                  v-model.number="batchCapacityInput"
                  type="number"
                  min="1"
                  max="100"
                  class="w-16 text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:border-red-600"
                />
                <button
                  class="text-xs px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-lg transition cursor-pointer"
                  @click="applyBatchLimit(batchCapacityInput)"
                >
                  应用到各队
                </button>
              </div>
            </div>
          </div>

          <!-- 各小队独立人数上限调节面板 -->
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold text-slate-800">10 支代表队独立人数上限设置</h4>
            <span class="text-[11px] text-slate-400">点击 +/- 调节各队容量，上限不可低于该队现有队员数</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              v-for="team in settings?.teams"
              :key="team.id"
              class="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between gap-2.5 shadow-2xs hover:border-slate-300 transition"
            >
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <span>第 {{ team.id }} 队 · {{ team.name }}</span>
                    <span
                      v-if="team.memberCount >= (teamCapacities[team.id] ?? team.maxMembers)"
                      class="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 font-bold px-1.5 py-0.2 rounded"
                    >
                      已满员
                    </span>
                    <span
                      v-else
                      class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium px-1.5 py-0.2 rounded"
                    >
                      余 {{ (teamCapacities[team.id] ?? team.maxMembers) - team.memberCount }} 席
                    </span>
                  </div>
                  <div class="text-[11px] text-slate-400 mt-1">
                    当前已有成员: <strong class="text-slate-700 font-mono">{{ team.memberCount }}</strong> 人
                  </div>
                </div>

                <button
                  class="text-[10px] px-2 py-1 rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition cursor-pointer"
                  :disabled="team.memberCount === 0"
                  :class="{ 'opacity-50 cursor-not-allowed': team.memberCount === 0 }"
                  @click="handleResetTeam(team.id, team.name)"
                  title="重置清空本队队员"
                >
                  清空小队
                </button>
              </div>

              <!-- 上限步进调节器 -->
              <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span class="text-xs text-slate-500 font-medium">队伍人数上限:</span>
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    class="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    :disabled="(teamCapacities[team.id] ?? team.maxMembers) <= team.memberCount"
                    @click="adjustTeamLimit(team.id, -1)"
                    :title="(teamCapacities[team.id] ?? team.maxMembers) <= team.memberCount ? `已有 ${team.memberCount} 人，不能更低` : '减少 1 人'"
                  >
                    -
                  </button>

                  <input
                    v-model.number="teamCapacities[team.id]"
                    type="number"
                    :min="team.memberCount"
                    max="100"
                    class="w-16 text-center text-xs py-1 px-1 bg-slate-50 border border-slate-200 rounded-lg font-bold font-mono focus:bg-white focus:outline-none focus:border-red-600"
                    :class="{ 'border-red-400 bg-red-50 text-red-700': (teamCapacities[team.id] ?? team.maxMembers) < team.memberCount }"
                  />

                  <button
                    type="button"
                    class="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center transition cursor-pointer"
                    @click="adjustTeamLimit(team.id, 1)"
                    title="增加 1 人"
                  >
                    +
                  </button>
                  <span class="text-xs text-slate-500 ml-0.5">人</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部统一保存按钮栏 -->
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 sticky bottom-0 z-20 shadow-md">
            <div>
              <div class="text-xs text-slate-700 font-medium">
                各队上限合计:
                <strong class="font-mono text-sm" :class="isOverCapacityLimit ? 'text-red-700 font-bold' : 'text-slate-900 font-bold'">
                  {{ totalCapacitySum }}
                </strong>
                / {{ totalCompanyEmployees }} 人
              </div>
              <div v-if="hasUnderflowTeam" class="text-[11px] text-red-600 font-bold">
                ⚠️ 部分队伍设置的人数低于已有队员数，无法保存
              </div>
              <div v-else-if="isOverCapacityLimit" class="text-[11px] text-red-600 font-bold">
                ⚠️ 队伍合计人数不能超过总人数 ({{ totalCompanyEmployees }}人)
              </div>
              <div v-else class="text-[11px] text-slate-400">
                点击右侧按钮保存生效
              </div>
            </div>

            <button
              class="btn btn-primary text-xs px-5 py-2 font-bold shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="savingAllCapacities || isOverCapacityLimit || hasUnderflowTeam"
              @click="handleSaveAllCapacities"
            >
              {{ savingAllCapacities ? '保存中...' : '💾 保存各队人数设置' }}
            </button>
          </div>
        </div>

        <!-- Tab 4: 导出与规则 -->
        <div v-else-if="activeTab === 'rules'" class="space-y-4">
          <!-- 快捷导出 -->
          <div class="p-4 bg-gradient-to-r from-red-50 to-amber-50 rounded-xl border border-red-200/80 flex items-center justify-between gap-3">
            <div>
              <h4 class="font-bold text-xs text-red-950">全员拉练报名花名册 (Excel)</h4>
              <p class="text-[11px] text-red-800/80 mt-0.5">
                包含《全员报名花名册》、《各小队概况》、《待组队同事名单》以及《免报名人员名单》四个工作表。
              </p>
            </div>
            <button
              class="btn btn-primary text-xs px-4 py-2 font-medium whitespace-nowrap"
              @click="downloadExcel"
            >
              📥 立即导出
            </button>
          </div>

          <!-- 当前活动规则概览 -->
          <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <h4 class="font-bold text-slate-800 mb-2">当前活动基本规则</h4>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-600">
              <div class="p-2 bg-white rounded-lg border border-slate-100">
                <span class="text-slate-400 block text-[10px]">代表队数量</span>
                <span class="font-bold text-slate-800 text-sm">10 支</span>
              </div>
              <div class="p-2 bg-white rounded-lg border border-slate-100">
                <span class="text-slate-400 block text-[10px]">每队人数上限</span>
                <span class="font-bold text-slate-800 text-sm">{{ settings?.activityRules?.maxPerTeam || 15 }} 人</span>
              </div>
              <div class="p-2 bg-white rounded-lg border border-slate-100">
                <span class="text-slate-400 block text-[10px]">每队推荐人数</span>
                <span class="font-bold text-slate-800 text-sm">14 人</span>
              </div>
              <div class="p-2 bg-white rounded-lg border border-slate-100">
                <span class="text-slate-400 block text-[10px]">每日步数挑战</span>
                <span class="font-bold text-slate-800 text-sm">6,000 步</span>
              </div>
              <div class="p-2 bg-white rounded-lg border border-slate-100">
                <span class="text-slate-400 block text-[10px]">个人拉练总步数</span>
                <span class="font-bold text-slate-800 text-sm">42,000 步</span>
              </div>
              <div class="p-2 bg-white rounded-lg border border-slate-100">
                <span class="text-slate-400 block text-[10px]">折合里程目标</span>
                <span class="font-bold text-slate-800 text-sm">29.4 KM</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 弹窗底部栏 -->
      <div class="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end flex-shrink-0">
        <button
          class="btn btn-secondary text-xs px-4 py-1.5"
          @click="emit('close')"
        >
          完成并关闭
        </button>
      </div>
    </div>
  </div>
</template>
