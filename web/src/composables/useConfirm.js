/**
 * 确认弹窗 composable（单例模式）
 *
 * 用法：
 *   const confirm = useConfirm();
 *   const ok = await confirm.open({ title: '删除?', message: '确定吗?' });
 *
 * 返回 true = 用户点了确认，false/undefined = 用户取消了
 *
 * 【单例设计】所有组件共享同一个 state，因此任何地方调用 open()
 * 都会更新 App.vue 中绑定到 <ConfirmModal> 的同一个 state。
 *
 * 【async 支持】open() 返回 Promise，由 onConfirm/onCancel 解析。
 * ConfirmModal 通过 @confirm/@cancel 事件触发 useConfirm 的对应方法，
 * 不再依赖 emit 返回 Promise（Vue emit 返回的是组件实例非 Promise）。
 *
 * 【覆盖保护】连续 open 时，先 resolve 旧 Promise 为 false（视为取消），
 * 避免 Promise 泄漏与调用方永久 await。
 */

import { reactive } from 'vue';
import i18n from '../i18n.js';

// ── 模块级单例状态（所有 useConfirm() 调用共享） ──
const state = reactive({
  visible: false,
  title: '',
  message: '',
  confirmText: '',
  size: 'sm',
  async: false,
});

let resolvePromise = null;

function open(opts = {}) {
  // 覆盖保护：若已有未解析的 Promise，先 resolve false（视为取消）
  if (resolvePromise) {
    resolvePromise(false);
    resolvePromise = null;
  }

  state.title = opts.title || i18n.global.t('common.confirm_action');
  state.message = opts.message || '';
  state.confirmText = opts.confirmText || i18n.global.t('common.confirm');
  state.size = opts.size || 'sm';
  state.async = !!opts.async;
  state.visible = true;

  return new Promise((resolve) => {
    resolvePromise = resolve;
  });
}

function onConfirm() {
  state.visible = false;
  resolvePromise?.(true);
  resolvePromise = null;
}

function onCancel() {
  state.visible = false;
  resolvePromise?.(false);
  resolvePromise = null;
}

export function useConfirm() {
  return {
    state,
    open,
    onConfirm,
    onCancel,
  };
}
