import { ref } from 'vue';

// 本地错误存储（最近 50 条）
const errorLog = ref([]);
const MAX_ERRORS = 50;

function reportError(error, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    message: error?.message || String(error),
    stack: error?.stack || '',
    context,
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  // 添加到本地日志
  errorLog.value.unshift(entry);
  if (errorLog.value.length > MAX_ERRORS) {
    errorLog.value = errorLog.value.slice(0, MAX_ERRORS);
  }

  // 输出到控制台
  console.error('[Error Report]', entry.message, entry);

  // 可选：发送到后端（如果有错误收集接口）
  // fetch('/api/error-report', { method: 'POST', body: JSON.stringify(entry) }).catch(() => {});

  return entry;
}

// 全局错误处理（单例：避免重复添加监听器导致内存泄漏）
let handlersInstalled = false;
let errorHandler = null;
let rejectionHandler = null;

function setupGlobalErrorHandler() {
  if (handlersInstalled) return () => {};
  errorHandler = (event) => {
    reportError(event.error || event.message, { type: 'window.error', filename: event.filename, line: event.lineno });
  };
  rejectionHandler = (event) => {
    reportError(event.reason, { type: 'unhandledrejection' });
  };
  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', rejectionHandler);
  handlersInstalled = true;

  // 返回清理函数（用于测试或应用卸载场景）
  return () => {
    window.removeEventListener('error', errorHandler);
    window.removeEventListener('unhandledrejection', rejectionHandler);
    handlersInstalled = false;
  };
}

export function useErrorReport() {
  return {
    errorLog,
    reportError,
    setupGlobalErrorHandler,
  };
}
