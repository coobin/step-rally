<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    teamId?: number | string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    teamId: '0',
    size: 'md',
  }
)

const safeId = computed(() => {
  return String(props.teamId).replace(/[^a-zA-Z0-9_-]/g, '_')
})

const topArcId = computed(() => `seal-arc-${safeId.value}`)

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'w-16 h-16'
    case 'lg':
      return 'w-24 h-24 sm:w-28 sm:h-28'
    case 'md':
    default:
      return 'w-20 h-20 sm:w-[86px] sm:h-[86px]'
  }
})
</script>

<template>
  <div
    class="stamp-container inline-block select-none pointer-events-none transform-gpu"
    :class="sizeClass"
    aria-label="已满员印章"
  >
    <svg
      viewBox="0 0 100 100"
      class="w-full h-full drop-shadow-[0_2px_4px_rgba(220,38,38,0.22)]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- 浅红微透明印泥底色 -->
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="rgba(254, 242, 242, 0.45)"
        stroke="#dc2626"
        stroke-width="2.6"
      />
      <!-- 内同心细边圈 -->
      <circle
        cx="50"
        cy="50"
        r="41"
        fill="none"
        stroke="#dc2626"
        stroke-width="1.2"
      />

      <!-- 顶部弧形引导路径 -->
      <path
        :id="topArcId"
        d="M 18,50 A 32,32 0 0,1 82,50"
        fill="none"
      />
      <!-- 顶部弧形文字 -->
      <text
        font-size="7.5"
        font-weight="900"
        fill="#dc2626"
        letter-spacing="1.2"
      >
        <textPath
          :href="`#${topArcId}`"
          startOffset="50%"
          text-anchor="middle"
        >
          ★ 战队集结完毕 ★
        </textPath>
      </text>

      <!-- 中间上下分割横线 -->
      <line
        x1="16"
        y1="36.5"
        x2="84"
        y2="36.5"
        stroke="#dc2626"
        stroke-width="1.2"
        stroke-linecap="round"
      />
      <line
        x1="16"
        y1="63.5"
        x2="84"
        y2="63.5"
        stroke="#dc2626"
        stroke-width="1.2"
        stroke-linecap="round"
      />

      <!-- 核心大字：已满员 -->
      <text
        x="50"
        y="53.5"
        text-anchor="middle"
        font-size="19"
        font-weight="900"
        fill="#dc2626"
        letter-spacing="3"
        style="font-family: 'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif;"
      >
        已满员
      </text>

      <!-- 底部英文与装饰星号 -->
      <text
        x="50"
        y="73"
        text-anchor="middle"
        font-size="6.5"
        font-weight="800"
        fill="#dc2626"
        letter-spacing="1"
        font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        ROSTER FULL
      </text>
      <text
        x="50"
        y="82.5"
        text-anchor="middle"
        font-size="7"
        fill="#dc2626"
        letter-spacing="2"
      >
        ★★★
      </text>
    </svg>
  </div>
</template>

<style scoped>
.stamp-container {
  transform: rotate(-13deg);
  opacity: 0.9;
  mix-blend-mode: multiply;
  animation: stampPop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

@keyframes stampPop {
  0% {
    opacity: 0;
    transform: rotate(-13deg) scale(1.3);
  }
  70% {
    opacity: 0.95;
    transform: rotate(-13deg) scale(0.96);
  }
  100% {
    opacity: 0.9;
    transform: rotate(-13deg) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .stamp-container {
    animation: none;
  }
}
</style>
