<template>
  <div class="page-home">
    <header class="page-head">
      <h1 class="page-title">{{ t('dashboard.title') }}</h1>
      <p class="page-subtitle">{{ t('dashboard.subtitle') }}</p>
    </header>

    <div v-if="stats.lowStockCount > 0" class="alert-warn">
      <svg class="warn-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 2 1.5 13h13L8 2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M8 6v3.5M8 11.5h0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
      {{ t('admin.stock_warning', { count: stats.lowStockCount }) }}
      <router-link to="/admins/kami">{{ t('dashboard.go_manage') }}</router-link>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">{{ t('dashboard.order_count') }}</div>
        <div class="stat-num">{{ loading ? '—' : (stats.orderCount ?? 0) }}</div>
        <div class="stat-foot">{{ t('dashboard.order_count_foot') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t('dashboard.revenue') }}</div>
        <div class="stat-num">&yen;{{ loading ? '—' : formatMoney(stats.totalAmount) }}</div>
        <div class="stat-foot">{{ t('dashboard.revenue_foot') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t('dashboard.product_count') }}</div>
        <div class="stat-num">{{ loading ? '—' : (stats.productCount ?? 0) }}</div>
        <div class="stat-foot">{{ t('dashboard.product_count_foot') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t('dashboard.card_stock') }}</div>
        <div class="stat-num">{{ loading ? '—' : (stats.cardRemain ?? 0) }}</div>
        <div class="stat-foot">{{ t('dashboard.card_stock_foot') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t('dashboard.today_orders') }}</div>
        <div class="stat-num">{{ loading ? '—' : (stats.todayOrders ?? 0) }}</div>
        <div class="stat-foot">{{ t('dashboard.today_orders_foot') }}</div>
      </div>
      <div class="stat-card" v-if="stats.lowStockCount > 0" style="border-color: var(--color-danger-bg);">
        <div class="stat-label" style="color: var(--color-danger);">{{ t('dashboard.low_stock') }}</div>
        <div class="stat-num" style="color: var(--color-danger);">{{ stats.lowStockCount }}</div>
        <div class="stat-foot" style="color: var(--color-danger);">{{ t('dashboard.low_stock_foot') }}</div>
      </div>
    </div>

    <section v-if="trend.length" class="panel" style="margin-bottom:24px;">
      <div class="panel-head"><h2>{{ t('dashboard.trend', { days }) }}</h2></div>
      <div class="chart">
        <div v-for="t in trend" :key="t.date" class="bar-col">
          <div class="bar-label">{{ t.date.slice(5) }}</div>
          <div class="bar-track"><div class="bar" :style="{height: maxOrders ? (t.orders/maxOrders*100)+'%' : '0%'}"></div></div>
          <div class="bar-num">{{ t.orders }}</div>
        </div>
      </div>
    </section>

    <div class="grid-2col">
      <section class="panel">
        <div class="panel-head">
          <h2>{{ t('dashboard.recent_orders') }}</h2>
          <router-link to="/admins/dingdan" class="link-btn">{{ t('dashboard.view_all') }}</router-link>
        </div>
        <div v-if="loading" class="state-block"><div class="spinner-lg" aria-hidden="true" /><p>{{ t('dashboard.loading') }}</p></div>
        <div v-else-if="!recentOrders.length" class="state-block empty">
          <p>{{ t('dashboard.no_orders') }}</p>
        </div>
        <ul v-else class="rec-list">
          <li v-for="o in recentOrders" :key="o.id">
            <div class="rec-main">
              <div class="rec-title">{{ o.productName }}</div>
              <div class="rec-sub">{{ o.orderNo }} &middot; {{ o.contact || '—' }}</div>
            </div>
            <div class="rec-side">
              <div class="rec-amount">&yen;{{ formatPrice(o.amount) }}</div>
              <StatusBadge :status="o.status" />
            </div>
          </li>
        </ul>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>{{ t('dashboard.quick_links') }}</h2>
        </div>
        <div class="quick-grid">
          <router-link to="/admins/fenlei" class="quick-card">
            <div class="quick-icon" style="background: #f3f4f6; color: #111827;">
              <svg viewBox="0 0 20 20" fill="none"><path d="M3 4h6M3 10h6M3 16h6M13 4h4M13 10h4M13 16h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </div>
            <div class="quick-text">
              <div class="quick-title">{{ t('dashboard.categories') }}</div>
              <div class="quick-sub">{{ stats.productCount == null ? '—' : t('dashboard.x_products', { count: stats.productCount }) }}</div>
            </div>
          </router-link>
          <router-link to="/admins/shangpin" class="quick-card">
            <div class="quick-icon" style="background: #f3f4f6; color: #111827;">
              <svg viewBox="0 0 20 20" fill="none"><path d="M4 6l1.5-2h9L16 6M4 6v10a1 1 0 001 1h10a1 1 0 001-1V6M4 6h12M8 10h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="quick-text">
              <div class="quick-title">{{ t('dashboard.products') }}</div>
              <div class="quick-sub">{{ t('dashboard.manage_price') }}</div>
            </div>
          </router-link>
          <router-link to="/admins/kami" class="quick-card">
            <div class="quick-icon" style="background: #f3f4f6; color: #111827;">
              <svg viewBox="0 0 20 20" fill="none"><rect x="3" y="6" width="14" height="8" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M3 10h14" stroke="currentColor" stroke-width="1.6"/></svg>
            </div>
            <div class="quick-text">
              <div class="quick-title">{{ t('dashboard.cards') }}</div>
              <div class="quick-sub">{{ t('dashboard.x_cards', { count: stats.cardRemain ?? 0 }) }}</div>
            </div>
          </router-link>
          <router-link to="/admins/dingdan" class="quick-card">
            <div class="quick-icon" style="background: #f3f4f6; color: #111827;">
              <svg viewBox="0 0 20 20" fill="none"><path d="M5 4h10l1 3v8a1 1 0 01-1 1H5a1 1 0 01-1-1V7l1-3zM4 8h12M8 12h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="quick-text">
              <div class="quick-title">{{ t('dashboard.orders') }}</div>
              <div class="quick-sub">{{ t('dashboard.x_orders', { count: stats.orderCount ?? 0 }) }}</div>
            </div>
          </router-link>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { getDashboard, listOrders, getTrend } from '../../api/admin.js';
import { formatMoney, formatPrice } from '../../composables/useFormat.js';
import StatusBadge from '../../components/shop/StatusBadge.vue';

const { t } = useI18n();
const toast = inject('toast', () => {});

const loading = ref(true);
const stats = ref({ orderCount: 0, totalAmount: 0, productCount: 0, cardRemain: 0, lowStockCount: 0, pendingOrders: 0, todayOrders: 0 });
const orders = ref([]);
const trend = ref([]);
const days = ref(7);
const maxOrders = ref(0);

const recentOrders = computed(() =>
  [...orders.value]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 5)
);

onMounted(async () => {
  try {
    const [d, list] = await Promise.all([getDashboard(), listOrders({ page: 1, pageSize: 10 })]);
    stats.value = d || stats.value;
    // listOrders 现在返回服务端分页对象 { data, total, ... }，兼容旧格式（数组）
    orders.value = Array.isArray(list) ? list : (list?.data || []);
    // 趋势
    const tr = await getTrend(7);
    trend.value = Array.isArray(tr) ? tr : (tr?.data || []);
    maxOrders.value = Math.max(1, ...trend.value.map(t => t.orders));
  } catch (e) {
    toast(e?.message || t('dashboard.load_failed') || '加载失败', 'error');
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.page-home { max-width: 1200px; }
.page-head { margin-bottom: 28px; }
.page-title { font-size: 24px; font-weight: 700; color: var(--color-text); margin: 0 0 6px; letter-spacing: -0.02em; }
.page-subtitle { font-size: 13px; color: var(--color-text-secondary); margin: 0; }

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  background: var(--color-bg-page);
  border: 1px solid rgba(17,24,39,0.06);
  border-radius: 14px;
  padding: 20px 22px;
  transition: all .2s;
}
.stat-card:hover {
  border-color: rgba(17,24,39,0.12);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(17, 24, 39, 0.04);
}
.stat-label { font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px; }
.stat-num { font-size: 28px; font-weight: 700; color: var(--color-text); letter-spacing: -0.02em; line-height: 1.1; }
.stat-foot { font-size: 11px; color: var(--color-text-tertiary); margin-top: 8px; }

.chart { display: flex; align-items: flex-end; gap: 8px; padding: 20px; height: 180px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
.bar-label { font-size: 10px; color: var(--color-text-tertiary); white-space: nowrap; }
.bar-num { font-size: 11px; color: var(--color-text-secondary); font-weight: 500; }
.bar-track { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.bar { width: 70%; max-width: 36px; background: var(--color-text); border-radius: 4px 4px 0 0; min-height: 2px; transition: height .3s; }

.alert-warn {
  padding: 14px 20px;
  background: #f9fafb;
  border: 1px solid rgba(17,24,39,0.10);
  border-radius: 12px;
  color: var(--color-text);
  font-size: 14px;
  margin-bottom: 20px;
  display: flex; align-items: center; gap: 12px;
}
.alert-warn a { color: var(--color-text); font-weight: 600; margin-left: auto; text-underline-offset: 2px; }
.alert-warn a:hover { color: var(--color-text-secondary); }
.warn-icon { width: 16px; height: 16px; color: var(--color-text); flex: none; }

.grid-2col { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
@media (max-width: 800px) { .grid-2col { grid-template-columns: 1fr; } }

.panel {
  background: var(--color-bg-page);
  border: 1px solid rgba(17,24,39,0.06);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(17,24,39,0.06);
}
.panel-head h2 { font-size: 14px; font-weight: 600; color: var(--color-text); margin: 0; }

.rec-list { list-style: none; margin: 0; padding: 0; }
.rec-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(17,24,39,0.04);
  gap: 12px;
}
.rec-list li:last-child { border-bottom: 0; }
.rec-main { min-width: 0; }
.rec-title { font-size: 14px; color: var(--color-text); font-weight: 500; }
.rec-sub { font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; }
.rec-side { display: flex; align-items: center; gap: 10px; flex: none; }
.rec-amount { font-size: 14px; font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; }

.quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px; }
.quick-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--color-bg-surface);
  border: 1px solid rgba(17,24,39,0.06);
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: all .15s;
}
.quick-card:hover {
  background: var(--color-bg-page);
  border-color: rgba(17,24,39,0.18);
}
.quick-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.quick-icon svg { width: 20px; height: 20px; }
.quick-text { min-width: 0; }
.quick-title { font-size: 13px; font-weight: 600; color: var(--color-text); }
.quick-sub { font-size: 11px; color: var(--color-text-tertiary); margin-top: 2px; }

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  color: var(--color-text-tertiary);
  font-size: 13px;
}

@media (max-width: 560px) {
  .stat-num { font-size: 22px; }
  .stat-card { padding: 16px 18px; }
}
</style>
