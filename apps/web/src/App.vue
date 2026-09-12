<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Navbar from './components/Navbar.vue'
import TeamCard from './components/TeamCard.vue'
import TeamModal from './components/TeamModal.vue'
import UnassignedList from './components/UnassignedList.vue'
import AdminModal from './components/AdminModal.vue'
import CelebrationModal from './components/CelebrationModal.vue'
import LoginModal from './components/LoginModal.vue'
import { api } from './api.ts'
import type { MeResponse, SnapshotData, TeamItem, LdapEmployee } from './types.ts'

const me = ref<MeResponse | null>(null)
const snapshot = ref<SnapshotData | null>(null)
const loading = ref(true)

const activeTeam = ref<TeamItem | null>(null)
const showAdminSettings = ref(false)
const showCelebration = ref(false)
const showLoginModal = ref(false)
const mobileTab = ref<'teams' | 'unassigned'>('teams')

// 判断所有队伍是否全部满员
const isAllTeamsFull = computed(() => {
  if (!snapshot.value?.teams || snapshot.value.teams.length === 0) return false
  return snapshot.value.teams.every((t) => t.isFull || t.memberCount >= (t.maxMembers || 14))
})

// Toast 提示
const toastMessage = ref('')
const toastType = ref<'success' | 'error'>('success')
let toastTimer: any = null

function showToast(msg: string, type: 'success' | 'error' = 'success') {
  toastMessage.value = msg
  toastType.value = type
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, 3500)
}

async function loadData() {
  try {
    const [meData, snapData] = await Promise.all([
      api.getMe().catch(() => null),
      api.getTeams(),
    ])
    if (meData) me.value = meData
    snapshot.value = snapData

    if (activeTeam.value && snapData.teams) {
      const updated = snapData.teams.find((t) => t.id === activeTeam.value!.id)
      if (updated) activeTeam.value = updated
    }
  } catch (err: any) {
    console.error('Failed to load data:', err)
  } finally {
    loading.value = false
  }
}

function handleViewTeam(team: TeamItem) {
  activeTeam.value = team
}

async function handleJoinTeamDirect(teamId: number) {
  if (!me.value?.user) {
    showToast('请先输入姓名登录后再加入战队', 'error')
    showLoginModal.value = true
    return
  }
  const target = snapshot.value?.teams.find((t) => t.id === teamId)
  if (target) activeTeam.value = target
}

async function handleLeaveTeam(team?: TeamItem) {
  const teamName = team ? team.name : (me.value?.myTeam ? me.value.myTeam.name : '队伍')
  if (!confirm(`确定要退出【${teamName}】吗？退出后可重新选择加入其他队伍。`)) {
    return
  }
  try {
    const res = await api.leaveTeam()
    showToast(res.message || '已退出队伍，您现在可以重新选择其他队伍加入', 'success')
    await loadData()
    if (activeTeam.value) {
      activeTeam.value = null
    }
  } catch (err: any) {
    showToast(err.message || '退出失败', 'error')
  }
}

// 快捷拉待组队同事入自己队伍
async function handleInviteToMyTeam(emp: LdapEmployee) {
  if (!me.value?.user) {
    showToast('请先输入姓名登录后再操作', 'error')
    showLoginModal.value = true
    return
  }
  if (!me.value?.myTeam) {
    showToast('请先加入一支队伍，才能邀请其他同事', 'error')
    return
  }
  const myTeamId = me.value.myTeam.id
  try {
    const res = await fetch('/api/v1/teams/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        teamId: myTeamId,
        targetUsername: emp.username,
        targetDisplayName: emp.displayName,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error?.message || data?.error || '添加失败')
    showToast(data.message || `已成功将【${emp.displayName}】拉入本队！`, 'success')
    await loadData()
  } catch (err: any) {
    showToast(err.message || '操作失败', 'error')
  }
}

// 管理员排除员工（免报名）
async function handleExcludeUser(
  emp: { username: string; displayName?: string; department?: string },
  reason?: string,
) {
  try {
    const res = await api.adminExcludeUser(emp.username, 'exclude', {
      displayName: emp.displayName,
      department: emp.department,
      reason: reason || '免参与健步拉练',
    })
    showToast(res.message || `已将【${emp.displayName || emp.username}】设为免报名`, 'success')
    await loadData()
  } catch (err: any) {
    showToast(err.message || '操作失败', 'error')
  }
}

// 管理员恢复员工报名资格
async function handleRestoreUser(username: string) {
  try {
    const res = await api.adminExcludeUser(username, 'restore')
    showToast(res.message || '已恢复该员工的报名资格', 'success')
    await loadData()
  } catch (err: any) {
    showToast(err.message || '操作失败', 'error')
  }
}

let refreshTimer: any = null

onMounted(async () => {
  const urlParams = new URLSearchParams(window.location.search)
  const err = urlParams.get('error')
  if (err) {
    showToast(decodeURIComponent(err), 'error')
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  await loadData()
  // 所有队伍都满员后，每次打开首页触发炫酷满员动效
  if (isAllTeamsFull.value) {
    showCelebration.value = true
  }

  refreshTimer = setInterval(() => {
    loadData()
  }, 12000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="min-h-screen flex flex-col sports-bg-pattern relative selection:bg-red-700 selection:text-white">
    <!-- 动感运动跑道与等高线微光背景 (穿透全局) -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
      <svg class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="trackLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#b91c1c" stop-opacity="0.25" />
            <stop offset="50%" stop-color="#d97706" stop-opacity="0.12" />
            <stop offset="100%" stop-color="#b91c1c" stop-opacity="0.03" />
          </linearGradient>
        </defs>
        <path d="M-100,160 C400,10 800,280 1700,50" fill="none" stroke="url(#trackLineGrad)" stroke-width="2" stroke-dasharray="8,6" />
        <path d="M-100,195 C400,45 800,315 1700,85" fill="none" stroke="url(#trackLineGrad)" stroke-width="2.5" />
        <path d="M-100,230 C400,80 800,350 1700,120" fill="none" stroke="url(#trackLineGrad)" stroke-width="1.5" stroke-dasharray="12,6" />
        <path d="M-100,265 C400,115 800,385 1700,155" fill="none" stroke="url(#trackLineGrad)" stroke-width="2" />
      </svg>
    </div>

    <!-- 浮动通知 -->
    <div
      v-if="toastMessage"
      class="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-xs font-medium transition-all flex items-center gap-2 border"
      :class="toastType === 'success' ? 'bg-slate-900 text-white border-slate-700' : 'bg-red-700 text-white border-red-800'"
    >
      <span>{{ toastType === 'success' ? '✓' : '!' }}</span>
      <span>{{ toastMessage }}</span>
    </div>

    <!-- 顶部导航栏 -->
    <Navbar
      :me="me"
      :snapshot="snapshot"
      @refresh="loadData"
      @leave-team="handleLeaveTeam()"
      @open-admin-settings="showAdminSettings = true"
      @open-login="showLoginModal = true"
    />

    <main class="container py-6 flex-1 relative z-10">
      <!-- 运动拉练主题 Hero 区域 -->
      <div v-if="snapshot" class="mb-6">
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950 via-red-900 to-amber-950 text-white shadow-xl border border-red-800/40 p-5 sm:p-7">
          <!-- 跑道弧线背景装饰 SVG -->
          <svg class="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none" viewBox="0 0 1000 280">
            <path d="M-50,190 C300,40 600,260 1050,70" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="6,6" />
            <path d="M-50,220 C300,70 600,290 1050,100" fill="none" stroke="#fcd34d" stroke-width="3" />
            <path d="M-50,250 C300,100 600,320 1050,130" fill="none" stroke="#ffffff" stroke-width="1.5" />
            <path d="M-50,280 C300,130 600,350 1050,160" fill="none" stroke="#fca5a5" stroke-width="2" stroke-dasharray="10,6" />
            <path d="M200,280 Q450,100 700,280" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-opacity="0.3" />
          </svg>

          <!-- 顶部运动风徽章与更新时间 -->
          <div class="relative z-10 flex flex-wrap items-center justify-between gap-3 mb-3">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-800/90 text-amber-300 text-xs font-bold border border-amber-400/30 shadow-inner">
                <span class="animate-pulse">🔥</span>
                <span>2026 团队竞技争霸拉练</span>
              </span>
              <span class="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-white/90 text-xs font-medium backdrop-blur-sm border border-white/10">
                <span>👟</span>
                <span>每日每人 {{ snapshot.activityRules?.targetStepsDaily || 8000 }} 步 · 团队协同挑战</span>
              </span>
            </div>

            <span class="text-[11px] text-white/70 font-mono flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 inline-block pulse-glow"></span>
              实时集结中 · 更新于 {{ new Date(snapshot.updatedAt).toLocaleTimeString() }}
            </span>
          </div>

          <!-- 主标题与使命口号 -->
          <div class="relative z-10 max-w-2xl mb-4">
            <h2 class="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <span>{{ snapshot.title || '荣耀征程 · 大型团队竞技与拉练争霸赛' }}</span>
            </h2>
            <p class="text-xs sm:text-sm text-red-100/90 mt-1.5 font-normal leading-relaxed">
              {{ snapshot.theme || '凝聚团队力量，向目标全速进发！' }} 全员组建 <strong class="text-amber-300 font-bold">{{ snapshot.teams.length }} 支战队</strong>，队内一人一票推选领跑队长。
            </p>
          </div>

          <!-- 未登录快速引导栏 -->
          <div v-if="!me?.user" class="relative z-10 mb-4 p-3 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 text-xs">
              <span class="text-lg">📢</span>
              <span>您当前为<strong>游客浏览模式</strong>，输入您的花名册姓名即可立即加入心仪战队！</span>
            </div>
            <button
              type="button"
              class="px-4 py-1.5 rounded-lg bg-white text-red-900 font-bold text-xs hover:bg-amber-100 transition shadow-sm cursor-pointer active:scale-95"
              @click="showLoginModal = true"
            >
              立即输入姓名登录 🚀
            </button>
          </div>

          <!-- 红色拉练全员集结进度条 -->
          <div class="relative z-10 bg-black/25 backdrop-blur-md rounded-xl p-3 sm:p-3.5 border border-white/10">
            <div class="flex items-center justify-between text-xs mb-1.5">
              <div class="flex items-center gap-1.5 text-white/90 font-medium">
                <span>🏃 全员组队集结进度</span>
                <span class="text-amber-300 font-bold font-mono">
                  ({{ snapshot.statistics.totalMembers }} / {{ snapshot.statistics.eligibleEmployeesCount ?? snapshot.statistics.totalCompanyEmployees }} 人)
                </span>
                <span v-if="me?.user?.isAdmin && snapshot.statistics.excludedCount" class="text-white/70 text-[11px]">
                  · 应参 {{ snapshot.statistics.eligibleEmployeesCount }} 人 · 免报 {{ snapshot.statistics.excludedCount }} 人
                </span>
              </div>
              <div class="text-amber-300 font-black font-mono text-sm">
                {{ snapshot.statistics.registrationRate }}%
              </div>
            </div>

            <!-- 跑道进度槽 -->
            <div class="relative w-full h-2.5 bg-white/20 rounded-full overflow-hidden border border-white/10">
              <div
                class="h-full rounded-full bg-gradient-to-r from-amber-400 via-red-500 to-rose-400 transition-all duration-500 athletic-track-meter shadow-lg"
                :style="{ width: `${snapshot.statistics.registrationRate}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- 4 块运动能量指标看板 -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <!-- 在职总人数 -->
          <div class="bg-white/90 backdrop-blur-sm rounded-xl p-3.5 border border-slate-200/90 shadow-sm hover:shadow-md transition">
            <div class="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>公司在职员工</span>
              <span class="text-base">👥</span>
            </div>
            <div class="text-2xl font-black text-slate-900 mt-1 font-mono">
              {{ snapshot.statistics.totalCompanyEmployees }}
              <span class="text-xs font-normal text-slate-400">人</span>
            </div>
            <div class="text-[11px] text-slate-400 mt-0.5">
              <span v-if="me?.user?.isAdmin && snapshot.statistics.excludedCount">
                应参赛 {{ snapshot.statistics.eligibleEmployeesCount }} 人 (免报 {{ snapshot.statistics.excludedCount }} 人)
              </span>
              <span v-else>全员真实花名册 · 10 队协同</span>
            </div>
          </div>

          <!-- 已组队报名人数 -->
          <div class="bg-white/90 backdrop-blur-sm rounded-xl p-3.5 border border-red-200/90 shadow-sm hover:shadow-md transition">
            <div class="flex items-center justify-between text-xs text-red-800 font-medium">
              <span>已集结出征</span>
              <span class="text-base">🔥</span>
            </div>
            <div class="text-2xl font-black text-red-700 mt-1 font-mono">
              {{ snapshot.statistics.totalMembers }}
              <span class="text-xs font-normal text-slate-400">/ {{ snapshot.statistics.eligibleEmployeesCount ?? snapshot.statistics.totalCompanyEmployees }} 人</span>
            </div>
            <div class="text-[11px] text-red-600/80 mt-0.5 font-medium">集结率 {{ snapshot.statistics.registrationRate }}%</div>
          </div>

          <!-- 待组队同事 -->
          <div class="bg-white/90 backdrop-blur-sm rounded-xl p-3.5 border border-amber-200/90 shadow-sm hover:shadow-md transition">
            <div class="flex items-center justify-between text-xs text-amber-800 font-medium">
              <span>待整装入列</span>
              <span class="text-base">👟</span>
            </div>
            <div class="text-2xl font-black text-amber-700 mt-1 font-mono">
              {{ snapshot.statistics.unassignedCount }}
              <span class="text-xs font-normal text-slate-400">人</span>
            </div>
            <div class="text-[11px] text-amber-700/80 mt-0.5 font-medium">
              <span v-if="me?.user?.isAdmin && snapshot.statistics.excludedCount">已免报名 {{ snapshot.statistics.excludedCount }} 人</span>
              <span v-else>右侧名册支持一键入队</span>
            </div>
          </div>

          <!-- 已决出队长 -->
          <div class="bg-white/90 backdrop-blur-sm rounded-xl p-3.5 border border-slate-200/90 shadow-sm hover:shadow-md transition">
            <div class="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span>已推选出领跑队长</span>
              <span class="text-base">👑</span>
            </div>
            <div class="text-2xl font-black text-slate-800 mt-1 font-mono">
              {{ snapshot.teams.filter(t => t.currentLeader).length }}
              <span class="text-xs font-normal text-slate-400">/ 10 队</span>
            </div>
            <div class="text-[11px] text-slate-400 mt-0.5">满编 {{ snapshot.activityRules?.maxPerTeam || 15 }} 人队伍 {{ snapshot.statistics.fullTeamsCount }} 支</div>
          </div>
        </div>
      </div>

      <!-- 移动端标签页切换 (小队 / 待组队人员) -->
      <div class="flex lg:hidden mb-4 border-b border-slate-200">
        <button
          class="flex-1 py-2 text-xs font-bold border-b-2 text-center"
          :class="mobileTab === 'teams' ? 'border-red-700 text-red-800' : 'border-transparent text-slate-500'"
          @click="mobileTab = 'teams'"
        >
          🚩 十大小队 (10)
        </button>
        <button
          class="flex-1 py-2 text-xs font-bold border-b-2 text-center"
          :class="mobileTab === 'unassigned' ? 'border-red-700 text-red-800' : 'border-transparent text-slate-500'"
          @click="mobileTab = 'unassigned'"
        >
          📋 待组队同事 ({{ snapshot?.unassignedEmployees?.length || 0 }})
        </button>
      </div>

      <!-- 核心工作台：双栏联动 -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- 左侧：10 支队伍卡片 (占 8 列) -->
        <div
          class="lg:col-span-8 space-y-4"
          :class="{ 'hidden lg:block': mobileTab === 'unassigned' }"
        >
          <!-- 全员满员庆典喜报横幅 -->
          <div
            v-if="isAllTeamsFull && snapshot"
            class="p-4 rounded-2xl bg-gradient-to-r from-red-900 via-red-800 to-amber-900 text-white shadow-lg border-2 border-amber-400/80 flex flex-col sm:flex-row items-center justify-between gap-3 relative overflow-hidden"
          >
            <div class="flex items-center gap-3 z-10">
              <div class="w-11 h-11 rounded-xl bg-amber-400/25 border border-amber-300/40 flex items-center justify-center text-2xl flex-shrink-0 animate-bounce">
                🏆
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-black text-sm sm:text-base text-amber-200 tracking-wide">
                    🎉 喜报：10 支代表队全线满员！
                  </h3>
                  <span class="text-[10px] bg-amber-400 text-amber-950 font-bold px-2 py-0.2 rounded-full">
                    组队率 100%
                  </span>
                </div>
                <p class="text-xs text-amber-100/90 mt-0.5">
                  全公司 {{ snapshot.statistics.totalMembers }} 位健步战友全部组队完毕，红色拉练征程正式启航！
                </p>
              </div>
            </div>

            <button
              type="button"
              class="btn bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-amber-950 font-bold text-xs px-3.5 py-2 rounded-xl shadow-md border border-amber-200/60 flex items-center gap-1.5 whitespace-nowrap z-10 transition hover:scale-105 active:scale-95 cursor-pointer flex-shrink-0"
              @click="showCelebration = true"
            >
              <span>🎆</span>
              <span>重温满员庆典</span>
            </button>
          </div>

          <div class="flex items-center justify-between">
            <h3 class="font-bold text-sm text-slate-800 flex items-center gap-2">
              <span>🚩</span>
              <span>十支代表队 (共计 {{ snapshot?.statistics?.maxCapacity || 140 }} 席位)</span>
            </h3>
            <span class="text-xs text-slate-400">点击队伍进入推选队长</span>
          </div>

          <div v-if="loading" class="text-center py-16 text-slate-400 text-xs">
            正在加载队伍与在职员工数据...
          </div>

          <div v-else-if="snapshot" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TeamCard
              v-for="team in snapshot.teams"
              :key="team.id"
              :team="team"
              :me="me"
              @view-team="handleViewTeam"
              @join-team="handleJoinTeamDirect"
              @leave-team="handleLeaveTeam"
            />
          </div>
        </div>

        <!-- 右侧：待组队同事名册 (占 4 列) -->
        <div
          class="lg:col-span-4"
          :class="{ 'hidden lg:block': mobileTab === 'teams' }"
        >
          <UnassignedList
            v-if="snapshot"
            :employees="snapshot.unassignedEmployees"
            :excluded-employees="snapshot.excludedEmployees"
            :departments="snapshot.departments"
            :me="me"
            @invite-to-my-team="handleInviteToMyTeam"
            @exclude-user="handleExcludeUser"
            @restore-user="handleRestoreUser"
          />
        </div>
      </div>
    </main>

    <!-- 极简页脚 -->
    <footer class="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 mt-auto">
      <p>{{ snapshot?.title || '团队先锋 · 大型团队竞技与拉练争霸赛' }} · 2026</p>
    </footer>

    <!-- 队员登录/管理员登录弹窗 -->
    <LoginModal
      v-if="showLoginModal"
      @close="showLoginModal = false"
      @login-success="loadData"
      @toast="showToast"
    />

    <!-- 队伍详情与投票弹窗 -->
    <TeamModal
      v-if="activeTeam"
      :team="activeTeam"
      :me="me"
      @close="activeTeam = null"
      @refresh="loadData"
      @toast="showToast"
    />

    <!-- 管理员设置中心弹窗 -->
    <AdminModal
      v-if="showAdminSettings"
      :me="me"
      :snapshot="snapshot"
      @close="showAdminSettings = false"
      @refresh="loadData"
      @toast="showToast"
    />

    <!-- 全员满员炫酷庆典弹窗 -->
    <CelebrationModal
      :show="showCelebration"
      :snapshot="snapshot"
      @close="showCelebration = false"
    />
  </div>
</template>
