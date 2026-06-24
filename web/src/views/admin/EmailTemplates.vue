<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">{{ t('email_templates.title') }}</h1>
        <p class="page-subtitle">{{ t('email_templates.subtitle') }}</p>
      </div>
      <button class="btn-ghost" :class="{ 'is-loading': loading }" @click="refresh">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 8a5 5 0 11-1.5-3.5L13 6M13 3v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>{{ t('cards.refresh') }}</span>
      </button>
    </header>

    <div class="card">
      <div v-if="loading" class="state-block">
        <div class="spinner-lg" aria-hidden="true" />
        <p>{{ t('common.loading') }}</p>
      </div>

      <div v-else-if="!list.length" class="state-block empty">
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect x="8" y="16" width="48" height="32" rx="4" stroke="#d1d5db" stroke-width="1.5"/>
          <path d="M8 20l24 16 24-16" stroke="#d1d5db" stroke-width="1.5"/>
        </svg>
        <h3>{{ t('email_templates.empty') }}</h3>
        <p>{{ t('email_templates.empty_hint') }}</p>
      </div>

      <table v-else class="data-table">
        <thead>
          <tr>
            <th>{{ t('email_templates.tpl_name') }}</th>
            <th>{{ t('email_templates.tpl_token') }}</th>
            <th class="col-status">{{ t('email_templates.enabled') }}</th>
            <th class="col-time">{{ t('email_templates.col_updated_at') }}</th>
            <th class="col-actions">{{ t('email_templates.col_actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tpl in list" :key="tpl.id">
            <td><span class="cell-name">{{ tpl.tplName }}</span></td>
            <td><code class="cell-code">{{ tpl.tplToken }}</code></td>
            <td class="col-status">
              <StatusBadge :status="tpl.enabled ? 'enabled' : 'disabled'" />
            </td>
            <td class="col-time cell-muted">{{ formatTime(tpl.updatedAt || tpl.createdAt) }}</td>
            <td class="col-actions">
              <button class="link-btn" @click="openEdit(tpl)">{{ t('email_templates.edit') }}</button>
              <button class="link-btn" @click="openTest(tpl)">{{ t('email_templates.test_email') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 模板变量说明（参考独角数卡） -->
    <div class="vars-hint card">
      <h4>{{ t('email_templates.variables_title') }}</h4>
      <p class="cell-muted">{{ t('email_templates.variables_hint') }}</p>
      <div class="vars-list">
        <code v-for="v in variables" :key="v" class="var-chip">{{ v }}</code>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <transition name="modal">
      <div v-if="modalOpen" class="modal-mask" @click.self="closeModal">
        <div class="modal modal-lg" role="dialog" aria-modal="true">
          <header class="modal-head">
            <h3>{{ t('email_templates.edit_title') }}</h3>
            <button class="modal-close" @click="closeModal" aria-label="close">&times;</button>
          </header>
          <form class="modal-body" @submit.prevent="onSubmit">
            <div class="field">
              <label>{{ t('email_templates.tpl_name') }}</label>
              <input v-model="form.tplName" type="text" :placeholder="t('email_templates.tpl_name_placeholder')" />
            </div>
            <div class="field">
              <label>{{ t('email_templates.tpl_content') }}<span class="field-tip">{{ t('email_templates.tpl_content_tip') }}</span></label>
              <textarea v-model="form.tplContent" rows="14" :placeholder="t('email_templates.tpl_content_placeholder')" />
            </div>
            <div class="field field-row">
              <label class="switch-label">
                <input type="checkbox" v-model="form.enabled" />
                <span class="switch" />
                <span>{{ t('email_templates.enabled') }}</span>
              </label>
            </div>
            <p v-if="formError" class="form-error">{{ formError }}</p>
          </form>
          <footer class="modal-foot">
            <button type="button" class="btn-ghost" @click="closeModal">{{ t('email_templates.cancel') }}</button>
            <button type="button" class="btn-primary" :disabled="submitting" @click="onSubmit">
              <span v-if="submitting" class="spinner" aria-hidden="true" />
              <span>{{ submitting ? t('email_templates.saving') : t('email_templates.save') }}</span>
            </button>
          </footer>
        </div>
      </div>
    </transition>

    <!-- 测试邮件弹窗 -->
    <transition name="modal">
      <div v-if="testOpen" class="modal-mask" @click.self="closeTest">
        <div class="modal" role="dialog" aria-modal="true">
          <header class="modal-head">
            <h3>{{ t('email_templates.test_email_title') }}</h3>
            <button class="modal-close" @click="closeTest" aria-label="close">&times;</button>
          </header>
          <div class="modal-body">
            <p class="cell-muted" style="margin:0 0 12px">{{ t('email_templates.test_email_hint', { name: testTarget?.tplName }) }}</p>
            <div class="field">
              <label>{{ t('email_templates.test_email_addr') }}</label>
              <input v-model="testEmailAddr" type="email" :placeholder="t('email_templates.test_email_placeholder')" />
            </div>
            <p v-if="testError" class="form-error">{{ testError }}</p>
          </div>
          <footer class="modal-foot">
            <button type="button" class="btn-ghost" @click="closeTest">{{ t('email_templates.cancel') }}</button>
            <button type="button" class="btn-primary" :disabled="testing" @click="onSendTest">
              <span v-if="testing" class="spinner" aria-hidden="true" />
              <span>{{ testing ? t('email_templates.sending') : t('email_templates.send') }}</span>
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
import { listEmailTemplates, updateEmailTemplate, testEmailTemplate } from '../../api/admin.js';
import { useToast } from '../../composables/useToast.js';
import { formatTime } from '../../composables/useFormat.js';
import StatusBadge from '../../components/shop/StatusBadge.vue';

const { t } = useI18n();
const toast = useToast();

// 支持的模板变量（参考独角数卡）
const variables = ['{webname}', '{order_id}', '{product_name}', '{buy_amount}', '{ord_price}', '{ord_info}', '{created_at}', '{buyer_email}'];

const list = ref([]);
const loading = ref(false);

// 编辑弹窗状态
const modalOpen = ref(false);
const submitting = ref(false);
const formError = ref('');
const form = reactive({ id: '', tplName: '', tplContent: '', enabled: true });

// 测试邮件弹窗状态
const testOpen = ref(false);
const testTarget = ref(null);
const testEmailAddr = ref('');
const testing = ref(false);
const testError = ref('');

async function refresh() {
  loading.value = true;
  try {
    list.value = await listEmailTemplates();
  } catch (e) {
    toast.error(e?.message || t('email_templates.load_failed'));
  } finally {
    loading.value = false;
  }
}

function openEdit(tpl) {
  form.id = tpl.id;
  form.tplName = tpl.tplName || '';
  form.tplContent = tpl.tplContent || '';
  form.enabled = !!tpl.enabled;
  formError.value = '';
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
}

async function onSubmit() {
  if (submitting.value) return;
  if (!form.tplName.trim()) {
    formError.value = t('email_templates.err_tpl_name');
    return;
  }
  submitting.value = true;
  formError.value = '';
  try {
    await updateEmailTemplate(form.id, {
      tplName: form.tplName.trim(),
      tplContent: form.tplContent,
      enabled: form.enabled,
    });
    toast.success(t('email_templates.toast_saved'));
    modalOpen.value = false;
    refresh();
  } catch (e) {
    formError.value = e?.message || t('email_templates.save_failed');
  } finally {
    submitting.value = false;
  }
}

function openTest(tpl) {
  testTarget.value = tpl;
  testEmailAddr.value = '';
  testError.value = '';
  testOpen.value = true;
}

function closeTest() {
  testOpen.value = false;
}

async function onSendTest() {
  if (testing.value) return;
  if (!testEmailAddr.value.trim()) {
    testError.value = t('email_templates.err_test_email');
    return;
  }
  testing.value = true;
  testError.value = '';
  try {
    await testEmailTemplate(testTarget.value.id, testEmailAddr.value.trim());
    toast.success(t('email_templates.toast_test_sent'));
    testOpen.value = false;
  } catch (e) {
    testError.value = e?.message || t('email_templates.toast_send_failed');
  } finally {
    testing.value = false;
  }
}

onMounted(refresh);
</script>

<style scoped>
.col-status { width: 100px; }
.col-time { width: 160px; }
.col-actions { width: 200px; text-align: right; }

/* 模板变量说明 */
.vars-hint {
  margin-top: 16px; padding: 16px 20px;
}
.vars-hint h4 {
  font-size: 13px; font-weight: 600; color: var(--color-brand-dim);
  margin: 0 0 8px;
}
.vars-hint .cell-muted { font-size: 12px; margin: 0 0 10px; }
.vars-list { display: flex; flex-wrap: wrap; gap: 6px; }
.var-chip {
  font-family: 'SF Mono', Monaco, monospace; font-size: 12px;
  padding: 3px 8px; background: var(--color-border-light);
  color: var(--color-brand-dim); border-radius: 6px;
}
</style>
