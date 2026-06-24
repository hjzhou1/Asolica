<template>
  <transition name="bt-fade">
    <button v-if="visible" class="back-top" @click="scrollToTop" aria-label="回到顶部">
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 16V4M6 8l4-4 4 4"/>
      </svg>
    </button>
  </transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const visible = ref(false);

function onScroll() {
  visible.value = window.scrollY > 300;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onUnmounted(() => window.removeEventListener('scroll', onScroll));
</script>

<style scoped>
.back-top {
  position: fixed;
  bottom: 80px;
  right: 24px;
  z-index: var(--z-sticky, 100);
  width: 42px; height: 42px;
  border-radius: 12px;
  background: var(--color-brand);
  color: var(--color-text-inverse);
  border: none;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(17, 24, 39, 0.2);
  transition: all .25s cubic-bezier(0.4, 0, 0.2, 1);
}
.back-top:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 28px rgba(17, 24, 39, 0.3);
}

.bt-fade-enter-active,
.bt-fade-leave-active { transition: all .25s ease; }
.bt-fade-enter-from,
.bt-fade-leave-to { opacity: 0; transform: translateY(8px); }

@media (max-width: 720px) {
  .back-top {
    bottom: 72px;
    right: 14px;
    width: 38px; height: 38px;
  }
}
</style>
