import { createApp } from 'vue';
import App from './App.vue';
import router from './router/index.js';
import i18n from './i18n.js';
import { useErrorReport } from './composables/useErrorReport.js';

// 全局样式
import './styles/global.css';
import './styles/admin.css';
import './styles/shop.css';

// 初始化全局错误处理（window.error / unhandledrejection）
const { setupGlobalErrorHandler, reportError } = useErrorReport();
setupGlobalErrorHandler();

const app = createApp(App);

// Vue 应用级错误处理：捕获组件渲染/生命周期错误，防止整页白屏
// 参考成熟项目：错误边界 + 降级渲染
app.config.errorHandler = (err, instance, info) => {
  reportError(err, {
    type: 'vue.errorHandler',
    info,
    component: instance?.$options?.name || instance?.$options?.__name || 'Anonymous',
  });
};

app.use(router);
app.use(i18n);
app.mount('#app');
