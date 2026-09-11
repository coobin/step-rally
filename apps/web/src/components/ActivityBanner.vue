<script setup lang="ts">
import { ref } from 'vue'

const stations = [
  { step: 1, name: '新四军纪念馆', desc: '铁军精神 烽火江淮', icon: '🏛️' },
  { step: 2, name: '淮海战役纪念馆', desc: '决胜中原 人民伟力', icon: '🎖️' },
  { step: 3, name: '百团大战纪念碑', desc: '太行雄风 气壮山河', icon: '⛰️' },
  { step: 4, name: '七届二中全会会址', desc: '西柏坡路 进京赶考', icon: '⭐' },
  { step: 5, name: '渡江战役纪念馆', desc: '百万雄师 破浪向前', icon: '⛵' },
  { step: 6, name: '香山革命纪念馆', desc: '绘制宏图 筹建新邦', icon: '🍂' },
  { step: 7, name: '北京天安门广场', desc: '伟业落成 昂首复兴', icon: '🚩' },
]

const activeStation = ref(0)
</script>

<template>
  <div class="relative overflow-hidden rounded-2xl bg-gradient-to-b from-red-700 via-red-800 to-stone-900 text-white shadow-xl border border-red-500/20 my-6">
    <!-- 装饰光晕与纹理 -->
    <div class="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-red-500/20 blur-3xl pointer-events-none"></div>
    <div class="absolute left-1/4 -bottom-20 w-96 h-96 rounded-full bg-amber-500/15 blur-3xl pointer-events-none"></div>

    <div class="relative p-6 sm:p-8 md:p-10">
      <!-- 顶部主题标语 -->
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-red-500/30 pb-6">
        <div class="space-y-1">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-semibold">
            <span>❤️</span>
            <span>每一步 都是向美好的明天靠近</span>
          </div>
          <h2 class="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-wider text-white drop-shadow-md">
            一步一善 · 重走经典红色路
          </h2>
          <p class="text-sm sm:text-base text-red-100 font-medium">
            让行走更有意义 —— 让更多孩子 看见更大的世界！
          </p>
        </div>

        <!-- 全程统计勋章 -->
        <div class="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 sm:p-4 text-center min-w-[160px]">
          <div class="text-xs text-amber-300 font-medium">全程红色经典里程</div>
          <div class="text-xl sm:text-2xl font-black text-white mt-0.5">42,000 <span class="text-sm font-normal">步</span></div>
          <div class="text-xs text-red-200">约 29.4 公里 · 7 大打卡纪念馆</div>
        </div>
      </div>

      <!-- 公益项目使命介绍 -->
      <div class="mt-6 bg-gradient-to-r from-red-900/70 to-red-950/70 rounded-xl p-4 border border-red-400/20 flex flex-col md:flex-row items-start md:items-center gap-3 text-xs sm:text-sm text-red-100">
        <div class="flex items-center gap-2 font-bold text-amber-300 whitespace-nowrap text-sm">
          <span>📖</span>
          <span>公益项目：为乡村孩子送去优质课堂</span>
        </div>
        <div class="text-red-200 leading-relaxed">
          本次活动与公益深度结合。你每天走过的步数，都将转化为真实的公益力量 —— 由公司预先充值公益金，你捐出的每一步都将变成乡村孩子课堂上的一本书、一堂课。
        </div>
      </div>

      <!-- 重走红色路 1938-1949 路线里程碑（自适应水平滚动或排布） -->
      <div class="mt-8">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-bold text-amber-300 flex items-center gap-2">
            <span>🗺️</span>
            <span>重走红色路 1938 - 1949 打卡路线</span>
          </h3>
          <span class="text-xs text-red-200">点击查看各站点精神</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          <div
            v-for="(st, idx) in stations"
            :key="st.step"
            class="relative rounded-lg p-2.5 transition-all cursor-pointer border text-center"
            :class="activeStation === idx ? 'bg-amber-400/20 border-amber-300 text-white shadow-lg' : 'bg-white/5 border-white/10 text-red-200 hover:bg-white/10'"
            @click="activeStation = idx"
          >
            <div class="text-xl mb-1">{{ st.icon }}</div>
            <div class="text-xs font-bold truncate">{{ st.name }}</div>
            <div class="text-[10px] text-amber-200/80 mt-0.5">{{ st.desc }}</div>
            <div class="text-[9px] text-red-300/70 mt-1 font-mono">第 {{ st.step }} 站</div>
          </div>
        </div>
      </div>

      <!-- 4 大核心规则提炼 -->
      <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div class="bg-black/25 rounded-xl p-3 border border-white/10">
          <div class="flex items-center gap-1.5 font-bold text-amber-300 mb-1">
            <span class="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">1</span>
            <span>分组要求</span>
          </div>
          <p class="text-stone-200 leading-snug">共 10 组，每组 14 人（上限 15 人），自由报名，队内推选队长。</p>
        </div>

        <div class="bg-black/25 rounded-xl p-3 border border-white/10">
          <div class="flex items-center gap-1.5 font-bold text-amber-300 mb-1">
            <span class="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">2</span>
            <span>淘汰机制</span>
          </div>
          <p class="text-stone-200 leading-snug">要求每组每人每日 6,000 步，一人未达标 整组淘汰，齐心协力。</p>
        </div>

        <div class="bg-black/25 rounded-xl p-3 border border-white/10">
          <div class="flex items-center gap-1.5 font-bold text-amber-300 mb-1">
            <span class="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">3</span>
            <span>全勤奖</span>
          </div>
          <p class="text-stone-200 leading-snug">每组全员达标 6,000 步，即可在速干毛巾、拉力器、护膝等礼品池任选一样。</p>
        </div>

        <div class="bg-black/25 rounded-xl p-3 border border-white/10">
          <div class="flex items-center gap-1.5 font-bold text-amber-300 mb-1">
            <span class="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">4</span>
            <span>排行大奖</span>
          </div>
          <p class="text-stone-200 leading-snug">小队平均步数排名前三：冠军180元、亚军150元、季军100元礼品任选。</p>
        </div>
      </div>
    </div>
  </div>
</template>
