/**
 * 剪贴板复制 composable
 * 统一 copyAndToast 逻辑（原散落在 Cards/Orders/Media 3 处重复定义）
 */
import { copyToClipboard } from './useFormat.js';
import { useToast } from './useToast.js';

export function useClipboard() {
  const toast = useToast();

  /**
   * 复制文本并显示 toast 提示
   * @param {string} text - 要复制的文本
   * @param {string} successMsg - 成功提示消息（已翻译）
   * @param {string} [errorMsg] - 失败提示消息（已翻译），默认与成功消息相同
   */
  async function copyAndToast(text, successMsg, errorMsg) {
    const ok = await copyToClipboard(text);
    ok ? toast.success(successMsg) : toast.error(errorMsg || successMsg);
  }

  return { copyAndToast, copyToClipboard };
}
