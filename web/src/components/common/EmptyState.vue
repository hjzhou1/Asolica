<template>
  <div class="empty-state">
    <div class="empty-svg" v-html="svgIcon" />
    <h3 v-if="title" class="empty-title">{{ title }}</h3>
    <p v-if="desc" class="empty-desc">{{ desc }}</p>
    <button v-if="actionLabel" class="empty-action" @click="$emit('action')">
      {{ actionLabel }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  type: { type: String, default: 'box' },
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
});

defineEmits(['action']);

const svgs = {
  search: `<svg viewBox="0 0 64 64" fill="none"><circle cx="27" cy="27" r="14" stroke="#d1d5db" stroke-width="1.5"/><path d="m37.5 37.5 12 12" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"/><path d="M21 23l12 12M33 23L21 35" stroke="#111827" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  box: `<svg viewBox="0 0 64 64" fill="none"><rect x="10" y="20" width="44" height="34" rx="6" stroke="#d1d5db" stroke-width="1.5"/><path d="M10 30h44" stroke="#d1d5db" stroke-width="1.5"/><path d="M24 20v-6a4 4 0 018 0v6M32 20v-6a4 4 0 018 0v6" stroke="#d1d5db" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  mail: `<svg viewBox="0 0 64 64" fill="none"><rect x="8" y="16" width="48" height="32" rx="6" stroke="#d1d5db" stroke-width="1.5"/><path d="M8 22l24 14 24-14" stroke="#d1d5db" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  card: `<svg viewBox="0 0 64 64" fill="none"><rect x="10" y="14" width="44" height="36" rx="6" stroke="#d1d5db" stroke-width="1.5"/><line x1="10" y1="26" x2="54" y2="26" stroke="#d1d5db" stroke-width="1.5"/><rect x="16" y="34" width="16" height="8" rx="2" stroke="#d1d5db" stroke-width="1.2"/></svg>`,
};

const svgIcon = computed(() => svgs[props.type] || svgs.box);
</script>

<style scoped>
.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 48px 24px; text-align: center; gap: 12px;
}
.empty-svg {
  width: 72px; height: 72px; color: var(--color-text); opacity: 0.7;
}
.empty-svg :deep(svg) { width: 100%; height: 100%; }
.empty-title {
  font-size: 17px; font-weight: 600; color: var(--color-text); margin: 4px 0 0;
}
.empty-desc { font-size: 13px; color: var(--color-text-tertiary); margin: 0; max-width: 320px; line-height: 1.6; }
.empty-action {
  margin-top: 8px;
  padding: 8px 22px;
  background: var(--color-brand); color: var(--color-text-inverse); border: none;
  border-radius: 6px; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: background .15s; font-family: inherit;
}
.empty-action:hover { background: var(--color-brand-hover); }
</style>
