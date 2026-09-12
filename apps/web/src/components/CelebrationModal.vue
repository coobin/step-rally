<script setup lang="ts">
import { onMounted } from 'vue'
import confetti from 'canvas-confetti'
import type { SnapshotData } from '../types.ts'

const props = defineProps<{
  snapshot: SnapshotData | null
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function triggerConfetti() {
  // 1. 左右两翼双礼炮对轰
  confetti({
    particleCount: 90,
    angle: 60,
    spread: 65,
    origin: { x: 0.05, y: 0.7 },
    colors: ['#dc2626', '#f59e0b', '#fbbf24', '#10b981', '#3b82f6', '#ec4899', '#ffffff'],
    zIndex: 9999,
  })
  confetti({
    particleCount: 90,
    angle: 120,
    spread: 65,
    origin: { x: 0.95, y: 0.7 },
    colors: ['#dc2626', '#f59e0b', '#fbbf24', '#10b981', '#3b82f6', '#ec4899', '#ffffff'],
    zIndex: 9999,
  })

  // 2. 400ms 后金星与五角星倾泻
  setTimeout(() => {
    confetti({
      particleCount: 70,
      spread: 120,
      origin: { x: 0.5, y: 0.2 },
      shapes: ['star'],
      colors: ['#ffd700', '#f59e0b', '#fbbf24', '#ffffff', '#ef4444'],
      scalar: 1.2,
      zIndex: 9999,
    })
  }, 350)

  // 3. 1000ms 后中央万紫千红大爆发
  setTimeout(() => {
    confetti({
      particleCount: 110,
      spread: 160,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#dc2626', '#b91c1c', '#f59e0b', '#fbbf24', '#34d399', '#60a5fa'],
      zIndex: 9999,
    })
  }, 900)
}

onMounted(() => {
  if (props.show) {
    triggerConfetti()
  }
})
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none overflow-y-auto"
      @click.self="emit('close')"
    >
      <!-- 庆典卡片主体 -->
      <div
        class="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-red-950/90 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(220,38,38,0.45)] border-2 border-amber-400/80 text-center overflow-hidden transform transition-all animate-celebration-pop"
      >
        <!-- 背景金色光晕与放射装饰线 -->
        <div class="absolute -top-24 -left-24 w-60 h-60 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-24 -right-24 w-60 h-60 bg-red-600/25 rounded-full blur-3xl pointer-events-none"></div>

        <!-- 关闭按钮 -->
        <button
          type="button"
          class="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer z-20"
          @click="emit('close')"
          title="关闭庆典"
        >
          ✕
        </button>

        <!-- 顶部金色勋章与荣耀光环 -->
        <div class="relative mx-auto w-24 h-24 mb-4 flex items-center justify-center">
          <div class="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 opacity-30 animate-ping"></div>
          <div class="absolute inset-1 rounded-full border-2 border-dashed border-amber-300/60 animate-spin-slow"></div>
          <div class="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-red-700 to-amber-600 p-0.5 shadow-2xl flex items-center justify-center border border-amber-200">
            <span class="text-4xl filter drop-shadow-md animate-bounce">🏆</span>
          </div>
        </div>

        <!-- 主副标题 -->
        <div class="space-y-1">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold tracking-widest uppercase">
            <span>✨</span>
            <span>湖南承希科技有限公司</span>
            <span>✨</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-amber-100 via-amber-300 to-amber-100 bg-clip-text text-transparent mt-2">
            🎉 全 员 集 结 完 毕 🎉
          </h2>
          <p class="text-sm sm:text-base font-bold text-red-300/95 tracking-wide">
            10 支经典红色路战队全线满员！
          </p>
          <p class="text-xs text-slate-300/80 pt-1 max-w-sm mx-auto">
            一步一善，万众一心！公司全体健步英雄已就位，红色拉练出征号角正式吹响！
          </p>
        </div>

        <!-- 战队核心指标展示 -->
        <div class="grid grid-cols-3 gap-2.5 my-5 text-left">
          <div class="p-3 rounded-xl bg-white/5 border border-white/10 text-center backdrop-blur-xs">
            <span class="text-[10px] text-slate-400 block font-medium">战队编制</span>
            <span class="text-base sm:text-lg font-black font-mono text-amber-300">10 / 10 队</span>
            <span class="text-[9px] text-emerald-400 block mt-0.5 font-semibold">全部满员</span>
          </div>
          <div class="p-3 rounded-xl bg-white/5 border border-white/10 text-center backdrop-blur-xs">
            <span class="text-[10px] text-slate-400 block font-medium">集结战友</span>
            <span class="text-base sm:text-lg font-black font-mono text-white">
              {{ snapshot?.statistics.totalMembers }} 人
            </span>
            <span class="text-[9px] text-slate-400 block mt-0.5">全员到齐</span>
          </div>
          <div class="p-3 rounded-xl bg-white/5 border border-white/10 text-center backdrop-blur-xs">
            <span class="text-[10px] text-slate-400 block font-medium">组队率</span>
            <span class="text-base sm:text-lg font-black font-mono text-emerald-400">100%</span>
            <span class="text-[9px] text-amber-400 block mt-0.5 font-semibold">圆满达成</span>
          </div>
        </div>

        <!-- 仿古红色官方印章动效 (Stamp Slam Effect) -->
        <div class="relative my-2 py-1 flex items-center justify-center">
          <div class="stamp-box transform -rotate-12 border-4 border-red-500/90 rounded-2xl px-6 py-2 bg-red-950/40 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-stamp-slam inline-flex flex-col items-center select-none">
            <span class="text-[10px] text-red-300 tracking-widest font-bold">★ 承 希 科 技 公 益 拉 练 ★</span>
            <span class="text-lg sm:text-xl font-black text-red-500 tracking-widest font-serif">【 全 员 集 结 完 毕 】</span>
            <span class="text-[9px] text-red-400/80 font-mono tracking-wider">OFFICIALLY FULLY ASSEMBLED</span>
          </div>
        </div>

        <!-- 交互按钮组 -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
          <button
            type="button"
            class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 text-amber-950 font-black text-xs sm:text-sm shadow-xl hover:scale-105 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 border border-amber-200"
            @click="emit('close')"
          >
            <span>🚀</span>
            <span>进入战队大厅 (开始阅兵)</span>
          </button>

          <button
            type="button"
            class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-white/20"
            @click="triggerConfetti"
          >
            <span>🎆</span>
            <span>再放一次礼花</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
@keyframes celebrationPop {
  0% {
    opacity: 0;
    transform: scale(0.85) translateY(20px);
  }
  60% {
    transform: scale(1.03) translateY(-4px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.animate-celebration-pop {
  animation: celebrationPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes stampSlam {
  0% {
    opacity: 0;
    transform: scale(2.5) rotate(-35deg);
  }
  70% {
    opacity: 1;
    transform: scale(0.95) rotate(-12deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(-12deg);
  }
}

.animate-stamp-slam {
  animation: stampSlam 0.6s cubic-bezier(0.2, 0.8, 0.3, 1) 0.3s backwards;
}

@keyframes spinSlow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin-slow {
  animation: spinSlow 16s linear infinite;
}
</style>
