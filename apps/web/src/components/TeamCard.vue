<script setup lang="ts">
import { computed } from 'vue'
import type { TeamItem, MeResponse } from '../types.ts'
import TeamFullStamp from './TeamFullStamp.vue'

const props = defineProps<{
  team: TeamItem
  me: MeResponse | null
}>()

const emit = defineEmits<{
  (e: 'view-team', team: TeamItem): void
  (e: 'join-team', teamId: number): void
  (e: 'leave-team', team: TeamItem): void
}>()

const isMyTeam = computed(() => {
  return props.me?.myTeam?.id === props.team.id
})

const percentage = computed(() => {
  return Math.min(100, Math.round((props.team.memberCount / props.team.maxMembers) * 100))
})

// 队长始终排在第一位展示
const sortedMembers = computed(() => {
  const leaderUser = props.team.currentLeader?.username
  if (!leaderUser) return props.team.members
  return [
    ...props.team.members.filter((m) => m.username === leaderUser),
    ...props.team.members.filter((m) => m.username !== leaderUser),
  ]
})
</script>

<template>
  <div
    class="relative bg-white rounded-xl border transition-all duration-300 flex flex-col justify-between overflow-hidden hover:-translate-y-1 group"
    :class="[
      isMyTeam
        ? 'border-red-600 shadow-md ring-2 ring-red-600/20'
        : 'border-slate-200/90 hover:border-red-300 hover:shadow-lg',
    ]"
  >
    <!-- 顶部竞技速度线条 -->
    <div
      class="h-1.5 w-full bg-gradient-to-r"
      :class="[
        isMyTeam
          ? 'from-red-600 via-amber-500 to-red-600'
          : team.isFull
          ? 'from-slate-300 via-slate-400 to-slate-300'
          : 'from-red-800/80 via-amber-600/70 to-red-800/80'
      ]"
    ></div>

    <!-- 满员印章 (Stamp) -->
    <div
      v-if="team.isFull"
      class="absolute right-3.5 top-3 z-10 pointer-events-none select-none"
    >
      <TeamFullStamp :team-id="team.id" size="md" />
    </div>

    <div class="p-4 sm:p-5">
      <!-- 队伍序号与状态 -->
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2.5">
          <!-- 战队号码布样式 -->
          <div
            class="w-10 h-10 rounded-lg font-black text-sm flex flex-col items-center justify-center font-mono italic shadow-sm flex-shrink-0"
            :class="[
              isMyTeam
                ? 'bg-gradient-to-br from-red-800 to-red-950 text-amber-300 ring-2 ring-amber-400/40'
                : 'bg-slate-900 text-white group-hover:bg-red-900 transition'
            ]"
          >
            <span class="text-[8px] font-sans font-bold not-italic tracking-wider uppercase opacity-75 leading-none mb-0.5">TEAM</span>
            <span class="leading-none text-base">{{ team.id < 10 ? `0${team.id}` : team.id }}</span>
          </div>

          <div>
            <div class="flex items-center gap-1.5">
              <h3 class="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                {{ team.name }}
              </h3>
              <span v-if="isMyTeam" class="text-[10px] bg-red-600 text-white font-bold px-2 py-0.2 rounded-full shadow-xs">
                我的队伍
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5 italic truncate max-w-[190px] sm:max-w-[240px]">
              “{{ team.slogan }}”
            </p>
          </div>
        </div>

        <!-- 满员 / 余位标签 -->
        <span
          v-if="team.isFull"
          class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200/80"
        >
          {{ team.maxMembers }} / {{ team.maxMembers }} 人
        </span>
        <span
          v-else
          class="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
          :class="team.memberCount >= team.targetMembers ? 'bg-amber-50 text-amber-800 border border-amber-300' : 'bg-red-50 text-red-700 border border-red-200'"
        >
          余 {{ team.maxMembers - team.memberCount }} 席
        </span>
      </div>

      <!-- 人数进度条 (运动跑道条纹风) -->
      <div class="mt-4">
        <div class="flex justify-between text-xs mb-1.5 text-slate-600 font-medium">
          <span class="flex items-center gap-1">
            <span>🏃 战队集结</span>
            <span class="text-[11px] text-slate-400 font-mono">({{ percentage }}%)</span>
          </span>
          <span class="font-bold text-slate-900 font-mono">
            {{ team.memberCount }} <span class="text-slate-400 font-normal text-[11px]">/ {{ team.maxMembers }} 人</span>
          </span>
        </div>
        <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/70">
          <div
            class="h-full rounded-full transition-all duration-500 athletic-track-meter"
            :style="{ width: `${percentage}%` }"
            :class="[
              team.isFull
                ? 'bg-slate-500'
                : isMyTeam
                ? 'bg-gradient-to-r from-red-600 to-amber-500 shadow-sm'
                : 'bg-gradient-to-r from-red-800 to-red-600'
            ]"
          ></div>
        </div>
      </div>

      <!-- 队长状态位 -->
      <div class="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span class="text-slate-400 font-medium flex items-center gap-1">
          <span>👑</span>
          <span>推选领跑队长</span>
        </span>
        <div v-if="team.currentLeader" class="flex items-center gap-1.5 font-bold text-amber-950 bg-gradient-to-r from-amber-50 to-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300/80 text-xs shadow-xs">
          <span>{{ team.currentLeader.displayName }}</span>
          <span class="text-amber-700 font-mono font-normal text-[11px]">({{ team.voteRanking[0]?.count }} 票)</span>
        </div>
        <div v-else class="text-slate-400 italic text-[11px]">
          🗳️ 队内推选中
        </div>
      </div>

      <!-- 队员头像列表快览 (战友标签) -->
      <div class="mt-3">
        <div v-if="team.members.length === 0" class="text-xs text-slate-300 italic py-2 text-center bg-slate-50/70 rounded-lg">
          暂无战友加入，抢先首发入列！
        </div>
        <div v-else class="flex flex-wrap gap-1">
          <span
            v-for="m in sortedMembers.slice(0, 8)"
            :key="m.username"
            class="text-[11px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-100 flex items-center gap-1"
            :class="{ 'border-amber-300 bg-amber-50/80 font-bold text-amber-900 shadow-xs': team.currentLeader?.username === m.username }"
          >
            <span v-if="team.currentLeader?.username === m.username">👑</span>
            <span>{{ m.displayName }}</span>
          </span>
          <span v-if="sortedMembers.length > 8" class="text-[10px] text-slate-400 self-center pl-1 font-mono font-medium">
            +{{ sortedMembers.length - 8 }}
          </span>
        </div>
      </div>
    </div>

    <!-- 底部操作按钮 -->
    <div class="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2">
      <!-- 若当前是我的队伍 -->
      <template v-if="isMyTeam">
        <button
          class="btn btn-gold text-xs flex-1 py-1.5 font-medium"
          @click="emit('view-team', team)"
        >
          <span>👑 队内推选</span>
        </button>
        <button
          class="btn btn-secondary text-red-600 hover:bg-red-50 hover:border-red-200 text-xs px-2.5 py-1.5"
          @click="emit('leave-team', team)"
          title="退出本队以重选其他队伍"
        >
          <span>退出本队</span>
        </button>
      </template>

      <!-- 若未加入任何队伍 -->
      <template v-else-if="!me?.myTeam">
        <button
          class="btn btn-secondary text-xs flex-1 py-1.5"
          @click="emit('view-team', team)"
        >
          <span>查看详情</span>
        </button>
        <button
          v-if="!team.isFull"
          class="btn btn-primary text-xs flex-1 py-1.5"
          @click="emit('join-team', team.id)"
        >
          <span>加入本队</span>
        </button>
      </template>

      <!-- 若已在其他队伍中：支持查看或更换队伍 -->
      <template v-else>
        <button
          class="btn btn-secondary text-xs flex-1 py-1.5"
          @click="emit('view-team', team)"
        >
          <span>查看详情</span>
        </button>
        <button
          v-if="!team.isFull"
          class="btn btn-primary text-xs flex-1 py-1.5 bg-amber-700 hover:bg-amber-800 border-amber-700"
          @click="emit('view-team', team)"
          title="更换加入本队"
        >
          <span>更换至本队</span>
        </button>
      </template>
    </div>
  </div>
</template>
