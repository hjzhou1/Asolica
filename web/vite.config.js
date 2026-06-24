import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * 自定义插件：强制移除构建产物 index.html 中的 crossorigin 属性
 *
 * 原因：Vite 5.4.x 在 build.crossorigin: false 时仍会注入 crossorigin 属性，
 * 导致移动端浏览器以 CORS 模式加载同源脚本。当反向代理未正确转发 CORS 头时，
 * 脚本加载静默失败 → 页面空白（桌面端因 CORS 策略宽松不受影响）。
 */
function stripCrossorigin() {
  return {
    name: 'strip-crossorigin',
    apply: 'build',
    transformIndexHtml(html) {
      return html
        .replace(/\s+crossorigin(?=\s|>)/gi, '')
        .replace(/\s+crossorigin="[^"]*"/gi, '');
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), stripCrossorigin()],
  server: {
    port: 5173,
    host: 'localhost',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3200',
        changeOrigin: true,
      },
    },
  },
  build: {
    crossorigin: false,
    chunkSizeWarningLimit: 800,
  },
});
