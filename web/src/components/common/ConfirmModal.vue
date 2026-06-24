<template>
  <Teleport to="body">
    <transition name="modal">
      <div v-if="visible" class="modal-mask" @mousedown="onMaskDown" @click="onMaskClick">
        <div class="modal" :class="sizeClass" role="dialog" aria-modal="true">
          <header class="modal-head">
            <h3>{{ title }}</h3>
            <button class="modal-close" @click="onCancel" aria-label="close">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </header>
          <div class="modal-body">
            <p class="confirm-text">{{ message }}</p>
          </div>
          <footer class="modal-foot">
            <button type="button" class="btn-ghost" @click="onCancel">{{ t('common.cancel') }}</button>
            <button type="button" class="btn-danger" @click="onConfirm">{{ confirmText }}</button>
          </footer>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '' },
  size: { type: String, default: 'sm' },
  // async 属性保留向后兼容，但 ConfirmModal 不再自行管理 loading 态。
  // async 确认场景下，调用方 await confirm.open() 返回的 Promise，
  // 在 await 期间自行控制 UI（如按钮 disabled）。ConfirmModal 只负责 emit 事件。
  async: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});
const sizeClass = computed(() => {
  if (props.size === 'lg') return 'modal-lg';
  if (props.size === 'sm') return 'modal-sm';
  return '';
});

let mdX = 0, mdY = 0, mdOnMask = false;
function onMaskDown(e) { mdOnMask = e.target === e.currentTarget; mdX = e.clientX; mdY = e.clientY; }
function onMaskClick(e) {
  if (!mdOnMask || e.target !== e.currentTarget) { mdOnMask = false; return; }
  const dx = Math.abs(e.clientX - mdX), dy = Math.abs(e.clientY - mdY);
  mdOnMask = false;
  if (dx < 5 && dy < 5) onCancel();
}
function onConfirm() {
  // 只 emit 事件，由 useConfirm 的 onConfirm 解析 Promise
  // 不在此处关闭弹窗，useConfirm.onConfirm 会设置 state.visible = false
  emit('confirm');
}
function onCancel() {
  emit('cancel');
  visible.value = false;
}
</script>
