<script setup lang="ts">
import { ref, computed } from 'vue'
import confetti from 'canvas-confetti'
import type { TeamItem, MeResponse } from '../types.ts'
import { api } from '../api.ts'

const props = defineProps<{
  team: TeamItem
  me: MeResponse | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'refresh'): void
  (e: 'toast', msg: string, type?: 'success' | 'error'): void
}>()

const isMember = computed(() => {
  if (!props.me?.user) return false
  return props.team.members.some((m) => m.username === props.me!.user!.username)
})

const myVoteCandidate = computed(() => {
  if (!props.me?.user) return null
  return props.team.votes[props.me.user.username] || null
})

// 加入表单
const note = ref('')
const joining = ref(false)

// 队伍编辑
const editing = ref(false)
const editName = ref(props.team.name)
const editSlogan = ref(props.team.slogan)
const savingEdit = ref(false)

const isLeader = computed(() => {
  return props.team.currentLeader?.username === props.me?.user?.username
})

const canEdit = computed(() => {
  return isLeader.value || Boolean(props.me?.user?.isAdmin)
})

async function handleJoin() {
  try {
    joining.value = true
    const res = await api.joinTeam(props.team.id, note.value)
    confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 } })
    emit('toast', res.message || '成功加入队伍！', 'success')
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '加入队伍失败', 'error')
  } finally {
    joining.value = false
  }
}

async function handleSwitchTeam() {
  if (!confirm(`确定要退出原队伍【${props.me?.myTeam?.name}】并转入【${props.team.name}】吗？`)) {
    return
  }
  try {
    joining.value = true
    const res = await api.joinTeam(props.team.id, note.value, true)
    confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 } })
    emit('toast', res.message || '已成功更换至新队伍！', 'success')
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '更换队伍失败', 'error')
  } finally {
    joining.value = false
  }
}

const leaving = ref(false)
async function handleLeave() {
  const teamName = isMember.value ? props.team.name : props.me?.myTeam?.name || '队伍'
  if (!confirm(`确定要退出【${teamName}】吗？退出后可重新选择加入其他队伍。`)) {
    return
  }
  try {
    leaving.value = true
    const res = await api.leaveTeam()
    emit('toast', res.message || '已成功退出队伍', 'success')
    emit('refresh')
    emit('close')
  } catch (err: any) {
    emit('toast', err.message || '退出失败', 'error')
  } finally {
    leaving.value = false
  }
}

const voting = ref<string | null>(null)
async function handleVote(candidateUsername: string) {
  if (!isMember.value) {
    emit('toast', '只有本队正式队员才可以投票推选队长', 'error')
    return
  }
  try {
    voting.value = candidateUsername
    const res = await api.voteLeader(candidateUsername)
    confetti({ particleCount: 50, spread: 45, origin: { y: 0.5 } })
    emit('toast', res.message || '推选成功！', 'success')
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '投票失败', 'error')
  } finally {
    voting.value = null
  }
}

async function handleSaveTeamInfo() {
  try {
    savingEdit.value = true
    const res = await api.updateTeam(props.team.id, editName.value, editSlogan.value)
    emit('toast', res.message || '更新成功', 'success')
    editing.value = false
    emit('refresh')
  } catch (err: any) {
    emit('toast', err.message || '修改失败', 'error')
  } finally {
    savingEdit.value = false
  }
}

async function handleResetTeam() {
  if (!confirm(`【管理员警告】确定清空重置【${props.team.name}】吗？所有队员和投票将被重置。`)) return
  try {
    const res = await api.resetTeam(props.team.id)
    emit('toast', res.message, 'success')
    emit('refresh')
    emit('close')
  } catch (err: any) {
    emit('toast', err.message || '重置失败', 'error')
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content relative">
      <!-- 关闭按钮 -->
      <button
        class="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-xs font-bold z-10 transition"
        @click="emit('close')"
      >
        ✕
      </button>

      <!-- 弹窗顶栏 -->
      <div class="p-6 border-b border-slate-100 bg-slate-50/50">
        <div class="text-xs font-mono font-bold text-red-700 mb-1">
          TEAM {{ team.id < 10 ? `0${team.id}` : team.id }} • 上限 15 人 (当前 {{ team.memberCount }} 人)
        </div>

        <div v-if="!editing" class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{{ team.name }}</span>
              <span v-if="isMember" class="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">我已入队</span>
            </h2>
            <p class="text-xs text-slate-500 mt-1 italic">“{{ team.slogan }}”</p>
          </div>
          <button
            v-if="canEdit"
            class="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded border border-slate-200 bg-white"
            @click="editing = true"
          >
            编辑队名
          </button>
        </div>

        <div v-else class="space-y-2 mt-2 bg-white p-3 rounded-lg border border-slate-200">
          <input
            v-model="editName"
            type="text"
            placeholder="队伍名称"
            class="w-full text-xs px-2.5 py-1.5 border rounded focus:outline-none focus:border-red-600"
            maxlength="30"
          />
          <input
            v-model="editSlogan"
            type="text"
            placeholder="队伍口号"
            class="w-full text-xs px-2.5 py-1.5 border rounded focus:outline-none focus:border-red-600"
            maxlength="60"
          />
          <div class="flex justify-end gap-2">
            <button class="btn btn-secondary text-xs px-2.5 py-1" @click="editing = false">取消</button>
            <button class="btn btn-primary text-xs px-2.5 py-1" :disabled="savingEdit" @click="handleSaveTeamInfo">保存</button>
          </div>
        </div>

        <!-- 队长与状态标签 -->
        <div class="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="text-slate-400">当前推选队长：</span>
            <span v-if="team.currentLeader" class="font-semibold text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
              <span>👑</span>
              <span>{{ team.currentLeader.displayName }}</span>
              <span class="text-[11px] font-normal text-amber-700">({{ team.voteRanking[0]?.count }} 票)</span>
            </span>
            <span v-else class="text-slate-400 italic">全队民主推选中</span>
          </div>

          <span class="text-slate-400">{{ team.totalVotes }} 票已投出</span>
        </div>

        <!-- 本队队员醒目状态与快捷退出入口 -->
        <div
          v-if="isMember"
          class="mt-3 p-2.5 rounded-lg bg-red-50/80 border border-red-200 flex items-center justify-between text-xs"
        >
          <div class="flex items-center gap-1.5 text-red-900 font-medium">
            <span>🚩</span>
            <span>您当前是本队正式成员</span>
          </div>
          <button
            class="btn btn-secondary text-red-700 hover:bg-red-100 hover:border-red-300 text-xs px-3 py-1 font-medium"
            :disabled="leaving"
            @click="handleLeave"
            title="退出后可自由选择加入其他队伍"
          >
            {{ leaving ? '退出中...' : '退出本队 (重选其他队)' }}
          </button>
        </div>
      </div>

      <!-- 主体内容 -->
      <div class="p-6 space-y-6">
        <!-- 未入队报名入口 -->
        <div
          v-if="!isMember && !me?.myTeam && !team.isFull"
          class="p-4 rounded-xl border border-red-200 bg-red-50/40"
        >
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-xs font-bold text-red-900">加入【{{ team.name }}】</h4>
            <span class="text-[11px] text-red-700">还有 {{ team.maxMembers - team.memberCount }} 个空位</span>
          </div>
          <div class="mb-3">
            <input
              v-model="note"
              type="text"
              placeholder="口号 (选填)"
              class="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-red-600 transition"
            />
          </div>
          <button
            class="btn btn-primary w-full py-2 text-xs font-semibold"
            :disabled="joining"
            @click="handleJoin"
          >
            {{ joining ? '加入中...' : '确认加入该队伍' }}
          </button>
        </div>

        <!-- 已在其他队伍：支持一键换队或退出原队伍 -->
        <div
          v-else-if="!isMember && me?.myTeam"
          class="p-4 rounded-xl border border-amber-300 bg-amber-50/60"
        >
          <div class="flex items-center justify-between mb-1.5">
            <h4 class="text-xs font-bold text-amber-900">更换队伍至【{{ team.name }}】</h4>
            <span v-if="!team.isFull" class="text-[11px] text-amber-700">还有 {{ team.maxMembers - team.memberCount }} 空位</span>
            <span v-else class="text-[11px] text-slate-500">本队已满员</span>
          </div>
          <p class="text-xs text-slate-600 mb-3">
            您当前在【第 {{ me.myTeam.id }} 队 {{ me.myTeam.name }}】。您可以直接换队，或先退出原队伍。
          </p>
          <div v-if="!team.isFull" class="mb-3">
            <input
              v-model="note"
              type="text"
              placeholder="口号 (选填)"
              class="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-red-600 transition"
            />
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="!team.isFull"
              class="btn btn-primary flex-1 py-2 text-xs font-semibold bg-amber-700 hover:bg-amber-800 border-amber-700"
              :disabled="joining"
              @click="handleSwitchTeam"
            >
              {{ joining ? '正在转队...' : '确认退出原队并转入本队' }}
            </button>
            <button
              class="btn btn-secondary text-red-700 py-2 text-xs px-3 hover:bg-red-50 hover:border-red-200"
              :disabled="leaving"
              @click="handleLeave"
            >
              仅退出原队伍
            </button>
          </div>
        </div>

        <!-- 队长推选与得票看板 -->
        <div class="p-4 rounded-xl bg-slate-50/70 border border-slate-200">
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>🗳️</span>
              <span>队内推选队长投票</span>
            </h4>
            <span class="text-[11px] text-slate-500">每人 1 票 · 支持修改</span>
          </div>

          <!-- 我的投票状态 -->
          <div
            v-if="isMember"
            class="p-2.5 rounded-lg mb-3 text-xs flex items-center justify-between"
            :class="myVoteCandidate ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-white text-slate-600 border border-slate-200'"
          >
            <span v-if="myVoteCandidate">
              您当前推举：<strong>{{ team.members.find(m => m.username === myVoteCandidate)?.displayName || myVoteCandidate }}</strong>
            </span>
            <span v-else class="text-amber-800 font-medium">
              您尚未投票，请在下方队员名单中点击【推举 TA】！
            </span>
          </div>

          <!-- 得票分布排行 -->
          <div v-if="team.voteRanking.length > 0" class="space-y-1.5">
            <div
              v-for="(vr, index) in team.voteRanking"
              :key="vr.candidateUsername"
              class="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 text-xs"
            >
              <div class="flex items-center gap-2">
                <span
                  class="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px]"
                  :class="index === 0 ? 'bg-amber-400 text-amber-950' : 'bg-slate-100 text-slate-600'"
                >
                  {{ index + 1 }}
                </span>
                <span class="font-medium text-slate-800">{{ vr.candidateName }}</span>
                <span v-if="index === 0" class="text-[10px] text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
                  当前当选
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-slate-800">{{ vr.count }} <span class="text-[10px] font-normal text-slate-400">票</span></span>
              </div>
            </div>
          </div>
          <div v-else class="text-xs text-slate-400 italic text-center py-2">
            队内暂无投票，快来投下第一票！
          </div>
        </div>

        <!-- 队伍成员花名册 -->
        <div>
          <div class="flex items-center justify-between mb-2.5">
            <h4 class="text-xs font-bold text-slate-800">
              正式队员列表 ({{ team.memberCount }} / {{ team.maxMembers }} 人)
            </h4>
            <span class="text-[11px] text-slate-400">满 15 人截止</span>
          </div>

          <div v-if="team.members.length === 0" class="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-lg">
            暂无成员，点击上方按钮抢先加入！
          </div>

          <div v-else class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div
              v-for="(member, idx) in team.members"
              :key="member.username"
              class="p-3 flex items-center justify-between gap-2 hover:bg-slate-50/60 transition"
              :class="{ 'bg-amber-50/30': team.currentLeader?.username === member.username }"
            >
              <div class="flex items-center gap-2.5">
                <div class="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[11px]">
                  {{ idx + 1 }}
                </div>
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="font-semibold text-xs text-slate-900">{{ member.displayName }}</span>
                    <span class="text-[11px] text-slate-400 font-mono">({{ member.username }})</span>
                    <span v-if="team.currentLeader?.username === member.username" class="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1 rounded">
                      👑 队长
                    </span>
                    <span v-if="member.username === me?.user?.username" class="text-[10px] bg-red-100 text-red-800 px-1 rounded font-medium">
                      我
                    </span>
                  </div>
                  <div class="text-[10px] text-slate-400 mt-0.5">
                    入队：{{ new Date(member.joinedAt).toLocaleDateString() }}
                    <span v-if="member.note" class="italic text-slate-500 ml-1">“{{ member.note }}”</span>
                  </div>
                </div>
              </div>

              <!-- 推选按钮 -->
              <div v-if="isMember" class="flex items-center">
                <button
                  class="btn text-[11px] px-2.5 py-1"
                  :class="myVoteCandidate === member.username ? 'btn-gold font-medium' : 'btn-secondary text-slate-600'"
                  :disabled="voting === member.username"
                  @click="handleVote(member.username)"
                >
                  <span v-if="myVoteCandidate === member.username">⭐ 已投TA</span>
                  <span v-else>推举TA</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作：退出队伍与管理员重置 -->
        <div v-if="isMember || me?.user?.isAdmin" class="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
          <button
            v-if="isMember"
            class="btn btn-secondary text-red-600 hover:bg-red-50 hover:border-red-200 text-xs px-3 py-1.5"
            :disabled="leaving"
            @click="handleLeave"
          >
            退出本队伍
          </button>
          <button
            v-if="me?.user?.isAdmin"
            class="btn btn-ghost text-red-700 text-xs px-2 py-1"
            @click="handleResetTeam"
          >
            重置队伍(管理员)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
