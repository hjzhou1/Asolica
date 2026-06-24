<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">{{ t('coupons.title') }}</h1>
        <p class="page-subtitle">{{ t('coupons.subtitle') }}</p>
      </div>
      <button class="btn-primary" @click="openCreate">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        <span>{{ t('coupons.create') }}</span>
      </button>
    </header>

    <div class="card">
      <div v-if="loading" class="state-block">
        <div class="spinner-lg" aria-hidden="true" />
        <p>{{ t('coupons.loading') }}</p>
      </div>

      <div v-else-if="!list.length" class="state-block empty">
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M8 20h48v24H8z" stroke="#d1d5db" stroke-width="1.5"/>
          <path d="M8 28h48" stroke="#d1d5db" stroke-width="1.5"/>
        </svg>
        <h3>{{ t('coupons.empty') }}</h3>
        <p>{{ t('coupons.empty_hint') }}</p>
      </div>

      <table v-else class="data-table">
        <thead>
          <tr>
            <th>{{ t('coupons.col_code') }}</th>
            <th>{{ t('coupons.col_discount') }}</th>
            <th>{{ t('coupons.col_status') }}</th>
            <th>{{ t('coupons.col_remaining') }}</th>
            <th>{{ t('coupons.col_used') }}</th>
            <th>{{ t('coupons.col_products') }}</th>
            <th>{{ t('coupons.col_note') }}</th>
            <th class="col-actions">{{ t('coupons.col_actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in list" :key="c.id">
            <td class="mono">{{ c.code }}</td>
            <td class="price">¥{{ c.discount.toFixed(2) }}</td>
            <td>
              <StatusBadge :status="c.isOpen ? 'enabled' : 'disabled'" />
            </td>
            <td class="cell-muted">{{ c.ret === -1 ? t('coupons.unlimited') : c.ret }}</td>
            <td class="cell-muted">{{ c.usedCount }}</td>
            <td>
              <span v-if="c.productNames.length === 0" class="cell-muted">{{ t('coupons.all_products') }}</span>
              <span v-else class="cell-name">{{ c.productNames.join('、') }}</span>
            </td>
            <td class="cell-muted">{{ c.note || '—' }}</td>
            <td class="col-actions">
              <button class="link-btn" @click="openEdit(c)">{{ t('coupons.edit') }}</button>
              <button class="link-btn" @click="onToggle(c)">{{ c.isOpen ? t('coupons.toggle_disable') : t('coupons.toggle_enable') }}</button>
              <button class="link-btn danger" @click="onDelete(c)">{{ t('coupons.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 弹窗：新建 / 编辑 -->
    <transition name="modal">
      <div v-if="modalOpen" class="modal-mask" @click.self="closeModal">
        <div class="modal" role="dialog" aria-modal="true">
          <header class="modal-head">
            <h3>{{ isEdit ? t('coupons.edit_title') : t('coupons.create_title') }}</h3>
            <button class="modal-close" @click="closeModal" aria-label="close">&times;</button>
          </header>
          <form class="modal-body" @submit.prevent="onSubmit">
            <div class="field" :class="{ 'is-error': errors.code }">
              <label>{{ t('coupons.field_code') }}<span class="field-tip">{{ t('coupons.field_required') }}</span></label>
              <input v-model="form.code" type="text" :placeholder="t('coupons.code_placeholder')" maxlength="50" />
              <p v-if="errors.code" class="field-error">{{ errors.code }}</p>
            </div>

            <div class="field" :class="{ 'is-error': errors.discount }">
              <label>{{ t('coupons.field_discount') }}<span class="field-tip">{{ t('coupons.field_required') }}</span></label>
              <input v-model.number="form.discount" type="number" step="0.01" min="0" :placeholder="t('coupons.discount_placeholder')" />
              <p v-if="errors.discount" class="field-error">{{ errors.discount }}</p>
              <p class="field-hint">{{ t('coupons.discount_hint') }}</p>
            </div>

            <div class="field">
              <label>{{ t('coupons.field_remaining') }}</label>
              <input v-model.number="form.ret" type="number" min="-1" :placeholder="t('coupons.remaining_placeholder')" />
              <p class="field-hint">{{ t('coupons.remaining_hint') }}</p>
            </div>

            <div class="field">
              <label>{{ t('coupons.field_products') }}</label>
              <div class="checkbox-group">
                <label class="checkbox-item">
                  <input type="checkbox" v-model="allProducts" @change="toggleAllProducts" />
                  <span>{{ t('coupons.all_products') }}</span>
                </label>
                <label v-for="p in products" :key="p.id" class="checkbox-item">
                  <input type="checkbox" :value="p.id" v-model="form.productIds" :disabled="allProducts" />
                  <span>{{ p.name }}</span>
                </label>
              </div>
              <p class="field-hint">{{ t('coupons.products_hint') }}</p>
            </div>

            <div class="field">
              <label>{{ t('coupons.field_note') }}</label>
              <input v-model="form.note" type="text" :placeholder="t('coupons.note_placeholder')" maxlength="200" />
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-ghost" @click="closeModal">{{ t('coupons.cancel') }}</button>
              <button type="submit" class="btn-primary" :disabled="submitting">
                {{ submitting ? t('coupons.saving') : t('coupons.save') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { listCoupons, createCoupon, updateCoupon, deleteCoupon, listProducts } from '../../api/admin.js';
import { useConfirm } from '../../composables/useConfirm.js';
import { useToast } from '../../composables/useToast.js';
import StatusBadge from '../../components/shop/StatusBadge.vue';

const { t } = useI18n();
const confirm = useConfirm();
const toast = useToast();

const list = ref([]);
const products = ref([]);
const loading = ref(true);
const modalOpen = ref(false);
const isEdit = ref(false);
const submitting = ref(false);
const allProducts = ref(false);

const form = reactive({
  id: '',
  code: '',
  discount: 0,
  ret: -1,
  note: '',
  productIds: [],
});

const errors = reactive({});

function resetForm() {
  form.id = '';
  form.code = '';
  form.discount = 0;
  form.ret = -1;
  form.note = '';
  form.productIds = [];
  allProducts.value = false;
  Object.keys(errors).forEach(k => delete errors[k]);
}

function toggleAllProducts() {
  if (allProducts.value) {
    form.productIds = [];
  }
}

function openCreate() {
  resetForm();
  isEdit.value = false;
  modalOpen.value = true;
}

function openEdit(c) {
  resetForm();
  isEdit.value = true;
  form.id = c.id;
  form.code = c.code;
  form.discount = c.discount;
  form.ret = c.ret;
  form.note = c.note || '';
  form.productIds = [...(c.productIds || [])];
  allProducts.value = form.productIds.length === 0;
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
}

function validate() {
  Object.keys(errors).forEach(k => delete errors[k]);
  if (!form.code.trim()) errors.code = t('coupons.err_code');
  if (form.discount === '' || form.discount === null || form.discount < 0) errors.discount = t('coupons.err_discount');
  return Object.keys(errors).length === 0;
}

async function onSubmit() {
  if (!validate()) return;
  submitting.value = true;
  try {
    const payload = {
      code: form.code.trim(),
      discount: Number(form.discount),
      ret: Number(form.ret),
      note: form.note.trim(),
      productIds: allProducts.value ? [] : form.productIds,
    };
    if (isEdit.value) {
      await updateCoupon(form.id, payload);
      toast.success(t('coupons.toast_updated'));
    } else {
      await createCoupon(payload);
      toast.success(t('coupons.toast_created'));
    }
    modalOpen.value = false;
    await loadList();
  } catch (e) {
    toast.error(e.message || t('coupons.toast_save_failed'));
  } finally {
    submitting.value = false;
  }
}

async function onToggle(c) {
  try {
    await updateCoupon(c.id, { isOpen: !c.isOpen });
    toast.success(c.isOpen ? t('coupons.toast_disabled') : t('coupons.toast_enabled'));
    await loadList();
  } catch (e) {
    toast.error(e.message || t('coupons.toast_operation_failed'));
  }
}

async function onDelete(c) {
  const ok = await confirm.open({
    title: t('coupons.delete_title'),
    message: t('coupons.delete_confirm', { code: c.code }),
  });
  if (!ok) return;
  try {
    await deleteCoupon(c.id);
    toast.success(t('coupons.toast_deleted'));
    await loadList();
  } catch (e) {
    toast.error(e.message || t('coupons.toast_delete_failed'));
  }
}

async function loadList() {
  loading.value = true;
  try {
    list.value = await listCoupons();
  } catch (e) {
    toast.error(e.message || t('coupons.load_failed'));
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadList();
  try {
    const p = await listProducts();
    products.value = Array.isArray(p) ? p : (p?.data || []);
  } catch { /* ignore */ }
});
</script>

<style scoped>
.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 4px;
}
.checkbox-item {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 14px;
}
.checkbox-item input[type="checkbox"] {
  margin: 0;
}
.field-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}
</style>
