<template>
  <button class="locale-toggle" @click="cycle" :title="nextLabel" :aria-label="`Switch language to ${nextLabel}`">
    {{ current === 'zh-CN' ? '中' : 'EN' }}
  </button>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();
const current = ref(locale.value);

function cycle() {
  const next = current.value === 'zh-CN' ? 'en' : 'zh-CN';
  current.value = next;
  locale.value = next;
  localStorage.setItem('locale', next);
}

const nextLabel = computed(() => current.value === 'zh-CN' ? 'English' : '中文');
</script>

<style scoped>
.locale-toggle {
  width: 34px; height: 34px;
  display: grid; place-items: center;
  background: transparent; border: 1px solid var(--color-border, var(--color-border));
  border-radius: 8px; color: var(--color-text-secondary, #6b7280);
  cursor: pointer; font-size: 12px; font-weight: 600;
  transition: all .15s; font-family: inherit;
}
.locale-toggle:hover { color: var(--color-text); border-color: var(--color-text-tertiary); }
</style>
