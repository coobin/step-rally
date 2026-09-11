<script setup lang="ts">
defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content max-w-lg relative bg-transparent shadow-none p-0 overflow-hidden">
      <!-- 关闭按钮 -->
      <button
        class="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center text-sm font-bold z-10 backdrop-blur"
        @click="$emit('close')"
      >
        ✕
      </button>

      <div class="rounded-2xl overflow-hidden bg-white shadow-2xl border border-white/20">
        <img
          src="/activity-poster.jpg"
          alt="一步一善·重走经典红色路活动海报"
          class="w-full h-auto max-h-[85vh] object-contain block mx-auto"
        />
        <div class="p-3 text-center bg-stone-900 text-white text-xs flex justify-between items-center px-4">
          <span class="font-medium">一步一善 · 重走经典红色路 原版海报</span>
          <button
            class="text-amber-400 hover:underline"
            @click="$emit('close')"
          >
            关闭预览
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
