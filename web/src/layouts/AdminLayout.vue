<template>
  <div v-if="isAuthed" class="admin-layout">
    <!-- 移动端侧边栏开关（CSS-only checkbox hack，无需脚本） -->
    <input type="checkbox" id="admin-sidebar-toggle" class="sidebar-toggle-input" />

    <!-- 顶栏 -->
    <header class="topbar">
      <div class="topbar-left">
        <label for="admin-sidebar-toggle" class="sidebar-toggle" aria-label="Menu">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </label>
        <a class="brand" href="#/">
          <BrandLogo size="sm" color="var(--color-brand)" />
          <span class="brand-text">{{ t('admin.brand_text') }}</span>
        </a>
      </div>
      <div class="topbar-right">
        <LocaleToggle />
        <span class="admin-name" v-if="adminState.admin">
          {{ adminState.admin.name || adminState.admin.username || t('admin.admin_name') }}
        </span>
        <button class="btn-logout" @click="onLogout">{{ t('admin.logout_btn') }}</button>
      </div>
    </header>

    <div class="body">
      <!-- 移动端遮罩（点击关闭侧边栏） -->
      <label for="admin-sidebar-toggle" class="sidebar-overlay" aria-hidden="true"></label>

      <!-- 左侧栏 -->
      <aside class="sidebar">
        <nav class="menu">
          <RouterLink
            v-for="item in menus"
            :key="item.name"
            :to="{ name: item.name }"
            class="menu-item"
            active-class="is-active"
          >
            <span class="menu-icon" v-html="item.icon" />
            <span class="menu-text">{{ item.label }}</span>
          </RouterLink>
        </nav>
      </aside>

      <!-- 主内容区 -->
      <main class="content">
        <RouterView v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </RouterView>
      </main>
    </div>
  </div>
  <div v-else class="admin-loading">
    <p>正在验证身份...</p>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAdmin } from '../stores/admin.js';
import { useConfirm } from '../composables/useConfirm.js';
import BrandLogo from '../components/common/BrandLogo.vue';
import LocaleToggle from '../components/common/LocaleToggle.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { state: adminState, isAuthed, logout } = useAdmin();
const confirm = useConfirm();

const menus = computed(() => [
  { name: 'admin-home', label: t('admin.title'), icon: `<svg viewBox="0 0 20 20" fill="none"><rect x="2.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="11.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="2.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="11.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4"/></svg>` },
  { name: 'admin-dingdan', label: t('admin.orders_mgmt'), icon: `<svg viewBox="0 0 20 20" fill="none"><path d="M4 5h12v10H4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M4 5l6 4 6-4" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>` },
  { name: 'admin-shangpin', label: t('admin.products_mgmt'), icon: `<svg viewBox="0 0 20 20" fill="none"><path d="M3 6h14l-1.5 10.5a1 1 0 0 1-1 .9H5.5a1 1 0 0 1-1-.9L3 6Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M7 6V4a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.4"/></svg>` },
  { name: 'admin-fenlei', label: t('admin.categories'), icon: `<svg viewBox="0 0 20 20" fill="none"><rect x="2.5" y="3.5" width="15" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="2.5" y="11.5" width="15" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/></svg>` },
  { name: 'admin-kami', label: t('admin.cards_mgmt'), icon: `<svg viewBox="0 0 20 20" fill="none"><rect x="2.5" y="6" width="15" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/><circle cx="6.5" cy="10.5" r="1" fill="currentColor"/><path d="M10 10h5M10 12h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
  { name: 'admin-youhuima', label: t('admin.coupons_mgmt'), icon: `<svg viewBox="0 0 20 20" fill="none"><path d="M3 6h14v8H3z" stroke="currentColor" stroke-width="1.4"/><path d="M6 10h2M12 10h2M9 10h2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
  { name: 'admin-mima', label: t('admin.change_password'), icon: `<svg viewBox="0 0 20 20" fill="none"><rect x="4" y="9" width="12" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
  { name: 'admin-media', label: t('admin.media'), icon: `<svg viewBox="0 0 20 20" fill="none"><path d="M2.5 6.5l7.5-3.5 7.5 3.5v7l-7.5 3.5-7.5-3.5v-7z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="7" cy="9" r="1.2" fill="currentColor"/><path d="M2.5 6.5l7.5 3.5 7.5-3.5M10 10v7" stroke="currentColor" stroke-width="1.4"/></svg>` },
  { name: 'admin-settings', label: t('admin.settings'), icon: `<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.3"/></svg>` },
  { name: 'admin-email-templates', label: t('admin.email_templates'), icon: `<svg viewBox="0 0 20 20" fill="none"><rect x="2.5" y="4.5" width="15" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 5.5l7.5 5 7.5-5" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>` },
  { name: 'admin-email-queue', label: t('admin.email_queue'), icon: `<svg viewBox="0 0 20 20" fill="none"><path d="M3 5h14v10H3z" stroke="currentColor" stroke-width="1.4"/><path d="M3 5l7 5 7-5" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="15" cy="14" r="2.5" fill="#ef4444" stroke="#fff" stroke-width="1"/></svg>` },
  { name: 'admin-logs', label: t('admin.logs'), icon: `<svg viewBox="0 0 20 20" fill="none"><path d="M4 4h12v12H4V4z" stroke="currentColor" stroke-width="1.5"/><path d="M7 8h6M7 12h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>` },
]);

async function onLogout() {
  const ok = await confirm.open({ title: t('admin.logout_title'), message: t('admin.logout_message') });
  if (!ok) return;
  logout();
  router.push({ name: 'admin-login' });
}

// 登录拦截：未登录或 token 过期 → 跳登录页
// 使用 isAuthed.value（含过期检查）而非仅检查 token 存在性
// 在 onMounted 中执行，避免在 setup 顶层同步触发 router.replace 导致导航警告
onMounted(() => {
  if (!adminState.token || !isAuthed.value) {
    logout();
    router.replace({ name: 'admin-login', query: { redirect: route.fullPath } });
  }
});
</script>

<style scoped>
.admin-layout {
  min-height: 100vh;
  background: var(--color-bg-surface);
  color: var(--color-text);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', 'Segoe UI', sans-serif;
  display: flex;
  flex-direction: column;
  position: relative;
}

.admin-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  font-size: 14px;
}

/* ====== 移动端侧边栏开关（checkbox hack） ====== */
.sidebar-toggle-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.sidebar-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  margin-right: 4px;
  border-radius: var(--radius-full);
  color: var(--color-text);
  cursor: pointer;
  transition: background .15s var(--ease-out);
}
.sidebar-toggle:hover { background: var(--color-bg-hover); }
.sidebar-toggle svg { width: 20px; height: 20px; }

/* ====== 顶栏（玻璃质感） ====== */
.topbar {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--color-bg-glass);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  backdrop-filter: blur(12px) saturate(180%);
  border-bottom: 1px solid var(--color-border-muted);
}
.topbar-left { display: flex; align-items: center; gap: 4px; }
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--color-text);
}
.brand-mark { width: 28px; height: 28px; color: var(--color-text); display: block; flex: none; }
.brand-text { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }

.topbar-right { display: flex; align-items: center; gap: 14px; }
.admin-name {
  font-size: 13px;
  color: var(--color-text-secondary);
}
.btn-logout {
  height: 36px;
  padding: 0 16px;
  background: transparent;
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-full);
  font-size: 13px;
  color: var(--color-brand-dim);
  cursor: pointer;
  font-family: inherit;
  transition: all .15s var(--ease-out);
}
.btn-logout:hover {
  background: var(--color-brand);
  color: var(--color-text-inverse);
  border-color: var(--color-brand);
}

/* ====== 主体 ====== */
.body {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* 移动端遮罩（默认隐藏，桌面端不显示） */
.sidebar-overlay {
  display: none;
}

/* ====== 侧边栏 ====== */
.sidebar {
  width: 224px;
  flex: none;
  background: var(--color-bg-page);
  border-right: 1px solid var(--color-border);
  padding: 16px 12px;
}
.menu { display: flex; flex-direction: column; gap: 4px; }

/* 导航项：胶囊样式 */
.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 40px;
  padding: 0 16px;
  border-radius: var(--radius-full);
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: all .15s var(--ease-out);
  position: relative;
}
.menu-item:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}
.menu-item.is-active {
  color: var(--color-text);
  background: var(--color-bg-surface);
  font-weight: 600;
}
.menu-icon {
  width: 18px;
  height: 18px;
  flex: none;
  display: grid;
  place-items: center;
  color: currentColor;
}
.menu-icon svg { width: 100%; height: 100%; }
.menu-text { font-size: 14px; }

/* ====== 子菜单（精细化控制，预留可扩展结构） ====== */
.menu-sub {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 20px;
  margin-top: 2px;
}
.menu-subitem {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-tertiary);
  text-decoration: none;
  transition: all .15s var(--ease-out);
}
.menu-subitem:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}
.menu-subitem.is-active {
  color: var(--color-text);
  background: var(--color-bg-surface);
}

/* ====== 主内容区 ====== */
.content {
  flex: 1;
  min-width: 0;
  padding: 32px 32px 48px;
  overflow-x: auto;
}

/* ====== 响应式：移动端抽屉式侧边栏 ====== */
@media (max-width: 880px) {
  .topbar { padding: 0 16px; }
  .sidebar-toggle { display: inline-flex; }

  .body { flex-direction: row; }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 60px 0 0 0;
    background: rgba(15, 15, 19, 0.32);
    opacity: 0;
    pointer-events: none;
    transition: opacity .3s var(--ease-smooth);
    z-index: var(--z-drawer, 200);
    cursor: pointer;
  }
  .sidebar-toggle-input:checked ~ .body .sidebar-overlay {
    opacity: 1;
    pointer-events: auto;
  }

  .sidebar {
    position: fixed;
    top: 60px;
    left: 0;
    bottom: 0;
    width: 248px;
    max-width: 80vw;
    transform: translateX(-100%);
    transition: transform .3s var(--ease-smooth);
    z-index: var(--z-drawer);
    box-shadow: var(--shadow-lg);
    overflow-y: auto;
  }
  .sidebar-toggle-input:checked ~ .body .sidebar {
    transform: translateX(0);
  }

  .menu { flex-direction: column; gap: 4px; }
  .content { padding: 20px 16px 32px; }
  .brand-text { font-size: 14px; }
}
@media (max-width: 560px) {
  .topbar { padding: 0 12px; }
  .admin-name { display: none; }
  .content { padding: 16px 12px 24px; }
}
</style>
