<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { MeResponse, SnapshotData, AdminSettingsData, AdminItem } from '../types.ts'
import { api } from '../api.ts'

defineProps<{
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

// 队伍上限设置
const capacityInput = ref(15)
const savingCapacity = ref(false)

async function fetchSettings() {
  try {
    loading.value = true
    const data = await api.getAdminSettings()
    settings.value = data
    if (data?.activityRules?.maxPerTeam) {
      capacityInput.value = data.activityRules.maxPerTeam
    }
  } catch (err: any) {
    emit('toast', err.message || '加载管理员配置失败', 'error')
  } finally {
    loading.value = false
  }
}

async function handleSaveGlobalCapacity() {
  const num = Math.floor(Number(capacityInput.value))
  if (!num || num < 1 || num > 100) {
    emit('toast', '每队上限人数必须在 1 到 100 之间', 'error')
    return
  }
  try {
    savingCapacity.value = true
    const res = await api.updateTeamCapacity(num)
    emit('toast', res.message || `每队人数上限已统一设置为 ${num} 人`, 'success')
    await fetchSettings()
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '更新队伍人数上限失败', 'error')
  } finally {
    savingCapacity.value = false
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

        <!-- Tab 3: 战队管理与人数上限设置 -->
        <div v-else-if="activeTab === 'teams'" class="space-y-4">
          <!-- 全局每队人数上限设置 -->
          <div class="p-4 bg-gradient-to-r from-slate-50 to-amber-50/50 rounded-xl border border-slate-200 shadow-2xs">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <h4 class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>⚡</span>
                <span>每队人数上限设置</span>
              </h4>
              <span class="text-xs font-mono font-bold text-red-700 bg-red-100/70 border border-red-200 px-2 py-0.5 rounded-full">
                当前上限: {{ settings?.activityRules?.maxPerTeam || 15 }} 人/队
              </span>
            </div>
            <p class="text-[11px] text-slate-500 mb-3">
              统一调整全公司 10 支战队的人数容量上限（队伍满员后将禁止继续报名）。请确保新上限不低于已有队伍当前已集结人数。
            </p>

            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-slate-400">快速设置:</span>
              <button
                v-for="num in [12, 14, 15, 16, 18, 20]"
                :key="num"
                class="text-xs px-2.5 py-1 rounded-lg border transition font-medium"
                :class="capacityInput === num ? 'bg-red-700 text-white border-red-700' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'"
                @click="capacityInput = num"
              >
                {{ num }} 人
              </button>

              <div class="flex items-center gap-1.5 ml-auto">
                <input
                  v-model.number="capacityInput"
                  type="number"
                  min="1"
                  max="100"
                  class="w-20 text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:border-red-600"
                />
                <span class="text-xs text-slate-500">人</span>
                <button
                  class="btn btn-primary text-xs px-3.5 py-1.5 font-medium ml-1"
                  :disabled="savingCapacity || !capacityInput"
                  @click="handleSaveGlobalCapacity"
                >
                  {{ savingCapacity ? '保存中...' : '保存设置' }}
                </button>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold text-slate-800">各代表队概况与小队清空</h4>
            <span class="text-[11px] text-slate-400">支持一键重置清空某个小队重新组队</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              v-for="team in settings?.teams"
              :key="team.id"
              class="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2 shadow-2xs"
            >
              <div>
                <div class="font-bold text-xs text-slate-800">第 {{ team.id }} 队 · {{ team.name }}</div>
                <div class="text-[11px] text-slate-400 mt-0.5">
                  队员人数: <strong class="text-slate-700">{{ team.memberCount }}</strong> / {{ team.maxMembers }} 人
                </div>
              </div>

              <button
                class="text-[11px] px-2.5 py-1 rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-medium transition"
                :disabled="team.memberCount === 0"
                :class="{ 'opacity-50 cursor-not-allowed': team.memberCount === 0 }"
                @click="handleResetTeam(team.id, team.name)"
              >
                重置清空
              </button>
            </div>
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
