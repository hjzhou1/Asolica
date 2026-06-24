<template>
  <Teleport to="body">
    <div class="toast-stack">
      <transition-group name="toast" tag="div">
        <div
          v-for="t in list"
          :key="t.id"
          class="toast"
          :class="[`toast-${t.type}`]"
          @click="remove(t.id)"
        >
          <!-- 图标 -->
          <span class="toast-icon" aria-hidden="true" v-html="iconSvg(t.type)" />
          <span class="toast-text">{{ t.message }}</span>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';

let idCounter = 0;
const list = ref([]);
const DURATION = 2400;

function iconSvg(type) {
  const icons = {
    success: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M6 10l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    error: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    warning: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v5M10 14h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    info: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M10 14v-4M10 7h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  };
  return icons[type] || icons.info;
}

function show(message, type = 'info', duration = DURATION) {
  const id = ++idCounter;
  const item = { id, message, type };
  list.value.push(item);
  setTimeout(() => remove(id), duration);
}

function remove(id) {
  const idx = list.value.findIndex(t => t.id === id);
  if (idx !== -1) list.value.splice(idx, 1);
}

// 暴露给外部调用
defineExpose({ show });
</script>

<style scoped>
.toast-stack {
  position: fixed; z-index: var(--z-toast);
  top: 16px; right: 16px;
  display: flex; flex-direction: column; gap: 8px;
  pointer-events: none;
  max-width: 380px;
}
.toast {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--color-brand); color: var(--color-text-inverse);
  border: 1px solid var(--color-brand);
  font-size: 14px; font-weight: 500;
  pointer-events: auto; cursor: pointer;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', sans-serif;
}
.toast-icon { flex-shrink: 0; opacity: .9; }
.toast-icon :deep(svg) { display: block; }
.toast-text { line-height: 1.4; }

/* 类型颜色：成功绿、失败红、警告橙、信息蓝，便于用户快速识别操作结果 */
.toast-success {
  background: var(--color-success); border-color: var(--color-success-hover, #059669);
  color: #fff;
}
.toast-error {
  background: var(--color-danger); border-color: var(--color-danger-hover, #dc2626);
  color: #fff;
}
.toast-warning {
  background: var(--color-warning); border-color: var(--color-warning-hover, #d97706);
  color: #fff;
}
.toast-info {
  background: var(--color-info); border-color: var(--color-info-hover, #2563eb);
  color: #fff;
}

/* 动画 */
.toast-enter-active { transition: all .35s cubic-bezier(0.4, 0, 0.2, 1); }
.toast-leave-active { transition: all .25s cubic-bezier(0.4, 0, 0.2, 1); }
.toast-enter-from { opacity: 0; transform: translateX(40px) scale(0.95); }
.toast-leave-to { opacity: 0; transform: translateX(24px) scale(0.95); }

@media (max-width: 480px) {
  .toast-stack { left: 12px; right: 12px; max-width: none; }
  .toast { border-radius: 10px; padding: 10px 14px; font-size: 13px; }
}
</style>
