<template>
  <div class="page">
    <!-- 顶栏 -->
    <header class="page-head">
      <div>
        <h1 class="page-title">{{ t('categories.title') }}</h1>
        <p class="page-subtitle">{{ t('categories.subtitle') }}</p>
      </div>
      <button class="btn-primary" @click="openCreate">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        <span>{{ t('categories.create') }}</span>
      </button>
    </header>

    <!-- 列表 -->
    <div class="card">
      <div v-if="loading" class="state-block">
        <div class="spinner-lg" aria-hidden="true" />
        <p>{{ t('categories.loading') }}</p>
      </div>

      <div v-else-if="!list.length" class="state-block empty">
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect x="8" y="14" width="48" height="14" rx="3" stroke="#d1d5db" stroke-width="1.5"/>
          <rect x="8" y="36" width="48" height="14" rx="3" stroke="#d1d5db" stroke-width="1.5"/>
        </svg>
        <h3>{{ t('categories.no_categories') }}</h3>
        <p>{{ t('categories.no_categories_hint') }}</p>
      </div>

      <table v-else class="data-table">
        <thead>
          <tr>
            <th class="col-sort">{{ t('categories.col_sort') }}</th>
            <th>{{ t('categories.col_category') }}</th>
            <th>{{ t('categories.col_desc') }}</th>
            <th class="col-status">{{ t('categories.col_status') }}</th>
            <th class="col-time">{{ t('categories.col_created_at') }}</th>
            <th class="col-actions">{{ t('categories.col_actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in list" :key="c.id">
            <td class="col-sort mono">{{ c.sort }}</td>
            <td>
              <div class="cat-cell">
                <div class="cat-thumb" :style="cImg(c.image) ? { backgroundImage: `url(${cImg(c.image)})` } : null">
                  <span v-if="!cImg(c.image)" class="cat-thumb-fallback">{{ c.name.slice(0,1) }}</span>
                </div>
                <span class="cell-name">{{ c.name }}</span>
              </div>
            </td>
            <td><span class="cell-muted">{{ c.desc || '—' }}</span></td>
            <td class="col-status">
              <StatusBadge :status="c.enabled ? 'enabled' : 'disabled'" />
            </td>
            <td class="col-time cell-muted">{{ formatTime(c.createdAt) }}</td>
            <td class="col-actions">
              <button class="link-btn" @click="openEdit(c)">{{ t('categories.edit') }}</button>
              <button class="link-btn" @click="onToggle(c)">{{ c.enabled ? t('categories.toggle_disable') : t('categories.toggle_enable') }}</button>
              <button class="link-btn danger" @click="onDelete(c)">{{ t('categories.delete') }}</button>
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
            <h3>{{ isEdit ? t('categories.edit_title') : t('categories.create_title') }}</h3>
            <button class="modal-close" @click="closeModal" aria-label="close">&times;</button>
          </header>
          <form class="modal-body" @submit.prevent="onSubmit">
            <div class="field" :class="{ 'is-error': errors.name }">
              <label>{{ t('categories.name') }}<span class="field-tip">{{ t('products.required') }}</span></label>
              <input v-model="form.name" type="text" :placeholder="t('categories.name_placeholder')" maxlength="32" />
              <p v-if="errors.name" class="field-error">{{ errors.name }}</p>
            </div>
            <div class="field">
              <label>{{ t('categories.image') }}<span class="field-tip">{{ t('categories.image_tip') }}</span></label>
              <ImagePicker v-model="form.image" :placeholder="t('categories.image_placeholder')" />
            </div>
            <div class="field">
              <label>{{ t('categories.sort') }}<span class="field-tip">{{ t('categories.sort_tip') }}</span></label>
              <input v-model.number="form.sort" type="number" placeholder="0" />
            </div>
            <div class="field">
              <label>{{ t('categories.desc') }}<span class="field-tip">{{ t('categories.desc_tip') }}</span></label>
              <input v-model="form.desc" type="text" :placeholder="t('categories.desc_placeholder')" maxlength="80" />
            </div>
            <div class="field field-row">
              <label class="switch-label">
                <input type="checkbox" v-model="form.enabled" />
                <span class="switch" />
                <span>{{ t('categories.enable_label') }}</span>
              </label>
            </div>
            <p v-if="formError" class="form-error">{{ formError }}</p>
          </form>
          <footer class="modal-foot">
            <button type="button" class="btn-ghost" @click="closeModal">{{ t('categories.cancel') }}</button>
            <button type="button" class="btn-primary" :disabled="submitting" @click="onSubmit">
              <span v-if="submitting" class="spinner" aria-hidden="true" />
              <span>{{ submitting ? t('categories.saving') : (isEdit ? t('categories.save') : t('categories.create_btn')) }}</span>
            </button>
          </footer>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  listCategories, createCategory, updateCategory, deleteCategory,
} from '../../api/admin.js';
import { resolveImageUrl } from '../../utils/media.js';
import { useToast } from '../../composables/useToast.js';
import { useConfirm } from '../../composables/useConfirm.js';
import { formatTime } from '../../composables/useFormat.js';
import ImagePicker from '../../components/admin/ImagePicker.vue';
import StatusBadge from '../../components/shop/StatusBadge.vue';

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const list = ref([]);
function cImg(ref) { return resolveImageUrl(ref); }
const loading = ref(false);

const modalOpen = ref(false);
const isEdit = ref(false);
const editingId = ref('');
const form = reactive({ name: '', sort: 0, desc: '', enabled: true, image: '' });
const errors = reactive({ name: '' });
const formError = ref('');
const submitting = ref(false);

async function refresh() {
  loading.value = true;
  try {
    list.value = await listCategories();
  } catch (e) {
    toast.error(e?.message || t('categories.load_failed'));
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  isEdit.value = false; editingId.value = '';
  form.name = ''; form.sort = 0; form.desc = ''; form.enabled = true; form.image = '';
  errors.name = ''; formError.value = '';
  modalOpen.value = true;
}
function openEdit(c) {
  isEdit.value = true; editingId.value = c.id;
  form.name = c.name; form.sort = c.sort ?? 0; form.desc = c.desc || ''; form.enabled = c.enabled !== false;
  form.image = c.image || '';
  errors.name = ''; formError.value = '';
  modalOpen.value = true;
}
function closeModal() { modalOpen.value = false; }

function validate() {
  errors.name = ''; formError.value = '';
  if (!form.name.trim()) { errors.name = t('categories.err_name'); return false; }
  if (form.name.trim().length > 32) { errors.name = t('categories.err_name_max'); return false; }
  return true;
}
async function onSubmit() {
  if (submitting.value) return;
  if (!validate()) return;
  submitting.value = true;
  try {
    if (isEdit.value) {
      await updateCategory(editingId.value, {
        name: form.name.trim(), sort: Number(form.sort) || 0,
        desc: form.desc.trim(), enabled: form.enabled, image: form.image,
      });
      toast.success(t('categories.toast_saved'));
    } else {
      await createCategory({
        name: form.name.trim(), sort: Number(form.sort) || 0,
        desc: form.desc.trim(), enabled: form.enabled, image: form.image,
      });
      toast.success(t('categories.toast_created'));
    }
    modalOpen.value = false;
    refresh();
  } catch (e) {
    formError.value = e?.message || t('categories.save_failed');
  } finally {
    submitting.value = false;
  }
}

async function onToggle(c) {
  const ok = await confirm.open({ title: c.enabled ? t('categories.disable_title') : t('categories.enable_title'), message: c.enabled ? t('categories.disable_confirm', { name: c.name }) : t('categories.enable_confirm', { name: c.name }) });
  if (!ok) return;
  try {
    await updateCategory(c.id, { enabled: !c.enabled });
    toast.success(c.enabled ? t('categories.toast_disabled') : t('categories.toast_enabled'));
    refresh();
  } catch (e) { toast.error(e?.message || t('categories.operation_failed')); }
}
async function onDelete(c) {
  const ok = await confirm.open({ title: t('categories.delete_title'), message: t('categories.delete_confirm', { name: c.name }) });
  if (!ok) return;
  try {
    await deleteCategory(c.id);
    toast.success(t('categories.toast_deleted'));
    refresh();
  } catch (e) { toast.error(e?.message || t('categories.delete_failed')); }
}

onMounted(refresh);
</script>
