<template>
  <span class="brand-logo" :class="`brand-logo--${size}`" :style="{ color }" v-html="svgContent" />
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  size: { type: String, default: 'md', validator: v => ['sm', 'md', 'lg', 'hero'].includes(v) },
  color: { type: String, default: '' },
});

const svgContent = computed(() => {
  // Hero 尺寸：高细节大厂蓝图质感 - 方框 + 五角星 + 下横杠
  if (props.size === 'hero') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="100%" height="100%" fill="none">
      <!-- 极弱的外轨道和背景几何网格 -->
      <circle cx="120" cy="120" r="106" stroke="currentColor" stroke-width="0.8" opacity="0.08" stroke-dasharray="4 6"/>
      <circle cx="120" cy="120" r="82" stroke="currentColor" stroke-width="0.6" opacity="0.04"/>
      
      <!-- 四角刻度线 -->
      <line x1="32" y1="32" x2="48" y2="48" stroke="currentColor" stroke-width="1" opacity="0.15" />
      <line x1="208" y1="32" x2="192" y2="48" stroke="currentColor" stroke-width="1" opacity="0.15" />
      <line x1="32" y1="208" x2="48" y2="192" stroke="currentColor" stroke-width="1" opacity="0.15" />
      <line x1="208" y1="208" x2="192" y2="192" stroke="currentColor" stroke-width="1" opacity="0.15" />
      
      <!-- 定位微点 -->
      <circle cx="120" cy="32" r="1.5" fill="currentColor" opacity="0.3"/>
      <circle cx="120" cy="208" r="1.5" fill="currentColor" opacity="0.3"/>
      <circle cx="32" cy="120" r="1.5" fill="currentColor" opacity="0.3"/>
      <circle cx="208" cy="120" r="1.5" fill="currentColor" opacity="0.3"/>

      <!-- 正方形外框 -->
      <rect x="32" y="32" width="176" height="176" rx="36" stroke="currentColor" stroke-width="5.5" fill="none" opacity="0.95" />
      <!-- 细线条内框 -->
      <rect x="43" y="43" width="154" height="154" rx="27" stroke="currentColor" stroke-width="1.2" opacity="0.15" />

      <!-- 核心五角星 (经过精确几何对齐计算) -->
      <path d="M 120,64 L 131.2,98.6 L 167.6,98.6 L 138.1,120.1 L 149.3,154.7 L 120,133.2 L 90.7,154.7 L 101.9,120.1 L 72.4,98.6 L 108.8,98.6 Z" fill="currentColor" opacity="0.95" />
      
      <!-- 五角星下方的横杠 -->
      <rect x="80" y="170" width="80" height="6.5" rx="3.25" fill="currentColor" opacity="0.95" />
    </svg>`;
  }

  // 中小尺寸：极简线框版 (导航栏、页脚等常规应用)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">
    <!-- 正方形外框 -->
    <rect x="6" y="6" width="28" height="28" rx="7" stroke="currentColor" stroke-width="2.6" fill="none" opacity="0.9" />
    <!-- 核心五角星 -->
    <path d="M 20,10.5 L 22,16.5 L 28,16.5 L 23.5,19.8 L 25.5,25.8 L 20,22.2 L 14.5,25.8 L 16.5,19.8 L 12,16.5 L 18,16.5 Z" fill="currentColor" opacity="0.9" />
    <!-- 下方横杠 -->
    <rect x="14" y="28" width="12" height="2" rx="1" fill="currentColor" opacity="0.9" />
  </svg>`;
});
</script>

<style scoped>
.brand-logo { display: inline-flex; flex-shrink: 0; max-width: 100%; }
.brand-logo--sm { width: 20px; height: 20px; }
.brand-logo--md { width: 26px; height: 26px; }
.brand-logo--lg { width: 34px; height: 34px; }
.brand-logo--hero {
  width: 280px;
  max-width: 100%;
  aspect-ratio: 1 / 1;
  height: auto;
}
.brand-logo :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

@media (max-width: 768px) {
  .brand-logo--hero { width: 220px; }
}
@media (max-width: 480px) {
  .brand-logo--hero { width: 160px; }
}
</style>
