<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">{{ t('orders.title') }}</h1>
        <p class="page-subtitle">{{ t('orders.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn-ghost" :class="{ 'is-loading': loading }" @click="refresh">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 8a5 5 0 11-1.5-3.5L13 6M13 3v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>{{ t('orders.refresh') }}</span>
        </button>
        <button class="btn-primary" :disabled="!products.length" @click="openCreate">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <span>{{ t('orders.manual_create') }}</span>
        </button>
      </div>
    </header>

    <div class="card">
      <div class="toolbar">
        <input v-model="filter.keyword" class="search" type="search" :placeholder="t('orders.search_placeholder')" />
        <select v-model="filter.status" @change="refresh">
          <option value="">{{ t('orders.all_status') }}</option>
          <option value="paid">{{ t('orders.status_paid') }}</option><option value="pending">{{ t('orders.status_pending') }}</option>
          <option value="delivered">{{ t('orders.status_delivered') }}</option><option value="refunded">{{ t('orders.status_refunded') }}</option><option value="failed">{{ t('orders.status_failed') }}</option>
          <option value="expired">{{ t('orders.status_expired') }}</option>
        </select>
        <select v-model="filter.product" @change="refresh">
          <option value="">{{ t('orders.all_products') }}</option>
          <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <div class="grow" />
        <span class="cell-muted">{{ t('orders.x_orders', { count: total }) }}</span>
      </div>

      <div v-if="loading" class="state-block"><div class="spinner-lg" aria-hidden="true" /><p>{{ t('orders.loading') }}</p></div>
      <div v-else-if="!paged.length" class="state-block empty">
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect x="8" y="14" width="48" height="36" rx="3" stroke="#d1d5db" stroke-width="1.5"/>
          <path d="M8 24h48" stroke="#d1d5db" stroke-width="1.5"/>
          <path d="M16 34h12M16 40h20" stroke="#d1d5db" stroke-width="1.5"/>
        </svg>
        <h3>{{ t('orders.no_orders') }}</h3>
        <p>{{ t('orders.no_orders_hint') }}</p>
      </div>

      <table v-else class="data-table">
        <thead>
          <tr>
            <th class="col-order-no">{{ t('orders.col_order_no') }}</th><th>{{ t('orders.col_product') }}</th><th>{{ t('orders.col_spec') }}</th><th>{{ t('orders.col_contact') }}</th>
            <th class="col-qty">{{ t('orders.col_qty') }}</th><th class="col-amount">{{ t('orders.col_amount') }}</th>
            <th>{{ t('orders.col_status') }}</th><th class="col-time">{{ t('orders.col_created_at') }}</th><th class="col-actions">{{ t('orders.col_actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in paged" :key="o.id">
            <td class="col-order-no"><span class="mono cell-name" :title="o.orderNo">{{ o.orderNo }}</span></td>
            <td>{{ o.productName }}</td>
            <td><span v-if="o.specName" class="card-type-pill">{{ o.specName }}</span><span v-else class="cell-muted">—</span></td>
            <td class="cell-muted">{{ o.contact || '—' }}</td>
            <td class="col-qty mono">x {{ o.qty }}</td>
            <td class="col-amount mono">&yen; {{ formatPrice(o.amount) }}</td>
            <td><StatusBadge :status="o.status" /></td>
            <td class="col-time cell-muted">{{ formatTime(o.createdAt) }}</td>
            <td class="col-actions">
              <button class="link-btn" @click="openDetail(o)">{{ t('orders.detail') }}</button>
              <button class="link-btn" :disabled="o.status !== 'paid' && o.status !== 'delivered'" @click="onReissue(o)">{{ t('orders.reissue') }}</button>
              <button class="link-btn danger" @click="onDelete(o)">{{ t('orders.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="total > pageSize" class="pagination">
        <button class="btn-sm" :disabled="page <= 1" @click="page--">{{ t('common.prev_page') }}</button>
        <span class="cell-muted">{{ t('orders.page_of', { page, total: totalPages, size: pageSize }) }}</span>
        <button class="btn-sm" :disabled="page >= totalPages" @click="page++">{{ t('common.next_page') }}</button>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <transition name="modal">
      <div v-if="detail.open" class="modal-mask" @click.self="detail.open = false">
        <div class="modal modal-lg" role="dialog" aria-modal="true">
          <header class="modal-head">
            <h3>{{ t('orders.detail_title') }}</h3>
            <button class="modal-close" @click="detail.open = false" aria-label="close">&times;</button>
          </header>
          <div class="modal-body">
            <div class="kv">
              <div class="kv-row"><span class="kv-k">{{ t('orders.kv_order_no') }}</span><span class="kv-v mono">{{ detail.order.orderNo }}</span></div>
              <div class="kv-row"><span class="kv-k">{{ t('orders.kv_product') }}</span><span class="kv-v">{{ detail.order.productName }}</span></div>
              <div class="kv-row"><span class="kv-k">{{ t('orders.kv_spec') }}</span><span class="kv-v"><span v-if="detail.order.specName" class="card-type-pill">{{ detail.order.specName }}</span><span v-else class="cell-muted">—</span></span></div>
              <div class="kv-row"><span class="kv-k">{{ t('orders.kv_unit_price') }}</span><span class="kv-v mono">&yen; {{ formatPrice(detail.order.unitPrice || 0) }}</span></div>
              <div class="kv-row"><span class="kv-k">{{ t('orders.kv_qty') }}</span><span class="kv-v mono">x {{ detail.order.qty }}</span></div>
              <div class="kv-row"><span class="kv-k">{{ t('orders.kv_amount') }}</span><span class="kv-v mono">&yen; {{ formatPrice(detail.order.amount) }}</span></div>
              <div class="kv-row"><span class="kv-k">{{ t('orders.kv_status') }}</span><span class="kv-v"><StatusBadge :status="detail.order.status" /></span></div>
              <div class="kv-row"><span class="kv-k">{{ t('orders.kv_contact') }}</span><span class="kv-v">{{ detail.order.contact || '—' }}</span></div>
              <div class="kv-row"><span class="kv-k">{{ t('orders.kv_created_at') }}</span><span class="kv-v">{{ formatTime(detail.order.createdAt) }}</span></div>
              <div class="kv-row"><span class="kv-k">{{ t('orders.kv_paid_at') }}</span><span class="kv-v">{{ detail.order.paidAt ? formatTime(detail.order.paidAt) : '—' }}</span></div>
              <div class="kv-row"><span class="kv-k">{{ t('orders.kv_payment_method') }}</span><span class="kv-v">{{ detail.order.paymentChannelLabel || '—' }}</span></div>
              <div class="kv-row"><span class="kv-k">{{ t('orders.kv_trade_no') }}</span><span class="kv-v mono">{{ detail.order.paymentTradeNo || '—' }}</span></div>
            </div>
            <div class="card-codes">
              <div class="card-codes-head">
                <span>{{ t('orders.assigned_codes', { assigned: detail.codes.length, qty: detail.order.qty }) }}</span>
                <button v-if="detail.order.status === 'paid' || detail.order.status === 'delivered'" class="link-btn" @click="onReissue(detail.order)">{{ t('orders.re_reissue') }}</button>
              </div>
              <div v-if="!detail.codes.length" class="cell-muted" style="padding:8px 0">{{ t('orders.no_codes') }}</div>
              <ul v-else class="code-list">
                <li v-for="(row, i) in detail.codeRows" :key="i">
                  <div class="code-main">
                    <span class="cell-code">{{ row.content }}</span>
                    <span v-if="row.type || row.durationSeconds" class="card-type-pill" style="margin-left:8px;vertical-align:middle">
                      <span v-if="row.type">{{ row.type }}</span>
                      <span v-if="row.type && row.durationSeconds" class="dot">&middot;</span>
                      <span v-if="row.durationSeconds">{{ durationLabel(row.durationSeconds) }}</span>
                    </span>
                    <span v-if="row.expiry" class="cell-muted" style="margin-left:8px;font-size:12px">{{ t('cards.expiry_at', { date: formatDate(row.expiry) }) }}</span>
                  </div>
                  <button class="link-btn" @click="copyAndToast(row.content, t('orders.copied'), t('orders.copy_failed'))">{{ t('orders.copy') }}</button>
                </li>
              </ul>
            </div>
            <p v-if="detailError" class="form-error">{{ detailError }}</p>
          </div>
          <footer class="modal-foot">
            <button type="button" class="btn-ghost" @click="detail.open = false">{{ t('orders.close') }}</button>
          </footer>
        </div>
      </div>
    </transition>

    <!-- 手工开单 -->
    <transition name="modal">
      <div v-if="modalOpen" class="modal-mask" @click.self="closeCreate">
        <div class="modal" role="dialog" aria-modal="true">
          <header class="modal-head">
            <h3>{{ t('orders.manual_title') }}</h3>
            <button class="modal-close" @click="closeCreate" aria-label="close">&times;</button>
          </header>
          <form class="modal-body" @submit.prevent="onCreate">
            <div class="field" :class="{ 'is-error': errors.productId }">
              <label>{{ t('orders.product') }}<span class="field-tip">{{ t('products.required') }}</span></label>
              <select v-model="form.productId" @change="onProductChange">
                <option value="">{{ t('orders.product_placeholder') }}</option>
                <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <p v-if="errors.productId" class="field-error">{{ errors.productId }}</p>
            </div>
            <div v-if="selectedProduct" class="field" :class="{ 'is-error': errors.specId }">
              <label>{{ t('orders.spec') }}<span class="field-tip">{{ t('orders.spec_tip') }}</span></label>
              <div v-if="!selectedProduct.cardSpecs || !selectedProduct.cardSpecs.length" class="no-spec-hint">{{ t('orders.no_spec_hint') }}</div>
              <div v-else class="spec-pick">
                <button v-for="s in selectedProduct.cardSpecs" :key="s.id" type="button"
                  class="spec-chip" :class="{ 'is-active': form.specId === s.id, 'is-off': s.status === 'off' }"
                  :disabled="s.status === 'off'" :title="s.status === 'off' ? t('orders.spec_off_shelf') : ''"
                  @click="form.specId = s.id">
                  <strong>{{ s.name }}</strong>
                  <span>{{ durationLabel(s.durationSeconds) }} &middot; &yen;{{ Number(s.price).toFixed(2) }}</span>
                  <span v-if="s.status === 'off'" class="off-tag">{{ t('orders.spec_off_tag') }}</span>
                </button>
              </div>
              <p v-if="errors.specId" class="field-error">{{ errors.specId }}</p>
            </div>
            <div class="field field-row" :class="{ 'is-error': errors.qty }">
              <div>
                <label>{{ t('orders.qty') }}<span class="field-tip">{{ t('products.required') }}</span></label>
                <input v-model.number="form.qty" type="number" min="1" step="1" />
              </div>
              <div>
                <label>{{ t('orders.status') }}<span class="field-tip">{{ t('products.required') }}</span></label>
                <select v-model="form.status">
                  <option value="paid">{{ t('orders.status_paid') }}</option><option value="pending">{{ t('orders.status_pending') }}</option><option value="delivered">{{ t('orders.status_delivered') }}</option>
                </select>
              </div>
            </div>
            <p v-if="errors.qty" class="field-error">{{ errors.qty }}</p>
            <div class="field" :class="{ 'is-error': errors.contact }">
              <label>{{ t('orders.contact') }}<span class="field-tip">{{ t('orders.contact_tip') }}</span></label>
              <input v-model="form.contact" type="text" :placeholder="t('orders.contact_placeholder')" maxlength="64" />
              <p v-if="errors.contact" class="field-error">{{ errors.contact }}</p>
            </div>
            <p v-if="formInfo" class="form-ok">{{ t('orders.estimate', { amount: formatPrice(estimate) }) }}</p>
            <p v-if="formError" class="form-error">{{ formError }}</p>
          </form>
          <footer class="modal-foot">
            <button type="button" class="btn-ghost" @click="closeCreate">{{ t('orders.cancel') }}</button>
            <button type="button" class="btn-primary" :disabled="submitting" @click="onCreate">
              <span v-if="submitting" class="spinner" aria-hidden="true" />
              <span>{{ submitting ? t('orders.submitting') : t('orders.create_btn') }}</span>
            </button>
          </footer>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  listOrders, listProducts, listCards,
  createOrder, reissueOrder, deleteOrder,
} from '../../api/admin.js';
import { useToast } from '../../composables/useToast.js';
import { useConfirm } from '../../composables/useConfirm.js';
import { useClipboard } from '../../composables/useClipboard.js';
import { formatTime, formatPrice, formatDate, durationLabel, getCardExpiry } from '../../composables/useFormat.js';
import StatusBadge from '../../components/shop/StatusBadge.vue';

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const { copyAndToast } = useClipboard();

const list = ref([]);
const products = ref([]);
const allCards = ref([]);
const loading = ref(false);
const filter = reactive({ keyword: '', status: '', product: '' });

// 服务端分页状态
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

const modalOpen = ref(false);
const form = reactive({ productId: '', specId: '', qty: 1, contact: '', status: 'paid' });
const errors = reactive({ productId: '', specId: '', qty: '', contact: '' });
const formError = ref('');
const formInfo = ref(true);
const submitting = ref(false);

const detail = reactive({ open: false, order: {}, codes: [], codeRows: [] });
const detailError = ref('');

const selectedProduct = computed(() => products.value.find(p => p.id === form.productId) || null);
const estimate = computed(() => {
  const p = selectedProduct.value;
  if (!p) return '0.00';
  const sp = (p.cardSpecs || []).find(s => s.id === form.specId);
  const unit = sp ? (Number(sp.price) || 0) : 0;
  const q = Math.max(1, Number(form.qty) || 1);
  return (unit * q).toFixed(2);
});

// 前端仅做 product 筛选（后端暂未支持 product 筛选），status/keyword 已下沉到服务端
const paged = computed(() => {
  if (!filter.product) return list.value;
  return list.value.filter(o => o.productId === filter.product);
});

// 监听筛选条件变化时重新从服务端加载
watch(() => [filter.keyword, filter.status], () => {
  page.value = 1;
  refresh();
});

async function refresh() {
  loading.value = true;
  try {
    const [orders, prods, cards] = await Promise.all([
      listOrders({ page: page.value, pageSize, status: filter.status || undefined, keyword: filter.keyword || undefined }),
      listProducts(),
      listCards(),
    ]);
    // 服务端返回 { data, total, page, pageSize, totalPages }
    list.value = orders.data || orders;
    total.value = orders.total || list.value.length;
    products.value = Array.isArray(prods) ? prods : (prods?.data || []);
    allCards.value = Array.isArray(cards) ? cards : (cards?.data || []);
  } catch (e) { toast.error(e?.message || t('orders.load_failed')); }
  finally { loading.value = false; }
}

// 翻页时重新加载
watch(page, () => refresh());

const cardContentMap = computed(() => {
  const m = new Map();
  for (const c of allCards.value) {
    m.set(c.id, c.content);
  }
  return m;
});

function codesOf(order) {
  return (order.cardIds || []).map(id => cardContentMap.value.get(id)).filter(Boolean);
}
function codeRowsOf(order) {
  return (order.cardIds || []).map(id => {
    const c = allCards.value.find(x => x.id === id);
    if (!c) return null;
    return { content: c.content, type: c.type || '', durationSeconds: c.durationSeconds || 0, expiry: getCardExpiry(c) };
  }).filter(Boolean);
}

function openDetail(o) {
  detail.order = { ...o }; detail.codes = codesOf(o); detail.codeRows = codeRowsOf(o); detailError.value = ''; detail.open = true;
}

function openCreate() {
  form.productId = filter.product || ''; form.specId = ''; form.qty = 1; form.contact = ''; form.status = 'paid';
  errors.productId = ''; errors.specId = ''; errors.qty = ''; errors.contact = '';
  formError.value = ''; formInfo.value = true; modalOpen.value = true;
}
function closeCreate() { modalOpen.value = false; }
function onProductChange() { form.specId = ''; errors.specId = ''; }

function validate() {
  errors.productId = ''; errors.specId = ''; errors.qty = ''; errors.contact = '';
  if (!form.productId) { errors.productId = t('orders.err_product'); return false; }
  if (!form.specId) { errors.specId = t('orders.err_spec'); return false; }
  if (!form.qty || form.qty < 1) { errors.qty = t('orders.err_qty'); return false; }
  if (!String(form.contact).trim()) { errors.contact = t('orders.err_contact'); return false; }
  return true;
}
async function onCreate() {
  if (submitting.value) return; if (!validate()) return;
  submitting.value = true; formError.value = '';
  try {
    const o = await createOrder({ productId: form.productId, specId: form.specId, qty: Number(form.qty), contact: form.contact.trim(), status: form.status });
    toast.success(t('orders.toast_created')); modalOpen.value = false; refresh();
    setTimeout(() => openDetail(o), 100);
  } catch (e) { formError.value = e?.message || t('orders.create_failed'); }
  finally { submitting.value = false; }
}

async function onReissue(o) {
  const need = o.qty - (o.cardIds || []).length;
  const ok = await confirm.open({ title: t('orders.reissue_title'), message: need > 0 ? t('orders.reissue_msg', { orderNo: o.orderNo, need }) : t('orders.reissue_msg2', { orderNo: o.orderNo }) });
  if (!ok) return;
  try {
    const r = await reissueOrder(o.id);
    const codes = r?.data?.codes || r?.codes || [];
    toast.success(need > 0 ? t('orders.toast_reissued', { count: codes.length }) : t('orders.toast_reassigned'));
    detail.open = false;
    await refresh();
    const latest = list.value.find(x => x.id === o.id) || o;
    openDetail(latest);
  } catch (e) { toast.error(e?.message || t('orders.reissue_failed')); }
}

async function onDelete(o) {
  const ok = await confirm.open({ title: t('orders.delete_title'), message: t('orders.delete_confirm', { orderNo: o.orderNo }) });
  if (!ok) return;
  try { await deleteOrder(o.id); toast.success(t('orders.toast_deleted')); detail.open = false; refresh(); }
  catch (e) { toast.error(e?.message || t('orders.delete_failed')); }
}

onMounted(refresh);
</script>

<style scoped>
.head-actions { display: flex; gap: 10px; }
.head-actions .btn-ghost { display: inline-flex; align-items: center; gap: 6px; }
.head-actions .btn-ghost svg { width: 14px; height: 14px; }

.col-qty { width: 80px; } .col-amount { width: 110px; }

/* 移动端表格横向滚动，避免溢出导致布局错乱 */
@media (max-width: 768px) {
  :deep(.data-table) {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
    -webkit-overflow-scrolling: touch;
  }
  :deep(.data-table thead),
  :deep(.data-table tbody),
  :deep(.data-table tr),
  :deep(.data-table th),
  :deep(.data-table td) {
    display: inline-block;
  }
}

.pagination {
  display: flex; align-items: center; justify-content: flex-end; gap: 12px;
  padding: 14px 16px; border-top: 1px solid rgba(17,24,39,0.06); background: var(--color-bg-surface);
}

.kv { display: grid; grid-template-columns: 1fr; gap: 8px; padding: 4px 0 12px; border-bottom: 1px dashed rgba(17,24,39,0.08); }
.kv-row { display: grid; grid-template-columns: 96px 1fr; gap: 8px; font-size: 13px; }
.kv-k { color: var(--color-text-secondary); } .kv-v { color: var(--color-text); }

.card-codes { display: flex; flex-direction: column; gap: 8px; }
.card-codes-head { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 500; color: var(--color-brand-dim); }
.code-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.code-list li { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--color-bg-surface); border-radius: 8px; gap: 12px; }
.code-list .code-main { display: flex; align-items: center; flex: 1; min-width: 0; gap: 4px; }

/* 规格选择（补单 / 弹窗） */
.spec-pick { display: flex; flex-wrap: wrap; gap: 8px; }
.spec-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 9999px;
  background: var(--color-bg-surface); border: 1px solid rgba(17,24,39,0.12); font-size: 13px; color: var(--color-brand-dim);
  cursor: pointer; transition: all .15s; font-family: inherit; flex: none;
}
.spec-chip strong { font-weight: 600; color: var(--color-text); }
.spec-chip span { color: var(--color-text-secondary); font-size: 12px; }
.spec-chip:hover:not(:disabled) { border-color: var(--color-text); }
.spec-chip.is-active { background: var(--color-brand); border-color: var(--color-text); color: var(--color-text-inverse); }
.spec-chip.is-active strong { color: var(--color-text-inverse); }
.spec-chip.is-active span { color: rgba(255,255,255,0.7); }
.spec-chip.is-off { opacity: .45; cursor: not-allowed; }
.no-spec-hint { font-size: 13px; color: var(--color-text-tertiary); padding: 12px; background: var(--color-bg-surface); border-radius: 8px; border: 1px dashed rgba(17,24,39,0.12); }
</style>
