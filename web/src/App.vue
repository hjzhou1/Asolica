<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-boundary-inner">
      <svg class="error-icon" viewBox="0 0 56 56" fill="none" aria-hidden="true">
        <circle cx="28" cy="28" r="27" stroke="currentColor" stroke-width="2"/>
        <path d="M28 18v14M28 38h0" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      </svg>
      <h2 class="error-title">页面出错了</h2>
      <p class="error-desc">抱歉，页面发生了异常，请稍后重试。</p>
      <button class="error-retry-btn" @click="retry">点击重试</button>
    </div>
  </div>
  <template v-else>
    <Toast ref="toastRef" />
    <ConfirmModal v-model="confirmState.visible" :title="confirmState.title" :message="confirmState.message" :confirmText="confirmState.confirmText" :size="confirmState.size" :async="confirmState.async" @confirm="onConfirmAction" @cancel="onCancelAction" />
    <BackToTop />
    <RouterView v-slot="{ Component, route: r }">
      <transition name="page-fade" mode="out-in" :key="r.path">
        <component :is="Component" :key="r.path" />
      </transition>
    </RouterView>
  </template>
</template>

<script setup>
import { provide, ref, onErrorCaptured, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Toast from './components/common/Toast.vue';
import BackToTop from './components/common/BackToTop.vue';
import ConfirmModal from './components/common/ConfirmModal.vue';
import { useErrorReport } from './composables/useErrorReport.js';
import { fetchSiteInfo } from './api/shop.js';

const { reportError } = useErrorReport();

// 加载站点名称并设置 document.title
onMounted(async () => {
  try {
    const info = await fetchSiteInfo();
    if (info?.name) {
      document.title = info.name;
    }
  } catch { /* 静默失败，保持默认标题 */ }
});

// 全局错误边界：防止组件崩溃导致白屏
const hasError = ref(false);
onErrorCaptured((err, instance, info) => {
  reportError(err, { componentInfo: info });
  hasError.value = true;
  return false;
});

function retry() {
  hasError.value = false;
}

const toastRef = ref(null);

// 全局 toast 方法
function showToast(message, type = 'info') {
  toastRef.value?.show(message, type);
}
provide('toast', showToast);

// 导航方法
const router = useRouter();
function navigate(target) {
  if (!target) return;
  if (router.currentRoute.value.name === target || router.currentRoute.value.path === target) return;
  if (router.hasRoute(target)) {
    router.push({ name: target });
  } else {
    router.push(target);
  }
}
provide('navigate', navigate);

// 全局确认弹窗
import { useConfirm } from './composables/useConfirm.js';
const { state: confirmState, open: confirmOpen, onConfirm: onConfirmAction, onCancel: onCancelAction } = useConfirm();
provide('confirm', confirmOpen);
</script>

<style>
.error-boundary {
  position: fixed;
  inset: 0;
  z-index: var(--z-max);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-page, #ffffff);
}
.error-boundary-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px;
}
.error-icon {
  width: 56px;
  height: 56px;
  color: var(--color-text, #0f0f13);
  margin-bottom: 16px;
}
.error-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text, #0f0f13);
  margin: 0 0 8px;
}
.error-desc {
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
  margin: 0 0 24px;
}
.error-retry-btn {
  height: 40px;
  padding: 0 24px;
  font-size: 14px;
  color: #fff;
  background: var(--color-brand, #0f0f13);
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  transition: opacity .15s;
}
.error-retry-btn:hover { opacity: 0.9; }
</style>
