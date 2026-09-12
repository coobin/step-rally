<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { MeResponse, SnapshotData, AdminSettingsData, AdminItem, RosterUser } from '../types.ts'
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

const activeTab = ref<'roster' | 'teams' | 'rules' | 'excluded' | 'admins'>('roster')
const loading = ref(true)
const settings = ref<AdminSettingsData | null>(null)

// --- 1. 花名册管理状态 ---
const rosterList = ref<RosterUser[]>([])
const rosterSearch = ref('')
const importingExcel = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// 手工单人录入
const manualRosterName = ref('')
const manualRosterDept = ref('')
const manualRosterPhone = ref('')
const manualRosterNote = ref('')
const submittingRoster = ref(false)

// --- 2. 队伍管理状态 ---
const newTeamName = ref('')
const newTeamSlogan = ref('')
const newTeamIcon = ref('🚩')
const newTeamMaxMembers = ref(15)
const creatingTeam = ref(false)

// 队伍独立上限设置与批量调整
const teamCapacities = ref<Record<number, number>>({})
const batchCapacityInput = ref(14)
const savingAllCapacities = ref(false)

// --- 3. 活动配置状态 ---
const activityTitle = ref('')
const activityTheme = ref('')
const activityDailySteps = ref(8000)
const activityKmTarget = ref(35)
const savingActivityConfig = ref(false)

// --- 4. 管理员管理状态 ---
const newAdminUsername = ref('')
const submittingAdmin = ref(false)

// --- 5. 免报人员状态 ---
const manualUsername = ref('')
const manualDisplayName = ref('')
const manualReason = ref('')
const submittingExcluded = ref(false)

// 统计总人数与参训人数
const totalCompanyEmployees = computed(() => {
  if (rosterList.value.length > 0) return rosterList.value.length
  return props.snapshot?.statistics.totalCompanyEmployees || 100
})

// 计算各队当前设置的人数上限总和
const totalCapacitySum = computed(() => {
  if (!settings.value?.teams) return 0
  return settings.value.teams.reduce((acc, t) => {
    const val = teamCapacities.value[t.id] !== undefined ? teamCapacities.value[t.id] : t.maxMembers
    return acc + (Number(val) || 0)
  }, 0)
})

const isOverCapacityLimit = computed(() => {
  if (rosterList.value.length === 0) return false
  return totalCapacitySum.value > totalCompanyEmployees.value
})

const hasUnderflowTeam = computed(() => {
  if (!settings.value?.teams) return false
  return settings.value.teams.some((t) => {
    const limit = teamCapacities.value[t.id] !== undefined ? teamCapacities.value[t.id] : t.maxMembers
    return Number(limit) < t.memberCount
  })
})

const filteredRoster = computed(() => {
  const query = rosterSearch.value.trim().toLowerCase()
  if (!query) return rosterList.value
  return rosterList.value.filter(
    (u) =>
      u.name.toLowerCase().includes(query) ||
      (u.department && u.department.toLowerCase().includes(query)) ||
      (u.phone && u.phone.includes(query)) ||
      (u.note && u.note.toLowerCase().includes(query)),
  )
})

async function fetchRoster() {
  try {
    const res = await api.getRosterList()
    rosterList.value = res.roster || []
  } catch (e) {
    console.warn('拉取花名册异常:', e)
  }
}

async function fetchSettings() {
  try {
    loading.value = true
    const [data] = await Promise.all([
      api.getAdminSettings(),
      fetchRoster(),
    ])
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
    if (props.snapshot) {
      activityTitle.value = props.snapshot.title || ''
      activityTheme.value = props.snapshot.theme || ''
      activityDailySteps.value = props.snapshot.activityRules?.targetStepsDaily || 8000
      activityKmTarget.value = props.snapshot.activityRules?.totalKmTarget || 35
    }
  } catch (err: any) {
    emit('toast', err.message || '加载配置失败', 'error')
  } finally {
    loading.value = false
  }
}

// 触发文件选择
function triggerExcelUpload() {
  fileInputRef.value?.click()
}

// 处理 Excel 上传
async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    importingExcel.value = true
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer
        const bytes = new Uint8Array(arrayBuffer)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        const base64 = btoa(binary)
        const res = await api.importRoster(base64)
        emit('toast', res.message || '名单导入成功！', 'success')
        await fetchRoster()
        emit('refresh')
      } catch (err: any) {
        emit('toast', err.message || '导入解析失败，请检查 Excel 格式', 'error')
      } finally {
        importingExcel.value = false
        if (target) target.value = ''
      }
    }
    reader.readAsArrayBuffer(file)
  } catch (err: any) {
    importingExcel.value = false
    emit('toast', err.message || '读取文件失败', 'error')
  }
}

// 下载花名册模板
function handleDownloadTemplate() {
  window.open(api.getRosterTemplateUrl(), '_blank')
}

// 手动单人录入名单
async function handleAddRoster() {
  const name = manualRosterName.value.trim()
  if (!name) {
    emit('toast', '请输入队员姓名', 'error')
    return
  }

  try {
    submittingRoster.value = true
    const res = await api.addRosterUser({
      name,
      department: manualRosterDept.value.trim() || undefined,
      phone: manualRosterPhone.value.trim() || undefined,
      note: manualRosterNote.value.trim() || undefined,
    })
    emit('toast', res.message || `已录入【${name}】`, 'success')
    manualRosterName.value = ''
    manualRosterDept.value = ''
    manualRosterPhone.value = ''
    manualRosterNote.value = ''
    await fetchRoster()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '录入失败', 'error')
  } finally {
    submittingRoster.value = false
  }
}

// 删除名单单人
async function handleDeleteRoster(u: RosterUser) {
  if (!confirm(`确定要将【${u.name}】从参赛名单中删除吗？若该队员已在队伍中，将同步退出队伍。`)) {
    return
  }
  try {
    const res = await api.deleteRosterUser(u.id || u.name)
    emit('toast', res.message || '删除成功', 'success')
    await fetchRoster()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '删除失败', 'error')
  }
}

// 创建新队伍
async function handleCreateTeam() {
  const name = newTeamName.value.trim()
  if (!name) {
    emit('toast', '请输入队伍名称', 'error')
    return
  }
  try {
    creatingTeam.value = true
    const res = await api.addTeam({
      name,
      slogan: newTeamSlogan.value.trim() || undefined,
      icon: newTeamIcon.value.trim() || '🚩',
      maxMembers: Number(newTeamMaxMembers.value) || 15,
    })
    emit('toast', res.message || '队伍创建成功', 'success')
    newTeamName.value = ''
    newTeamSlogan.value = ''
    await fetchSettings()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '创建队伍失败', 'error')
  } finally {
    creatingTeam.value = false
  }
}

// 删除队伍
async function handleDeleteTeam(team: any) {
  if (!confirm(`确定要解散并删除【${team.name}】吗？若队内已有成员，成员将重置为待组队状态！`)) {
    return
  }
  try {
    const res = await api.deleteTeam(team.id)
    emit('toast', res.message || '队伍已删除', 'success')
    await fetchSettings()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '删除失败', 'error')
  }
}

// 重置队伍成员
async function handleResetTeam(teamId: number, teamName: string) {
  if (!confirm(`确定要清空并重置【${teamName}】的全部队员吗？清空后队员需重新选择加入。`)) {
    return
  }
  try {
    const res = await api.resetTeam(teamId)
    emit('toast', res.message || '队伍已重置', 'success')
    await fetchSettings()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '重置失败', 'error')
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

// 保存队伍上限
async function handleSaveAllCapacities() {
  if (isOverCapacityLimit.value) {
    emit(
      'toast',
      `队伍合计人数（${totalCapacitySum.value}人）不能超过总人数（${totalCompanyEmployees.value}人）`,
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
    emit('toast', err.message || '保存失败', 'error')
  } finally {
    savingAllCapacities.value = false
  }
}

// 保存活动主题和配置
async function handleSaveActivityConfig() {
  try {
    savingActivityConfig.value = true
    const res = await api.updateActivityConfig({
      title: activityTitle.value.trim() || undefined,
      theme: activityTheme.value.trim() || undefined,
      targetStepsDaily: Number(activityDailySteps.value) || 8000,
      totalKmTarget: Number(activityKmTarget.value) || 35,
    })
    emit('toast', res.message || '活动配置已保存', 'success')
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '保存活动配置失败', 'error')
  } finally {
    savingActivityConfig.value = false
  }
}

// 添加免报
async function handleAddExcluded() {
  const uname = manualUsername.value.trim()
  if (!uname) {
    emit('toast', '请输入员工姓名或账号', 'error')
    return
  }
  try {
    submittingExcluded.value = true
    const res = await api.adminExcludeUser(uname, 'exclude', {
      displayName: manualDisplayName.value.trim() || uname,
      reason: manualReason.value.trim() || '免参与健步拉练',
    })
    emit('toast', res.message || `已将【${uname}】设为免报名人员`, 'success')
    manualUsername.value = ''
    manualDisplayName.value = ''
    manualReason.value = ''
    await fetchSettings()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '操作失败', 'error')
  } finally {
    submittingExcluded.value = false
  }
}

// 恢复免报
async function handleRestoreExcluded(u: any) {
  try {
    const res = await api.adminExcludeUser(u.username, 'restore')
    emit('toast', res.message || '已恢复该员工报名资格', 'success')
    await fetchSettings()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '操作失败', 'error')
  }
}

// 添加管理员
async function handleAddAdmin() {
  const u = newAdminUsername.value.trim()
  if (!u) {
    emit('toast', '请输入管理员账号或姓名', 'error')
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

// 移除管理员
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
    emit('toast', res.message || '已移除管理员权限', 'success')
    await fetchSettings()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '移除失败', 'error')
  }
}

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
    <div
      class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full h-[90vh] max-h-[780px] flex flex-col overflow-hidden border border-slate-200 animate-scale-in"
      @click.stop
    >
      <!-- 隐藏的文件上传 input -->
      <input
        type="file"
        ref="fileInputRef"
        accept=".xlsx, .xls"
        class="hidden"
        @change="handleFileUpload"
      />

      <!-- 弹窗顶栏 -->
      <div class="bg-gradient-to-r from-red-800 via-slate-900 to-amber-900 px-6 py-4 text-white flex items-center justify-between shadow-xs flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shadow-inner border border-white/20">
            ⚙️
          </div>
          <div>
            <h3 class="font-black text-base sm:text-lg leading-tight tracking-tight">赛事组委会 · 后台控制中心</h3>
            <p class="text-xs text-amber-200/80 mt-0.5">花名册导入 / 队伍自主配置 / 人数容量调配 / 活动规则</p>
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

      <!-- Tab 导航栏 -->
      <div class="flex border-b border-slate-200 bg-slate-50/90 px-4 pt-2.5 gap-1 flex-shrink-0 overflow-x-auto">
        <button
          type="button"
          :class="[
            'px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition border-t border-x cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
            activeTab === 'roster'
              ? 'bg-white text-red-700 border-slate-200 -mb-[1px] shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
          ]"
          @click="activeTab = 'roster'"
        >
          <span>📋</span>
          <span>名单导入与花名册 ({{ rosterList.length }})</span>
        </button>

        <button
          type="button"
          :class="[
            'px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition border-t border-x cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
            activeTab === 'teams'
              ? 'bg-white text-red-700 border-slate-200 -mb-[1px] shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
          ]"
          @click="activeTab = 'teams'"
        >
          <span>🛡️</span>
          <span>战队与编制管理 ({{ settings?.teams.length || 0 }})</span>
        </button>

        <button
          type="button"
          :class="[
            'px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition border-t border-x cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
            activeTab === 'rules'
              ? 'bg-white text-red-700 border-slate-200 -mb-[1px] shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
          ]"
          @click="activeTab = 'rules'"
        >
          <span>🏆</span>
          <span>活动主题与指标</span>
        </button>

        <button
          type="button"
          :class="[
            'px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition border-t border-x cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
            activeTab === 'excluded'
              ? 'bg-white text-red-700 border-slate-200 -mb-[1px] shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
          ]"
          @click="activeTab = 'excluded'"
        >
          <span>🚫</span>
          <span>免报人员 ({{ settings?.excludedUsers.length || 0 }})</span>
        </button>

        <button
          type="button"
          :class="[
            'px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition border-t border-x cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
            activeTab === 'admins'
              ? 'bg-white text-red-700 border-slate-200 -mb-[1px] shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
          ]"
          @click="activeTab = 'admins'"
        >
          <span>🔑</span>
          <span>管理员授权 ({{ settings?.admins.length || 0 }})</span>
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-y-auto p-5 space-y-6">
        <!-- 加载骨架 -->
        <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <div class="w-8 h-8 border-3 border-red-700 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs">加载配置数据中...</span>
        </div>

        <template v-else>
          <!-- TAB 1: 参赛名单导入与花名册 -->
          <div v-if="activeTab === 'roster'" class="space-y-6">
            <!-- 导入与录入操作卡片 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Excel 批量导入 -->
              <div class="p-4 rounded-xl border border-dashed border-red-300 bg-red-50/40 flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span>📊</span> Excel 名单批量导入
                    </h4>
                    <button
                      type="button"
                      class="text-xs text-red-700 hover:text-red-900 hover:underline font-medium cursor-pointer"
                      @click="handleDownloadTemplate"
                    >
                      📥 下载 Excel 模板
                    </button>
                  </div>
                  <p class="text-xs text-slate-500 mb-4 leading-relaxed">
                    支持 .xlsx 格式文件。表头需包含【姓名】，可选【部门】、【手机号】、【备注】。导入后队员可直接输入姓名登录！
                  </p>
                </div>
                <button
                  type="button"
                  :disabled="importingExcel"
                  class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white text-xs font-bold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  @click="triggerExcelUpload"
                >
                  <span>{{ importingExcel ? '正在解析导入...' : '选择 Excel 文件导入花名册 🚀' }}</span>
                </button>
              </div>

              <!-- 手工单人录入 -->
              <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                <h4 class="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <span>✍️</span> 手动录入队员姓名
                </h4>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <input
                    v-model="manualRosterName"
                    type="text"
                    placeholder="队员姓名 *"
                    class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                  <input
                    v-model="manualRosterDept"
                    type="text"
                    placeholder="所属部门"
                    class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                  <input
                    v-model="manualRosterPhone"
                    type="text"
                    placeholder="联系手机"
                    class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                  <input
                    v-model="manualRosterNote"
                    type="text"
                    placeholder="备注"
                    class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <button
                  type="button"
                  :disabled="submittingRoster"
                  class="w-full mt-3 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  @click="handleAddRoster"
                >
                  {{ submittingRoster ? '录入中...' : '+ 录入到参赛花名册' }}
                </button>
              </div>
            </div>

            <!-- 名单总览与表格搜索 -->
            <div class="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div class="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div class="flex items-center gap-2 text-xs text-slate-700">
                  <strong class="text-slate-900 font-bold">已录入名单总览</strong>
                  <span class="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-mono font-bold">
                    共 {{ rosterList.length }} 人
                  </span>
                </div>
                <input
                  v-model="rosterSearch"
                  type="text"
                  placeholder="搜索姓名、部门、手机..."
                  class="w-full sm:w-64 px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                />
              </div>

              <div class="max-h-72 overflow-y-auto">
                <table class="w-full text-left text-xs divide-y divide-slate-100">
                  <thead class="bg-slate-50/50 sticky top-0 text-slate-500 font-medium">
                    <tr>
                      <th class="px-4 py-2 w-12">#</th>
                      <th class="px-4 py-2">姓名</th>
                      <th class="px-4 py-2">所属部门</th>
                      <th class="px-4 py-2">手机号</th>
                      <th class="px-4 py-2">备注</th>
                      <th class="px-4 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-if="filteredRoster.length === 0">
                      <td colspan="6" class="px-4 py-8 text-center text-slate-400">
                        {{ rosterSearch ? '未匹配到符合条件的名单人员' : '尚未录入任何花名册人员，请通过 Excel 导入或手动录入' }}
                      </td>
                    </tr>
                    <tr v-for="(u, idx) in filteredRoster" :key="u.id || idx" class="hover:bg-slate-50/80 transition">
                      <td class="px-4 py-2 text-slate-400 font-mono">{{ idx + 1 }}</td>
                      <td class="px-4 py-2 font-bold text-slate-900">{{ u.name }}</td>
                      <td class="px-4 py-2 text-slate-600">{{ u.department || '-' }}</td>
                      <td class="px-4 py-2 text-slate-500 font-mono">{{ u.phone || '-' }}</td>
                      <td class="px-4 py-2 text-slate-500 truncate max-w-[140px]">{{ u.note || '-' }}</td>
                      <td class="px-4 py-2 text-right">
                        <button
                          type="button"
                          class="text-[11px] text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                          @click="handleDeleteRoster(u)"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- TAB 2: 战队与编制管理 -->
          <div v-if="activeTab === 'teams'" class="space-y-6">
            <!-- 新增队伍表单 -->
            <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <h4 class="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <span>➕</span> 自定义新增战队
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                <input
                  v-model="newTeamName"
                  type="text"
                  placeholder="战队名称 (如：雷霆战队) *"
                  class="px-3 py-2 rounded-lg border border-slate-200 bg-white sm:col-span-1"
                />
                <input
                  v-model="newTeamSlogan"
                  type="text"
                  placeholder="战队口号 (如：雷厉风行，勇争第一)"
                  class="px-3 py-2 rounded-lg border border-slate-200 bg-white sm:col-span-2"
                />
                <div class="flex gap-2 sm:col-span-1">
                  <input
                    v-model="newTeamIcon"
                    type="text"
                    placeholder="图标"
                    class="w-12 px-2 py-2 text-center rounded-lg border border-slate-200 bg-white"
                  />
                  <input
                    v-model="newTeamMaxMembers"
                    type="number"
                    placeholder="上限人数"
                    class="w-20 px-2 py-2 text-center rounded-lg border border-slate-200 bg-white"
                  />
                  <button
                    type="button"
                    :disabled="creatingTeam"
                    class="flex-1 px-3 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold transition disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    @click="handleCreateTeam"
                  >
                    {{ creatingTeam ? '创建中...' : '创建战队' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- 批量快捷设置与智能对齐 -->
            <div class="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
              <div class="flex items-center gap-2">
                <span class="text-slate-600 font-medium">统一各队上限：</span>
                <input
                  v-model.number="batchCapacityInput"
                  type="number"
                  min="1"
                  max="100"
                  class="w-16 px-2 py-1 border border-slate-200 rounded text-center font-bold"
                />
                <button
                  type="button"
                  class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium cursor-pointer"
                  @click="applyBatchLimit(batchCapacityInput)"
                >
                  应用到全部
                </button>
              </div>

              <!-- 合计与保存按钮 -->
              <div class="flex items-center gap-3">
                <span :class="['font-bold', isOverCapacityLimit ? 'text-red-600' : 'text-slate-700']">
                  当前各队合计：<strong class="font-mono text-sm">{{ totalCapacitySum }}</strong> / {{ totalCompanyEmployees }} 人
                </span>
                <button
                  type="button"
                  :disabled="savingAllCapacities || isOverCapacityLimit || hasUnderflowTeam"
                  class="px-4 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold transition disabled:opacity-50 cursor-pointer shadow-xs"
                  @click="handleSaveAllCapacities"
                >
                  {{ savingAllCapacities ? '保存中...' : '保存人数上限设置 💾' }}
                </button>
              </div>
            </div>

            <!-- 队伍列表卡片网格 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div
                v-for="t in settings?.teams"
                :key="t.id"
                class="p-4 rounded-xl border border-slate-200 bg-white hover:border-red-300 transition shadow-2xs flex flex-col justify-between gap-3"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2.5">
                    <span class="text-2xl">{{ (props.snapshot?.teams.find(item => item.id === t.id)?.icon) || '🚩' }}</span>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-mono text-slate-400">#{{ t.id }}</span>
                        <h4 class="font-bold text-sm text-slate-900">{{ t.name }}</h4>
                      </div>
                      <p class="text-[11px] text-slate-500 mt-0.5">
                        {{ props.snapshot?.teams.find(item => item.id === t.id)?.slogan || '自主组建，全速进发' }}
                      </p>
                    </div>
                  </div>

                  <!-- 队伍状态微型角标 -->
                  <span
                    :class="[
                      'text-[10px] px-2 py-0.5 rounded-full font-bold',
                      t.memberCount >= (teamCapacities[t.id] || t.maxMembers)
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-slate-100 text-slate-600'
                    ]"
                  >
                    {{ t.memberCount }} / {{ teamCapacities[t.id] !== undefined ? teamCapacities[t.id] : t.maxMembers }} 人
                  </span>
                </div>

                <!-- 独立人数上限微调器 -->
                <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div class="flex items-center gap-1.5">
                    <span class="text-slate-500">该队上限:</span>
                    <button
                      type="button"
                      class="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                      @click="adjustTeamLimit(t.id, -1)"
                    >
                      -
                    </button>
                    <input
                      v-model.number="teamCapacities[t.id]"
                      type="number"
                      class="w-12 py-0.5 text-center font-bold border border-slate-200 rounded"
                    />
                    <button
                      type="button"
                      class="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                      @click="adjustTeamLimit(t.id, 1)"
                    >
                      +
                    </button>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="text-[11px] text-slate-400 hover:text-amber-700 cursor-pointer"
                      @click="handleResetTeam(t.id, t.name)"
                      title="清空该队伍成员"
                    >
                      清空队员
                    </button>
                    <button
                      type="button"
                      class="text-[11px] text-slate-400 hover:text-red-700 cursor-pointer"
                      @click="handleDeleteTeam(t)"
                      title="解散并删除队伍"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 3: 活动主题与规则指标 -->
          <div v-if="activeTab === 'rules'" class="space-y-4 max-w-xl">
            <div class="p-5 rounded-xl border border-slate-200 bg-white space-y-4 text-xs">
              <div>
                <label class="block font-bold text-slate-700 mb-1">
                  活动主标题 <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="activityTitle"
                  type="text"
                  placeholder="如：荣耀征程 · 大型团队竞技与拉练争霸赛"
                  class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"
                />
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">
                  活动主题口号 / 副标题 <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="activityTheme"
                  type="text"
                  placeholder="如：凝心聚力，勇攀高峰，向胜利全速进发！"
                  class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>

              <div class="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">每日目标步数 (步/人)</label>
                  <input
                    v-model.number="activityDailySteps"
                    type="number"
                    class="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">拉练总里程目标 (公里)</label>
                  <input
                    v-model.number="activityKmTarget"
                    type="number"
                    class="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <button
                type="button"
                :disabled="savingActivityConfig"
                class="w-full mt-3 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl font-bold transition disabled:opacity-50 cursor-pointer shadow-xs"
                @click="handleSaveActivityConfig"
              >
                {{ savingActivityConfig ? '保存中...' : '保存活动主题与规则 💾' }}
              </button>
            </div>
          </div>

          <!-- TAB 4: 免报人员管理 -->
          <div v-if="activeTab === 'excluded'" class="space-y-4">
            <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/60 text-xs">
              <h4 class="font-bold text-slate-900 mb-2">手动添加免报名人员</h4>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  v-model="manualUsername"
                  type="text"
                  placeholder="员工工号/姓名 *"
                  class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white sm:col-span-1"
                />
                <input
                  v-model="manualDisplayName"
                  type="text"
                  placeholder="姓名 (选填)"
                  class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white sm:col-span-1"
                />
                <input
                  v-model="manualReason"
                  type="text"
                  placeholder="免报原因 (如：外派支持)"
                  class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white sm:col-span-1"
                />
                <button
                  type="button"
                  :disabled="submittingExcluded"
                  class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition disabled:opacity-50 cursor-pointer sm:col-span-1"
                  @click="handleAddExcluded"
                >
                  {{ submittingExcluded ? '设置中...' : '确认设为免报' }}
                </button>
              </div>
            </div>

            <!-- 免报人员列表 -->
            <div class="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div class="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-xs text-slate-700">
                免报名人员名单 (共 {{ settings?.excludedUsers.length || 0 }} 人)
              </div>
              <div class="max-h-60 overflow-y-auto">
                <table class="w-full text-left text-xs divide-y divide-slate-100">
                  <thead class="bg-slate-50/50 sticky top-0 text-slate-500 font-medium">
                    <tr>
                      <th class="px-4 py-2">姓名</th>
                      <th class="px-4 py-2">所属部门</th>
                      <th class="px-4 py-2">免报原因</th>
                      <th class="px-4 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-if="!settings?.excludedUsers || settings.excludedUsers.length === 0">
                      <td colspan="4" class="px-4 py-6 text-center text-slate-400">
                        暂无免报名人员
                      </td>
                    </tr>
                    <tr v-for="u in settings?.excludedUsers" :key="u.username" class="hover:bg-slate-50 transition">
                      <td class="px-4 py-2 font-bold text-slate-900">{{ u.displayName }}</td>
                      <td class="px-4 py-2 text-slate-600">{{ u.department || '-' }}</td>
                      <td class="px-4 py-2 text-slate-500">{{ u.reason || '免参与' }}</td>
                      <td class="px-4 py-2 text-right">
                        <button
                          type="button"
                          class="text-red-700 hover:underline cursor-pointer"
                          @click="handleRestoreExcluded(u)"
                        >
                          恢复报名
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- TAB 5: 管理员权限 -->
          <div v-if="activeTab === 'admins'" class="space-y-4">
            <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/60 text-xs">
              <h4 class="font-bold text-slate-900 mb-2">添加新管理员账号</h4>
              <div class="flex gap-2 max-w-md">
                <input
                  v-model="newAdminUsername"
                  type="text"
                  placeholder="请输入账号或姓名"
                  class="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
                <button
                  type="button"
                  :disabled="submittingAdmin"
                  class="px-4 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold transition disabled:opacity-50 cursor-pointer"
                  @click="handleAddAdmin"
                >
                  {{ submittingAdmin ? '添加中...' : '添加管理员' }}
                </button>
              </div>
            </div>

            <!-- 管理员列表 -->
            <div class="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div class="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-xs text-slate-700">
                当前管理员列表 (共 {{ settings?.admins.length || 0 }} 人)
              </div>
              <div class="divide-y divide-slate-100 text-xs">
                <div
                  v-for="a in settings?.admins"
                  :key="a.username"
                  class="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50"
                >
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-900 font-mono">{{ a.username }}</span>
                    <span v-if="a.isBuiltin" class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px]">内置默认</span>
                  </div>
                  <button
                    v-if="!a.isBuiltin"
                    type="button"
                    class="text-red-700 hover:underline cursor-pointer"
                    @click="handleRemoveAdmin(a)"
                  >
                    移除权限
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
