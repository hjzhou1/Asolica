<template>
  <span class="spec-chip">{{ label }}</span>
</template>
<script setup>
defineProps({
  label: { type: String, required: true }
});
</script>
<style scoped>
.spec-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: var(--color-border-light);
  color: var(--color-brand-dim);
  margin-right: 4px;
}
</style>
