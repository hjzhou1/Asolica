<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">{{ t('products.title') }}</h1>
        <p class="page-subtitle">{{ t('products.subtitle') }}</p>
      </div>
      <button class="btn-primary" @click="openCreate">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        <span>{{ t('products.create') }}</span>
      </button>
    </header>

    <div class="card">
      <div class="toolbar">
        <select v-model="filter.category" @change="refresh">
          <option value="">{{ t('products.all_categories') }}</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <input v-model="filter.keyword" class="search" type="search" :placeholder="t('products.search_placeholder')" />
        <select v-model="filter.status" @change="refresh">
          <option value="">{{ t('products.all_status') }}</option>
          <option value="on">{{ t('products.on_sale') }}</option>
          <option value="off">{{ t('products.off_shelf') }}</option>
        </select>
        <div class="grow" />
        <span class="cell-muted">{{ t('products.x_items', { count: filtered.length }) }}</span>
      </div>

      <div v-if="loading" class="state-block"><div class="spinner-lg" aria-hidden="true" /><p>{{ t('products.loading') }}</p></div>

      <div v-else-if="!filtered.length" class="state-block empty">
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect x="10" y="16" width="44" height="32" rx="4" stroke="#d1d5db" stroke-width="1.5"/>
          <circle cx="22" cy="26" r="3" stroke="#d1d5db" stroke-width="1.5"/>
          <path d="M10 42l12-12 14 14M30 32l8-8 16 16" stroke="#d1d5db" stroke-width="1.5"/>
        </svg>
        <h3>{{ filter.category || filter.keyword || filter.status ? t('products.no_match') : (categories.length ? t('products.no_products') : t('products.no_categories')) }}</h3>
        <p v-if="!filter.category && !filter.keyword && !filter.status && !categories.length">{{ t('products.create_category_first') }}</p>
        <p v-else>{{ t('products.start_create') }}</p>
        <button v-if="!filter.category && !filter.keyword && !filter.status && !categories.length" class="btn-primary empty-action" @click="$router.push('/admins/fenlei')">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <span>{{ t('products.go_create_category') }}</span>
        </button>
      </div>

      <table v-else class="data-table">
        <thead>
          <tr>
            <th>{{ t('products.col_product') }}</th>
            <th>{{ t('products.col_category') }}</th>
            <th class="col-price">{{ t('products.col_price') }}</th>
            <th>{{ t('products.col_spec') }}</th>
            <th class="col-stock">{{ t('products.col_stock') }}</th>
            <th class="col-sales">{{ t('products.col_sales') }}</th>
            <th>{{ t('products.col_type') }}</th>
            <th>{{ t('products.col_status') }}</th>
            <th class="col-time">{{ t('products.col_created_at') }}</th>
            <th class="col-actions">{{ t('products.col_actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filtered" :key="p.id">
            <td>
              <div class="prod-cell">
                <div class="prod-img" :style="pImg(p.image) ? { backgroundImage: `url(${pImg(p.image)})` } : null">
                  <span v-if="!pImg(p.image)" class="prod-img-fallback">{{ p.name.slice(0,1) }}</span>
                </div>
                <div class="prod-meta">
                  <div class="cell-name">{{ p.name }}</div>
                  <div class="cell-muted prod-desc">{{ p.desc || '—' }}</div>
                </div>
              </div>
            </td>
            <td><span class="tag">{{ catName(p.categoryId) }}</span></td>
            <td class="col-price mono">{{ priceText(p) }}</td>
            <td><span class="cell-muted">{{ specCountText(p) }}</span></td>
            <td class="col-stock mono">{{ stockMap[p.id] ?? '—' }}</td>
            <td class="col-sales mono">{{ p.salesVolume ?? 0 }}</td>
            <td><span class="tag" :class="p.type === 'manual' ? 'tag-manual' : ''">{{ p.type === 'manual' ? t('products.type_manual') : t('products.type_auto') }}</span></td>
            <td>
              <StatusBadge :status="p.status === 'on' ? 'enabled' : 'disabled'" />
            </td>
            <td class="col-time cell-muted">{{ formatTime(p.createdAt) }}</td>
            <td class="col-actions">
              <button class="link-btn" @click="openEdit(p)">{{ t('products.edit') }}</button>
              <button class="link-btn" @click="onToggle(p)">{{ p.status === 'on' ? t('products.toggle_off') : t('products.toggle_on') }}</button>
              <button class="link-btn danger" @click="onDelete(p)">{{ t('products.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新建/编辑弹窗 -->
    <transition name="modal">
      <div v-if="modalOpen" class="modal-mask" @click.self="closeModal">
        <div class="modal modal-lg" role="dialog" aria-modal="true">
          <header class="modal-head">
            <h3>{{ isEdit ? t('products.edit_title') : t('products.create_title') }}</h3>
            <button class="modal-close" @click="closeModal" aria-label="close">&times;</button>
          </header>
          <form class="modal-body" @submit.prevent="onSubmit">
            <!-- 基本信息 -->
            <section class="form-section">
              <h4 class="section-title">基本信息</h4>
              <div class="section-body">
                <div class="field" :class="{ 'is-error': errors.name }">
                  <label>{{ t('products.name') }}<span class="required-mark">*</span></label>
                  <input v-model="form.name" type="text" :placeholder="t('products.name_placeholder')" maxlength="64" />
                  <p v-if="errors.name" class="field-error">{{ errors.name }}</p>
                </div>
                <div class="field" :class="{ 'is-error': errors.categoryId }">
                  <label>{{ t('products.category') }}<span class="required-mark">*</span></label>
                  <select v-model="form.categoryId">
                    <option value="">{{ t('products.category_placeholder') }}</option>
                    <option v-for="c in enabledCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </select>
                  <p v-if="errors.categoryId" class="field-error">{{ errors.categoryId }}</p>
                </div>
                <div class="field">
                  <label>{{ t('products.image') }}<span class="field-tip">{{ t('products.image_tip') }}</span></label>
                  <ImagePicker v-model="form.image" :placeholder="t('products.image_placeholder')" />
                </div>
                <div class="field">
                  <label>{{ t('products.desc') }}<span class="field-tip">{{ t('products.desc_tip') }}</span></label>
                  <textarea v-model="form.desc" maxlength="200" :placeholder="t('products.desc_placeholder')" />
                </div>
              </div>
            </section>

            <!-- 卡密规格 -->
            <section class="form-section">
              <h4 class="section-title">{{ t('products.specs') }}</h4>
              <div class="section-body">
                <div class="field" :class="{ 'is-error': errors.specs }">
                  <div class="specs-table">
                    <div class="specs-row specs-head">
                      <span>{{ t('products.spec_name') }}</span><span>{{ t('products.spec_duration') }}</span><span>{{ t('products.spec_price') }}</span><span>{{ t('products.spec_on_sale') }}</span><span></span>
                    </div>
                    <div v-for="(s, i) in form.cardSpecs" :key="i" class="specs-row">
                      <input v-model="s.name" type="text" :placeholder="t('products.spec_name_placeholder')" maxlength="20" />
                      <div class="spec-duration">
                        <input v-model.number="s.durationSeconds" type="number" min="0" step="1" :placeholder="t('products.spec_duration_placeholder')" />
                        <div class="dur-presets">
                          <button v-for="p in DURATION_PRESETS" :key="p.key" type="button" class="dur-chip" :class="{ active: s.durationSeconds === p.value }" @click="s.durationSeconds = p.value" :title="p.label">{{ p.label }}</button>
                        </div>
                        <span class="dur-preview">{{ durationLabel(s.durationSeconds) }}</span>
                      </div>
                      <input v-model.number="s.price" type="number" step="0.01" min="0" :placeholder="t('products.spec_price_placeholder')" />
                      <label class="spec-toggle">
                        <input type="checkbox" :true-value="'on'" :false-value="'off'" v-model="s.status" />
                        <span class="switch" />
                      </label>
                      <button type="button" class="spec-remove" :disabled="form.cardSpecs.length <= 1" @click="removeSpec(i)" :title="form.cardSpecs.length <= 1 ? t('products.remove_spec_title') : 'del'">&times;</button>
                    </div>
                  </div>
                  <button type="button" class="spec-add" @click="addSpec">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                    <span>{{ t('products.add_spec') }}</span>
                  </button>
                  <p v-if="errors.specs" class="field-error">{{ errors.specs }}</p>
                  <p v-else class="cell-muted specs-hint">{{ t('products.specs_hint') }}</p>
                </div>
              </div>
            </section>

            <!-- 销售设置 -->
            <section class="form-section">
              <h4 class="section-title">销售设置</h4>
              <div class="section-body">
                <div class="field-row-3">
                  <div class="field">
                    <label>{{ t('products.type') }}<span class="field-tip">{{ t('products.type_tip') }}</span></label>
                    <select v-model="form.type">
                      <option value="auto">{{ t('products.type_auto') }}</option>
                      <option value="manual">{{ t('products.type_manual') }}</option>
                    </select>
                  </div>
                  <div class="field">
                    <label>{{ t('products.buy_limit') }}<span class="field-tip">{{ t('products.buy_limit_tip') }}</span></label>
                    <input v-model.number="form.buyLimitNum" type="number" min="0" step="1" placeholder="0" />
                  </div>
                  <div class="field">
                    <label>{{ t('products.ord') }}<span class="field-tip">{{ t('products.ord_tip') }}</span></label>
                    <input v-model.number="form.ord" type="number" step="1" placeholder="0" />
                  </div>
                </div>
                <div class="field field-row">
                  <label class="switch-label">
                    <input type="checkbox" :true-value="'on'" :false-value="'off'" v-model="form.status" />
                    <span class="switch" /><span>{{ t('products.on_sale_label') }}</span>
                  </label>
                </div>
              </div>
            </section>

            <!-- 高级设置 -->
            <section class="form-section">
              <h4 class="section-title">{{ t('products.advanced_settings') }}</h4>
              <div class="section-body">
                <div class="field">
                  <label>{{ t('products.wholesale_price_cnf') }}<span class="field-tip">{{ t('products.wholesale_price_cnf_tip') }}</span></label>
                  <textarea v-model="form.wholesalePriceCnf" rows="4" :placeholder="t('products.wholesale_price_cnf_placeholder')" />
                </div>
                <div v-if="form.type === 'manual'" class="field">
                  <label>{{ t('products.other_ipu_cnf') }}<span class="field-tip">{{ t('products.other_ipu_cnf_tip') }}</span></label>
                  <textarea v-model="form.otherIpuCnf" rows="4" :placeholder="t('products.other_ipu_cnf_placeholder')" />
                </div>
                <div class="field">
                  <label>{{ t('products.api_hook') }}<span class="field-tip">{{ t('products.api_hook_tip') }}</span></label>
                  <input v-model="form.apiHook" type="text" :placeholder="t('products.api_hook_placeholder')" />
                </div>
              </div>
            </section>

            <p v-if="formError" class="form-error">{{ formError }}</p>
          </form>
          <footer class="modal-foot">
            <button type="button" class="btn-ghost" @click="closeModal">{{ t('products.cancel') }}</button>
            <button type="button" class="btn-primary" :disabled="submitting" @click="onSubmit">
              <span v-if="submitting" class="spinner" aria-hidden="true" />
              <span>{{ submitting ? t('products.saving') : (isEdit ? t('products.save') : t('products.create_btn')) }}</span>
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
  listProducts, createProduct, updateProduct, deleteProduct,
  listCategories, getAllProductsStock,
} from '../../api/admin.js';
import { resolveImageUrl } from '../../utils/media.js';
import { DURATION_PRESETS } from '../../utils/durationPresets.js';
import { useToast } from '../../composables/useToast.js';
import { useConfirm } from '../../composables/useConfirm.js';
import { formatTime, durationLabel } from '../../composables/useFormat.js';
import ImagePicker from '../../components/admin/ImagePicker.vue';
import StatusBadge from '../../components/shop/StatusBadge.vue';

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();

function newSpecRow(name = '', durationSeconds = 86400, price = 0) {
  return { name, durationSeconds, price, status: 'on' };
}

const list = ref([]);
const categories = ref([]);
const stockMap = ref({});
const loading = ref(false);
const filter = reactive({ category: '', keyword: '', status: '' });

const modalOpen = ref(false);
const isEdit = ref(false);
const editingId = ref('');
const form = reactive({
  name: '', categoryId: '', desc: '', image: '', status: 'on',
  type: 'auto', buyLimitNum: 0, ord: 0,
  // 高级设置（参考独角数卡）
  wholesalePriceCnf: '', otherIpuCnf: '', apiHook: '',
  cardSpecs: [newSpecRow(t('products.default_spec_hour'), 3600, 0), newSpecRow(t('products.default_spec_month'), 2592000, 0)],
});
const errors = reactive({ name: '', categoryId: '', specs: '' });
const formError = ref('');
const submitting = ref(false);

function pImg(ref) { return resolveImageUrl(ref); }

function catName(id) {
  const c = categories.value.find(x => x.id === id);
  return c ? c.name : '—';
}
/** 列表里"价格"列 */
function priceText(p) {
  const on = (p.cardSpecs || []).filter(s => s.status !== 'off');
  if (!on.length) return '—';
  const prices = on.map(s => Number(s.price) || 0);
  const min = Math.min(...prices), max = Math.max(...prices);
  return min === max ? `¥${min.toFixed(2)}` : t('products.price_start', { min: min.toFixed(2) });
}
function specCountText(p) {
  const specs = p.cardSpecs || [];
  if (!specs.length) return '—';
  const on = specs.filter(s => s.status !== 'off').length;
  return t('products.x_on_sale', { on, total: specs.length });
}

const enabledCategories = computed(() => categories.value.filter(c => c.enabled !== false));
const filtered = computed(() => {
  const kw = filter.keyword.trim().toLowerCase();
  return list.value.filter(p => {
    if (filter.category && p.categoryId !== filter.category) return false;
    if (filter.status && p.status !== filter.status) return false;
    if (kw && !p.name.toLowerCase().includes(kw)) return false;
    return true;
  });
});

async function refresh() {
  loading.value = true;
  try {
    const [prods, cats, stockList] = await Promise.all([
      listProducts(), listCategories(), getAllProductsStock(),
    ]);
    list.value = Array.isArray(prods) ? prods : (prods?.data || []);
    categories.value = cats;
    const next = {};
    for (const item of (stockList || [])) {
      next[item.productId] = (next[item.productId] || 0) + (Number(item.count) || 0);
    }
    stockMap.value = next;
  } catch (e) {
    toast.error(e?.message || t('products.load_failed'));
  } finally {
    loading.value = false;
  }
}

function addSpec() { form.cardSpecs.push(newSpecRow('', 86400, 0)); }
function removeSpec(i) { if (form.cardSpecs.length > 1) form.cardSpecs.splice(i, 1); }

function openCreate() {
  isEdit.value = false; editingId.value = '';
  Object.assign(form, {
    name: '', categoryId: '', desc: '', image: '', status: 'on',
    type: 'auto', buyLimitNum: 0, ord: 0,
    // 高级设置重置为空（参考独角数卡）
    wholesalePriceCnf: '', otherIpuCnf: '', apiHook: '',
    cardSpecs: [newSpecRow(t('products.default_spec_hour'), 3600, 0), newSpecRow(t('products.default_spec_month'), 2592000, 0)],
  });
  errors.name = ''; errors.categoryId = ''; errors.specs = ''; formError.value = '';
  modalOpen.value = true;
}
function openEdit(p) {
  isEdit.value = true; editingId.value = p.id;
  const specs = (p.cardSpecs && p.cardSpecs.length)
    ? p.cardSpecs.map(s => ({ id: s.id || '', name: s.name || '', durationSeconds: Number(s.durationSeconds) || 0, price: Number(s.price) || 0, status: s.status || 'on' }))
    : [newSpecRow(t('products.default_spec_default'), 0, 0)];
  Object.assign(form, {
    name: p.name, categoryId: p.categoryId || '',
    desc: p.desc || '', image: p.image || '', status: p.status || 'on', cardSpecs: specs,
    type: p.type === 'manual' ? 'manual' : 'auto',
    buyLimitNum: Number(p.buyLimitNum) || 0,
    ord: Number(p.ord) || 0,
    // 高级设置：后端返回 snake_case，row() 已转 camelCase（参考独角数卡）
    wholesalePriceCnf: p.wholesalePriceCnf || '',
    otherIpuCnf: p.otherIpuCnf || '',
    apiHook: p.apiHook || '',
  });
  errors.name = ''; errors.categoryId = ''; errors.specs = ''; formError.value = '';
  modalOpen.value = true;
}
function closeModal() { modalOpen.value = false; }

function validate() {
  errors.name = ''; errors.categoryId = ''; errors.specs = ''; formError.value = '';
  if (!form.name.trim()) { errors.name = t('products.err_name'); return false; }
  if (!form.categoryId) { errors.categoryId = t('products.err_category'); return false; }
  if (!form.cardSpecs.length) { errors.specs = t('products.err_specs'); return false; }
  // 规格名唯一性校验（防止重复规格名导致卡密导入时无法区分）
  const specNames = form.cardSpecs.map(s => s.name.trim());
  const dupIdx = specNames.findIndex((name, i) => specNames.indexOf(name) !== i);
  if (dupIdx >= 0) {
    errors.specs = `规格名"${specNames[dupIdx]}"重复，请使用不同的名称`;
    return false;
  }
  for (let i = 0; i < form.cardSpecs.length; i++) {
    const s = form.cardSpecs[i];
    if (!s.name || !s.name.trim()) { errors.specs = t('products.err_spec_name', { i: i + 1 }); return false; }
    if (s.price === '' || s.price === null || isNaN(Number(s.price)) || Number(s.price) < 0) {
      errors.specs = t('products.err_spec_price', { i: i + 1 }); return false;
    }
  }
  return true;
}
async function onSubmit() {
  if (submitting.value) return;
  if (!validate()) return;
  submitting.value = true;
  try {
    const payload = {
      name: form.name.trim(), categoryId: form.categoryId,
      desc: form.desc.trim(), image: form.image.trim(), status: form.status,
      type: form.type, buyLimitNum: Number(form.buyLimitNum) || 0, ord: Number(form.ord) || 0,
      // 高级设置字段（参考独角数卡）
      wholesalePriceCnf: form.wholesalePriceCnf || '',
      otherIpuCnf: form.otherIpuCnf || '',
      apiHook: form.apiHook ? form.apiHook.trim() : '',
      cardSpecs: form.cardSpecs.map(s => ({
        id: s.id || undefined, name: s.name.trim(), durationSeconds: Number(s.durationSeconds) || 0,
        price: Number(s.price) || 0, status: s.status === 'off' ? 'off' : 'on',
      })),
    };
    if (isEdit.value) {
      await updateProduct(editingId.value, payload);
      toast.success(t('products.toast_saved'));
    } else {
      await createProduct(payload);
      toast.success(t('products.toast_created'));
    }
    modalOpen.value = false;
    refresh();
  } catch (e) {
    formError.value = e?.message || t('products.save_failed');
  } finally {
    submitting.value = false;
  }
}

async function onToggle(p) {
  const isOff = p.status === 'on';
  const ok = await confirm.open({
    title: isOff ? t('products.toggle_off_title') : t('products.toggle_on_title'),
    message: isOff ? t('products.toggle_off_confirm', { name: p.name }) : t('products.toggle_on_confirm', { name: p.name }),
  });
  if (!ok) return;
  try {
    await updateProduct(p.id, { status: p.status === 'on' ? 'off' : 'on' });
    toast.success(isOff ? t('products.toast_disabled') : t('products.toast_enabled'));
    refresh();
  } catch (e) { toast.error(e?.message || t('products.operation_failed')); }
}
async function onDelete(p) {
  const ok = await confirm.open({ title: t('products.delete_title'), message: t('products.delete_confirm', { name: p.name }) });
  if (!ok) return;
  try {
    await deleteProduct(p.id);
    toast.success(t('products.toast_deleted'));
    refresh();
  } catch (e) {
    // 有 pending 订单时，后端返回 409 + PENDING_ORDERS_EXIST
    // 弹窗询问是否同时取消 pending 订单
    if (e?.code === 'PENDING_ORDERS_EXIST' || e?.message?.includes('待支付订单')) {
      const confirmCancel = await confirm.open({
        title: '存在待支付订单',
        message: e.message + '\n\n点击确认将取消这些订单并删除商品，点击取消将保留订单。',
      });
      if (!confirmCancel) return;
      try {
        await deleteProduct(p.id, { cancelPending: true });
        toast.success(`商品已删除，已取消 ${e.pendingCount || ''} 个待支付订单`);
        refresh();
      } catch (e2) { toast.error(e2?.message || t('products.delete_failed')); }
    } else {
      toast.error(e?.message || t('products.delete_failed'));
    }
  }
}

onMounted(refresh);
</script>

<style scoped>
.col-price { width: 110px; }
.col-stock { width: 80px; text-align: right; }
.col-sales { width: 70px; text-align: right; }

.tag {
  display: inline-block; font-size: 12px; padding: 2px 10px;
  background: var(--color-border-light); color: var(--color-brand-dim); border-radius: 6px;
  white-space: nowrap;
}
.tag-manual {
  background: rgba(245, 158, 11, 0.12); color: #b45309;
}

/* ===== 表单分区 ===== */
.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  padding: 0 0 var(--space-sm) 10px;
  border-bottom: 1px solid var(--color-border-muted);
  position: relative;
}
.section-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  bottom: var(--space-sm);
  width: 3px;
  background: var(--color-accent);
  border-radius: 2px;
}
.section-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

/* 必填标记紧跟标签文字，提示文字靠右对齐 */
.modal-body .field > label {
  justify-content: flex-start;
}
.modal-body .field > label .field-tip {
  margin-left: auto;
}
.required-mark {
  color: var(--color-danger);
  margin-left: 2px;
  font-weight: 500;
}

/* 规格提示文字 */
.specs-hint {
  margin: 6px 0 0;
  font-size: 12px;
}

/* 三列表单行 */
.field-row-3 {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-md);
}
@media (max-width: 768px) {
  .field-row-3 { grid-template-columns: 1fr; }
}
.prod-cell { display: flex; align-items: center; gap: 12px; min-width: 0; }
.prod-img {
  width: 44px; height: 44px; flex: none; border-radius: 8px;
  background: var(--color-border-light) center/cover no-repeat;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(17,24,39,0.06);
}
.prod-img-fallback { font-size: 16px; color: var(--color-text-tertiary); font-weight: 500; }
.prod-meta { min-width: 0; overflow: hidden; }
.cell-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
.prod-desc { display: block; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }

/* ====== 卡密规格表 ====== */
.specs-table { display: flex; flex-direction: column; gap: 6px; }
.specs-row {
  display: grid; grid-template-columns: 1.2fr 1.4fr 0.9fr 60px 32px;
  gap: 8px; align-items: start;
}
.specs-row > input, .specs-row > select {
  height: 36px; padding: 0 10px; font-size: 13px;
  background: var(--color-bg-page); border: 1px solid rgba(17,24,39,0.12);
  border-radius: 8px; outline: 0; color: var(--color-text); transition: border-color .15s; min-width: 0;
}
.specs-row > input:focus, .specs-row > select:focus { border-color: var(--color-text); }
.specs-head { font-size: 11px; color: var(--color-text-secondary); font-weight: 500; padding: 0 2px; align-items: center; }
.specs-head > span { padding-left: 4px; }

/* 规格时长自定义 */
.spec-duration { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.spec-duration > input { height: 36px; padding: 0 10px; font-size: 13px; min-width: 0;
  background: var(--color-bg-page); border: 1px solid rgba(17,24,39,0.12);
  border-radius: 8px; outline: 0; color: var(--color-text); transition: border-color .15s; }
.spec-duration > input:focus { border-color: var(--color-text); }
.dur-presets { display: flex; flex-wrap: wrap; gap: 4px; }
.dur-chip { height: 22px; padding: 0 8px; font-size: 11px; line-height: 1;
  background: var(--color-bg-surface); border: 1px solid rgba(17,24,39,0.1);
  border-radius: 9999px; cursor: pointer; color: var(--color-text-secondary);
  font-family: inherit; transition: all .15s; }
.dur-chip:hover { border-color: var(--color-text-tertiary); color: var(--color-text); }
.dur-chip.active { background: var(--color-brand); border-color: var(--color-text); color: var(--color-text-inverse); }
.dur-preview { font-size: 11px; color: var(--color-text-tertiary); padding-left: 2px; }

.spec-toggle { display: inline-flex; cursor: pointer; justify-self: center; margin-top: 9px; }
.spec-toggle .switch {
  display: inline-block; width: 32px; height: 18px;
  background: var(--color-border-muted); border-radius: 9999px; position: relative; transition: background .2s;
}
.spec-toggle .switch::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%; background: var(--color-bg-page); transition: left .2s;
}
.spec-toggle input { display: none; }
.spec-toggle input:checked + .switch { background: var(--color-brand); }
.spec-toggle input:checked + .switch::after { left: 16px; }
.spec-remove {
  width: 28px; height: 28px; background: transparent; border: 0; color: var(--color-text-tertiary);
  border-radius: 6px; font-size: 18px; line-height: 1; cursor: pointer;
  transition: all .15s; margin-top: 4px;
}
.spec-remove:hover:not(:disabled) { color: var(--color-danger); background: var(--color-danger-bg); }
.spec-remove:disabled { opacity: 0.3; cursor: not-allowed; }
.spec-add {
  margin-top: 8px; display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 12px; font-size: 12px; color: var(--color-brand-dim);
  background: var(--color-border-light); border: 1px dashed rgba(17,24,39,0.15);
  border-radius: 8px; cursor: pointer; transition: all .15s;
}
.spec-add svg { width: 12px; height: 12px; }
.spec-add:hover { color: var(--color-text); border-color: var(--color-text); background: var(--color-bg-surface); }
</style>
