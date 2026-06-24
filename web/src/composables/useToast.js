import { inject } from 'vue';

/**
 * 全局 Toast 提示 hook
 * 用法：
 *   const toast = useToast();
 *   toast.success('操作成功');
 *   toast.error('出错了');
 *   toast.warning('警告信息');
 *   toast.info('提示信息');
 */
export function useToast() {
  const showToast = inject('toast', () => {});
  return {
    success(msg) { showToast(msg, 'success'); },
    error(msg) { showToast(msg, 'error'); },
    warning(msg) { showToast(msg, 'warning'); },
    info(msg) { showToast(msg, 'info'); },
  };
}
