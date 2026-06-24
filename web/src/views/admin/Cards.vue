<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">{{ t('cards.title') }}</h1>
        <p class="page-subtitle">{{ t('cards.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn-ghost" :class="{ 'is-loading': loading }" @click="refresh">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 8a5 5 0 11-1.5-3.5L13 6M13 3v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>{{ t('cards.refresh') }}</span>
        </button>
        <button class="btn-primary" @click="openImport">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 11V3M4 7l4-4 4 4M2 13h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>{{ t('cards.import_gen') }}</span>
        </button>
      </div>
    </header>

    <div class="card">
      <div class="toolbar">
        <select v-model="filter.product" @change="onFilterChange">
          <option value="">{{ t('cards.all_products') }}</option>
          <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <select v-if="filter.product && specsOfProduct(filter.product).length" v-model="filter.specId" @change="onFilterChange">
          <option value="">{{ t('cards.all_specs') }}</option>
          <option v-for="s in specsOfProduct(filter.product)" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <select v-model="filter.status" @change="onFilterChange">
          <option value="">{{ t('cards.all_status') }}</option><option value="available">{{ t('cards.status_available') }}</option><option value="assigned">{{ t('cards.status_assigned') }}</option>
        </select>
        <input v-model="filter.keyword" class="search" type="search" :placeholder="t('cards.search_placeholder')" @input="onKeywordInput" />
        <div class="grow" />
        <span class="cell-muted">{{ t('cards.x_cards', { total: totalCount, available: stats.available, sold: stats.sold }) }}</span>
      </div>

      <div v-if="loading" class="state-block"><div class="spinner-lg" aria-hidden="true" /><p>{{ t('cards.loading') }}</p></div>

      <div v-else-if="!filtered.length" class="state-block empty">
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect x="8" y="20" width="48" height="24" rx="3" stroke="#d1d5db" stroke-width="1.5"/>
          <path d="M8 30h48" stroke="#d1d5db" stroke-width="1.5"/>
          <rect x="40" y="36" width="8" height="4" rx="1" stroke="#d1d5db" stroke-width="1.5"/>
        </svg>
        <h3>{{ products.length ? t('cards.no_cards') : t('cards.no_products') }}</h3>
        <p v-if="products.length">{{ t('cards.no_cards_hint') }}</p>
        <p v-else>{{ t('cards.no_products_hint') }}</p>
        <button v-if="!products.length" class="btn-primary empty-action" @click="$router.push('/admins/shangpin')">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <span>{{ t('cards.go_create_product') }}</span>
        </button>
        <button v-else class="btn-primary empty-action" @click="openImport">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 11V3M4 7l4-4 4 4M2 13h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>{{ t('cards.import_gen') }}</span>
        </button>
      </div>

      <table v-else class="data-table">
        <thead>
          <tr>
            <th>{{ t('cards.col_content') }}</th><th class="col-product">{{ t('cards.col_product') }}</th><th>{{ t('cards.col_type') }}</th>
            <th>{{ t('cards.col_loop_type') }}</th>
            <th>{{ t('cards.col_status') }}</th><th class="col-time">{{ t('cards.col_created_at') }}</th><th class="col-time">{{ t('cards.col_sold_at') }}</th><th class="col-actions">{{ t('cards.col_actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in paged" :key="c.id">
            <td class="col-content"><span class="cell-code">{{ c.content }}</span></td>
            <td class="col-product">{{ prodName(c.productId) }}</td>
            <td>
              <span class="card-type-pill" :class="{ empty: !c.type && !c.durationSeconds }">
                <span v-if="c.type">{{ c.type }}</span>
                <span v-if="c.type && c.durationSeconds" class="dot">&middot;</span>
                <span v-if="c.durationSeconds">{{ durationLabel(c.durationSeconds) }}</span>
                <span v-if="!c.type && !c.durationSeconds">&mdash;</span>
              </span>
            </td>
            <td>
              <span v-if="c.isLoop === 1" class="tag tag-loop">{{ t('cards.loop_type_loop') }}</span>
              <span v-else class="tag tag-normal">{{ t('cards.loop_type_normal') }}</span>
            </td>
            <td class="col-status">
              <StatusBadge :status="c.status" />
            </td>
            <td class="col-time cell-muted">{{ formatTime(c.createdAt) }}</td>
            <td class="col-time cell-muted">
              <div v-if="c.status === 'assigned'">
                <div>{{ formatTime(c.assignedAt) }}</div>
                <div v-if="cardExpiry(c)" :class="expiryClass(c)" style="font-size:11px;margin-top:2px;">
                  {{ t('cards.expiry_at', { date: formatDate(cardExpiry(c)) }) }}
                </div>
              </div>
              <span v-else>&mdash;</span>
            </td>
            <td class="col-actions">
              <button class="link-btn" @click="copyAndToast(c.content, t('cards.copied'), t('cards.copy_failed'))">{{ t('cards.copy') }}</button>
              <button class="link-btn danger" :disabled="c.status === 'assigned'" :title="c.status === 'assigned' ? t('cards.assigned_no_delete') : ''" @click="onDelete(c)">{{ t('cards.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="totalCount > pageSize" class="pagination">
        <button class="btn-sm" :disabled="page <= 1" @click="page--; refresh()">{{ t('common.prev_page') }}</button>
        <span class="cell-muted">{{ t('orders.page_of', { page, total: totalPages, size: pageSize }) }}</span>
        <button class="btn-sm" :disabled="page >= totalPages" @click="page++; refresh()">{{ t('common.next_page') }}</button>
      </div>
    </div>

    <!-- 批量导入/生成弹窗 -->
    <transition name="modal">
      <div v-if="modalOpen" class="modal-mask" @mousedown="onMaskDown" @click="onMaskClick">
        <div class="modal modal-lg" role="dialog" aria-modal="true">
          <header class="modal-head">
            <h3>{{ t('cards.import_title') }}</h3>
            <button class="modal-close" @click="closeImport" aria-label="close">&times;</button>
          </header>
          <div class="modal-body">
            <div v-if="!products.length" class="state-block empty" style="padding:24px 0">
              <p style="color:var(--color-text-secondary)">{{ t('cards.no_products_modal') }}</p>
              <button class="btn-primary empty-action" @click="$router.push('/admins/shangpin')">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                <span>{{ t('cards.go_create_product') }}</span>
              </button>
            </div>
            <template v-else>
              <!-- 商品选择 -->
              <div class="field" :class="{ 'is-error': errors.productId }">
                <label>{{ t('cards.product') }}<span class="field-tip">{{ t('products.required') }}</span></label>
                <select v-model="form.productId" @change="onProductChange">
                  <option value="">{{ t('cards.product_placeholder') }}</option>
                  <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
                <p v-if="errors.productId" class="field-error">{{ errors.productId }}</p>
              </div>

              <!-- 规格选择 -->
              <div v-if="selectedProduct" class="field" :class="{ 'is-error': errors.specId }">
                <label>{{ t('cards.spec') }}<span class="field-tip">{{ t('cards.spec_tip') }}</span></label>
                <div v-if="!selectedProduct.cardSpecs || !selectedProduct.cardSpecs.length" class="no-spec-hint">{{ t('cards.no_spec_hint') }}</div>
                <div v-else class="spec-pick">
                  <button v-for="s in selectedProduct.cardSpecs" :key="s.id" type="button"
                    class="spec-chip" :class="{ 'is-active': form.specId === s.id, 'is-off': s.status === 'off' }"
                    :disabled="s.status === 'off'" :title="s.status === 'off' ? t('cards.spec_off_shelf') : ''"
                    @click="form.specId = s.id">
                    <strong>{{ s.name }}</strong>
                    <span>{{ durationLabel(s.durationSeconds) }} &middot; &yen;{{ Number(s.price).toFixed(2) }}</span>
                    <span v-if="s.status === 'off'" class="off-tag">{{ t('cards.spec_off_tag') }}</span>
                  </button>
                </div>
                <p v-if="errors.specId" class="field-error">{{ errors.specId }}</p>
                <p v-else-if="selectedSpec" class="cell-muted" style="margin:6px 0 0;font-size:12px">{{ t('cards.spec_stock', { count: stockOfSpec(selectedSpec.id) }) }}</p>
              </div>

              <!-- 循环卡密选项（参考独角数卡） -->
              <div v-if="selectedProduct" class="field">
                <label class="loop-checkbox-label">
                  <input type="checkbox" v-model="form.isLoop" />
                  <span>{{ t('cards.loop_card') }}</span>
                  <span class="field-tip">{{ t('cards.loop_card_tip') }}</span>
                </label>
              </div>

              <!-- 卡密时长说明（取自规格，不可覆盖） -->
              <div v-if="selectedSpec" class="field">
                <label>{{ t('cards.duration_label') }}<span class="field-tip">{{ t('cards.duration_from_spec_tip') }}</span></label>
                <div class="dur-info-box">
                  <strong>{{ durationLabel(selectedSpec.durationSeconds) }}</strong>
                  <span class="cell-muted" style="margin-left:8px;font-size:12px">{{ t('cards.duration_from_spec_hint') }}</span>
                </div>
              </div>

              <!-- Tab 切换 -->
              <div class="tabs" role="tablist">
                <button type="button" class="tab" :class="{ 'is-active': tab === 'paste' }" @click="tab = 'paste'">{{ t('cards.tab_paste') }}</button>
                <button type="button" class="tab" :class="{ 'is-active': tab === 'gen' }" @click="tab = 'gen'">{{ t('cards.tab_gen') }}</button>
              </div>

              <!-- 粘贴模式 -->
              <div v-show="tab === 'paste'" class="field" :class="{ 'is-error': errors.contents }">
                <label><span>{{ t('cards.content') }}</span><span class="field-tip">{{ t('cards.content_tip') }}</span></label>
                <textarea v-model="form.contents" rows="10" :placeholder="t('cards.content_placeholder')" />
                <p v-if="form.contents" class="cell-muted" style="margin:6px 0 0">{{ t('cards.recognized', { count: previewCount }) }}</p>
                <p v-if="errors.contents" class="field-error">{{ errors.contents }}</p>
              </div>

              <!-- 生成模式 -->
              <div v-show="tab === 'gen'" class="gen-panel">
                <GenPanel ref="genRef" :charsets="CHARSETS" :durPresets="DUR_PRESETS" :selectedSpec="selectedSpec" />
              </div>

              <p v-if="formError" class="form-error">{{ formError }}</p>
              <p v-if="formOk" class="form-ok">{{ formOk }}</p>
            </template>
          </div>
          <footer class="modal-foot">
            <button type="button" class="btn-ghost" @click="closeImport">{{ t('cards.cancel') }}</button>
            <button type="button" class="btn-primary" :disabled="submitting || !canSubmit" @click="onImport">
              <span v-if="submitting" class="spinner" aria-hidden="true" />
              <span>{{ submitting ? t('cards.processing') : (tab === 'gen' ? t('cards.gen_import_btn', { count: generatedCount || 0 }) : t('cards.import_btn', { count: previewCount })) }}</span>
            </button>
          </footer>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  listCards, batchImportCards, deleteCard,
  listProducts,
} from '../../api/admin.js';
import { useToast } from '../../composables/useToast.js';
import { useConfirm } from '../../composables/useConfirm.js';
import { useClipboard } from '../../composables/useClipboard.js';
import { formatTime, formatDate, durationLabel, getCardExpiry } from '../../composables/useFormat.js';
import { DURATION_PRESETS } from '../../utils/durationPresets.js';
import GenPanel from '../../components/admin/GenPanel.vue';
import StatusBadge from '../../components/shop/StatusBadge.vue';

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const { copyAndToast } = useClipboard();

// 字符集定义（供 GenPanel 使用）
const CHARSETS = {
  digits: '0123456789',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  lower: 'abcdefghijklmnopqrstuvwxyz0123456789',
  mixed: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
};
// 时长预设（统一使用共享常量，与 Products.vue 一致）
const DUR_PRESETS = computed(() => DURATION_PRESETS.map(p => ({ v: p.value, label: p.label })));

const list = ref([]);
const products = ref([]);
const loading = ref(false);
const filter = reactive({ product: '', status: '', keyword: '', specId: '' });
const totalCount = ref(0);
const stats = ref({ available: 0, sold: 0 });

// 弹窗状态
const modalOpen = ref(false);
const tab = ref('paste');
const form = reactive({ productId: '', contents: '', specId: '', durationOverride: null, useOverride: false, isLoop: false });
const errors = reactive({ productId: '', specId: '', contents: '' });
const formError = ref('');
const formOk = ref('');
const submitting = ref(false);
const genRef = ref(null);

const page = ref(1);
const pageSize = 50;

// 获取某商品的规格列表（用于规格筛选下拉）
function specsOfProduct(productId) {
  const p = products.value.find(x => x.id === productId);
  return p?.cardSpecs || [];
}

function prodName(id) { const p = products.value.find(x => x.id === id); return p ? p.name : '—'; }
function cardExpiry(c) { return getCardExpiry(c); }
function expiryClass(c) {
  const e = getCardExpiry(c);
  if (!e) return '';
  const ms = new Date(e).getTime() - Date.now();
  if (ms < 0) return 'exp-done'; if (ms < 7 * 24 * 60 * 60 * 1000) return 'exp-soon'; return '';
}

const selectedProduct = computed(() => products.value.find(p => p.id === form.productId) || null);
const selectedSpec = computed(() => {
  const p = selectedProduct.value;
  if (!p || !form.specId) return null;
  return (p.cardSpecs || []).find(s => s.id === form.specId) || null;
});
function stockOfSpec(specId) { return list.value.filter(c => c.specId === specId && c.status === 'available').length; }

const previewCount = computed(() => {
  const text = String(form.contents || '');
  if (!text.trim()) return 0;
  return text.split(/\r?\n|，|,|\s+/g).map(s => s.trim()).filter(Boolean).length;
});
const generatedCount = computed(() => genRef.value?.result?.length || 0);

const canSubmit = computed(() => {
  if (!form.productId) return false;
  if (!form.specId) return false;
  if (tab.value === 'paste') return previewCount.value > 0;
  if (tab.value === 'gen') return generatedCount.value > 0 && !genRef.value?.error;
  return false;
});

// 服务端分页后的数据直接展示，无需前端切片
const filtered = computed(() => list.value);
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)));
const paged = computed(() => filtered.value);

// 关键字搜索防抖
let keywordTimer = null;
function onKeywordInput() {
  clearTimeout(keywordTimer);
  keywordTimer = setTimeout(() => { page.value = 1; refresh(); }, 400);
}
function onFilterChange() {
  page.value = 1;
  refresh();
}

async function refresh() {
  loading.value = true;
  try {
    const params = {
      page: page.value,
      pageSize,
      productId: filter.product || undefined,
      specId: filter.specId || undefined,
      status: filter.status || undefined,
      keyword: filter.keyword.trim() || undefined,
    };
    const [cardsResp, prods] = await Promise.all([listCards(params), listProducts()]);
    list.value = cardsResp.data || cardsResp || [];
    totalCount.value = cardsResp.total || list.value.length;
    // 统计基于当前页（近似值，完整统计需额外接口）
    stats.value = {
      available: list.value.filter(c => c.status === 'available').length,
      sold: list.value.filter(c => c.status === 'assigned').length,
    };
    products.value = Array.isArray(prods) ? prods : (prods?.data || []);
  }
  catch (e) { toast.error(e?.message || t('cards.load_failed')); }
  finally { loading.value = false; }
}

function openImport() {
  form.productId = filter.product || ''; form.contents = ''; form.specId = ''; form.useOverride = false; form.durationOverride = null; form.isLoop = false; tab.value = 'paste';
  errors.productId = ''; errors.specId = ''; errors.contents = ''; formError.value = ''; formOk.value = '';
  genRef.value?.reset?.(); modalOpen.value = true;
}
function closeImport() { modalOpen.value = false; }

// 切换商品时清空规格和时长覆盖，避免导入到错误规格
function onProductChange() {
  form.specId = '';
  form.useOverride = false;
  form.durationOverride = null;
}

let maskDownX = 0, maskDownY = 0, maskDownOnMask = false;
function onMaskDown(e) { maskDownOnMask = e.target === e.currentTarget; maskDownX = e.clientX; maskDownY = e.clientY; }
function onMaskClick(e) {
  if (!maskDownOnMask || e.target !== e.currentTarget) { maskDownOnMask = false; return; }
  const dx = Math.abs(e.clientX - maskDownX), dy = Math.abs(e.clientY - maskDownY);
  maskDownOnMask = false; if (dx < 5 && dy < 5) closeImport();
}

function validate() {
  errors.productId = ''; errors.specId = ''; errors.contents = '';
  if (!form.productId) { errors.productId = t('cards.err_product'); return false; }
  if (!form.specId) { errors.specId = t('cards.err_spec'); return false; }
  if (tab.value === 'paste' && previewCount.value === 0) { errors.contents = t('cards.err_contents'); return false; }
  if (tab.value === 'gen' && (!generatedCount.value || genRef.value?.error)) return false;
  return true;
}

async function onImport() {
  if (submitting.value) return; if (!validate()) return;
  submitting.value = true; formError.value = ''; formOk.value = '';
  try {
    const isGen = tab.value === 'gen';
    const payload = {
      productId: form.productId,
      specId: form.specId,
      contents: isGen ? genRef.value.result : form.contents,
      // 循环卡密：1=循环，0=普通（参考独角数卡）
      isLoop: form.isLoop ? 1 : 0,
      // 注意：卡密时长强制取自规格，不再传递 durationSeconds 覆盖
      // 若需不同时长，应创建不同规格而非覆盖
    };
    const r = await batchImportCards(payload);
    formOk.value = t('cards.toast_imported', { count: r.count });
    toast.success(t('cards.toast_imported', { count: r.count }));
    setTimeout(() => { modalOpen.value = false; refresh(); }, 1200);
  } catch (e) { formError.value = e?.message || t('cards.import_failed'); }
  finally { submitting.value = false; }
}

async function onDelete(c) {
  if (c.status === 'assigned') {
    toast.info(t('cards.assigned_no_delete'));
    return;
  }
  const ok = await confirm.open({
    title: t('cards.delete_title'),
    message: t('cards.delete_confirm', { content: c.content.slice(0, 20) + (c.content.length > 20 ? '...' : '') }),
  });
  if (!ok) return;
  try { await deleteCard(c.id); toast.success(t('cards.toast_deleted')); refresh(); }
  catch (e) { toast.error(e?.message || t('cards.delete_failed')); }
}

onMounted(refresh);
</script>

<style scoped>
.head-actions { display: flex; gap: 10px; }
.head-actions .btn-ghost { display: inline-flex; align-items: center; gap: 6px; }
.head-actions .btn-ghost svg { width: 14px; height: 14px; }

.col-product { width: 200px; }
.pagination {
  display: flex; align-items: center; justify-content: flex-end; gap: 12px;
  padding: 14px 16px; border-top: 1px solid rgba(17,24,39,0.06); background: var(--color-bg-surface);
}

/* 规格选择 */
.no-spec-hint { font-size: 13px; color: var(--color-text-tertiary); padding: 12px 14px; background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: 8px; }
.spec-pick { display: flex; flex-wrap: wrap; gap: 10px; }
.spec-chip {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 14px 20px; background: var(--color-bg-page); border: 2px solid var(--color-border);
  cursor: pointer; font-family: inherit; transition: all .15s; min-width: 120px;
}
.spec-chip:hover { border-color: var(--color-text-tertiary); }
.spec-chip.is-active { background: var(--color-brand); border-color: var(--color-text); color: var(--color-text-inverse); }
.spec-chip.is-active strong, .spec-chip.is-active span { color: var(--color-text-inverse); }
.spec-chip.is-off { opacity: .35; cursor: not-allowed; border-style: dashed; }
.spec-chip strong { font-size: 15px; font-weight: 600; color: var(--color-text); }
.spec-chip span { font-size: 12px; color: var(--color-text-secondary); }
.off-tag { font-size: 11px; background: var(--color-danger); color: var(--color-text-inverse); padding: 2px 8px; border-radius: 4px; font-weight: 500; }

/* 卡密时长说明框（取自规格，不可覆盖） */
.dur-info-box {
  padding: 10px 14px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-text);
}
.dur-chip { height: 22px; padding: 0 8px; font-size: 11px; line-height: 1;
  background: var(--color-bg-surface); border: 1px solid rgba(17,24,39,0.1);
  border-radius: 9999px; cursor: pointer; color: var(--color-text-secondary);
  font-family: inherit; transition: all .15s; }
.dur-chip:hover { border-color: var(--color-text-tertiary); color: var(--color-text); }
.dur-chip.active { background: var(--color-brand); border-color: var(--color-text); color: var(--color-text-inverse); }

/* 生成器面板占位 */
.gen-panel { padding: 0 0 4px; }

/* 循环卡密复选框（参考独角数卡） */
.loop-checkbox-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; cursor: pointer;
}
.loop-checkbox-label input[type="checkbox"] {
  margin: 0; width: 16px; height: 16px; cursor: pointer;
}

/* 卡密类型标签 */
.tag {
  display: inline-block; font-size: 12px; padding: 2px 10px;
  border-radius: 6px; font-weight: 500;
  white-space: nowrap;
}
.tag-loop {
  background: rgba(245, 158, 11, 0.12); color: #b45309;
}
.tag-normal {
  background: var(--color-border-light); color: var(--color-brand-dim);
}

/* 到期颜色 */
.exp-soon { color: var(--color-warning); } .exp-done { color: var(--color-danger); text-decoration: line-through; }

/* 卡密内容列 - 等宽代码块样式，防止变形 */
.col-content { max-width: 360px; }
.cell-code {
  display: inline-block;
  background: var(--color-bg-surface);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text);
  word-break: break-all;
  max-width: 100%;
  box-sizing: border-box;
  line-height: 1.5;
}

/* 状态徽章 - 胶囊样式 + 颜色区分（覆盖 StatusBadge 默认样式） */
.col-status :deep(.status-badge) {
  display: inline-block;
  border-radius: var(--radius-full) !important;
  padding: 3px 12px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  line-height: 1.5 !important;
}
/* 未售(available) = 绿色 */
.col-status :deep(.status-badge.status-available) {
  background: var(--color-success-bg) !important;
  color: var(--color-success) !important;
}
/* 已售(assigned/sold) = 灰色 */
.col-status :deep(.status-badge.status-assigned),
.col-status :deep(.status-badge.status-sold) {
  background: var(--color-bg-hover) !important;
  color: var(--color-text-tertiary) !important;
}
</style>
