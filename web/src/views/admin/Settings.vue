<template>
  <div class="settings-page">
    <h2 class="page-title">{{ t('settings.title') }}</h2>

    <!-- 基本设置 -->
    <section class="settings-section">
      <h3>{{ t('settings.site') }}</h3>
      <div class="form-grid">
        <label>
          <span>{{ t('settings.site_name') }}</span>
          <input v-model="form['site.name']" :placeholder="t('settings.site_name_placeholder')" />
        </label>
        <label>
          <span>{{ t('settings.site_desc') }}</span>
          <input v-model="form['site.description']" :placeholder="t('settings.site_desc_placeholder')" />
        </label>
        <label class="full">
          <span>{{ t('settings.announcement') }}</span>
          <textarea v-model="form['site.announcement']" :placeholder="t('settings.announcement_placeholder')" rows="3"></textarea>
        </label>
      </div>
    </section>

    <!-- 支付方式（数据库驱动） -->
    <section class="settings-section">
      <div class="section-head">
        <h3>{{ t('settings.payment') }}</h3>
        <button class="btn-sm" @click="openPaymentMethodModal()">{{ t('settings.payment_method_add') }}</button>
      </div>

      <div v-if="!paymentMethods.length" class="empty-state">
        <p>{{ t('settings.payment_method_no_data') }}</p>
        <small>{{ t('settings.payment_method_no_data_hint') }}</small>
      </div>

      <div v-else class="payment-list">
        <div v-for="pm in paymentMethods" :key="pm.id" class="payment-card">
          <div class="payment-header">
            <label class="switch-label">
              <input type="checkbox" :checked="pm.enabled" @change="togglePaymentMethod(pm)" />
              <span class="switch"></span>
            </label>
            <span class="pm-icon" aria-hidden="true">{{ methodIcon(pm.method) }}</span>
            <div class="pm-title">
              <strong>{{ pm.name }}</strong>
              <span class="pm-subtitle">{{ adapterLabel(pm.adapter) }} · {{ t('settings.payment_method_sort') }} {{ pm.sort }}</span>
            </div>
            <span v-if="pm.enabled" class="badge on">{{ t('settings.payment_enabled') }}</span>
            <span v-else class="badge off">{{ t('settings.payment_disabled') }}</span>
            <div class="grow" />
            <button class="link-btn" @click="openPaymentMethodModal(pm)">{{ t('common.edit') }}</button>
            <button class="link-btn danger" @click="onDeletePaymentMethod(pm)">{{ t('common.delete') }}</button>
          </div>
          <div class="payment-meta">
            <span class="meta-item">
              <span class="meta-label">{{ t('settings.payment_method_callback_url') }}</span>
              <code class="callback-url-sm">{{ origin }}/api/payment/callback/{{ pm.id }}</code>
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- 邮件配置 -->
    <section class="settings-section">
      <h3>{{ t('settings.email') }}</h3>
      <p class="hint">{{ t('settings.email_hint') }}</p>
      <div class="form-grid">
        <label>
          <span>{{ t('settings.driver') }}</span>
          <select v-model="form['mail.driver']">
            <option value="smtp">{{ t('settings.driver_smtp') }}</option>
            <option value="resend">{{ t('settings.driver_resend') }}</option>
            <option value="aliyun">{{ t('settings.driver_aliyun') }}</option>
            <option value="tencent">{{ t('settings.driver_tencent') }}</option>
          </select>
        </label>

        <!-- 通用配置：发信地址 + 发信人名称（所有驱动都需要） -->
        <label>
          <span>{{ t('settings.from_addr') }}</span>
          <input v-model="form['mail.from_addr']" placeholder="admin@example.com" />
        </label>
        <label>
          <span>{{ t('settings.from_name') }}</span>
          <input v-model="form['mail.from_name']" :placeholder="t('settings.from_name_placeholder')" />
        </label>

        <!-- SMTP 配置 -->
        <template v-if="form['mail.driver'] === 'smtp'">
          <label>
            <span>{{ t('settings.smtp_host') }}</span>
            <input v-model="form['mail.smtp_host']" placeholder="smtp.qq.com" />
          </label>
          <label>
            <span>{{ t('settings.smtp_port') }}</span>
            <input v-model="form['mail.smtp_port']" placeholder="465" />
          </label>
          <label>
            <span>{{ t('settings.smtp_secure') }}</span>
            <select v-model="form['mail.smtp_secure']">
              <option value="ssl">{{ t('settings.secure_ssl') }}</option>
              <option value="tls">{{ t('settings.secure_tls') }}</option>
            </select>
          </label>
          <label>
            <span>{{ t('settings.smtp_pass') }}</span>
            <input type="password" v-model="form['mail.smtp_pass']" :placeholder="t('settings.smtp_pass_placeholder')" />
          </label>
        </template>

        <!-- Resend 配置 -->
        <template v-else-if="form['mail.driver'] === 'resend'">
          <label class="full">
            <span>{{ t('settings.resend_api_key') }}</span>
            <input type="password" v-model="form['mail.resend_api_key']" :placeholder="t('settings.resend_api_key_placeholder')" />
            <small class="hint">{{ t('settings.resend_hint') }}</small>
          </label>
        </template>

        <!-- 阿里云邮件推送配置 -->
        <template v-else-if="form['mail.driver'] === 'aliyun'">
          <label>
            <span>{{ t('settings.aliyun_access_key_id') }}</span>
            <input v-model="form['mail.aliyun_access_key_id']" placeholder="LTAI5tXXXXXXX" />
          </label>
          <label>
            <span>{{ t('settings.aliyun_access_key_secret') }}</span>
            <input type="password" v-model="form['mail.aliyun_access_key_secret']" placeholder="AccessKey Secret" />
          </label>
          <label>
            <span>{{ t('settings.aliyun_region') }}</span>
            <input v-model="form['mail.aliyun_region']" placeholder="cn-hangzhou" />
          </label>
          <label class="full">
            <small class="hint">{{ t('settings.aliyun_hint') }}</small>
          </label>
        </template>

        <!-- 腾讯云 SES 配置 -->
        <template v-else-if="form['mail.driver'] === 'tencent'">
          <label>
            <span>{{ t('settings.tencent_secret_id') }}</span>
            <input v-model="form['mail.tencent_secret_id']" placeholder="AKIDXXXXXXXX" />
          </label>
          <label>
            <span>{{ t('settings.tencent_secret_key') }}</span>
            <input type="password" v-model="form['mail.tencent_secret_key']" placeholder="SecretKey" />
          </label>
          <label>
            <span>{{ t('settings.tencent_region') }}</span>
            <input v-model="form['mail.tencent_region']" placeholder="ap-guangzhou" />
          </label>
          <label class="full">
            <small class="hint">{{ t('settings.tencent_hint') }}</small>
          </label>
        </template>

        <label class="full">
          <span>{{ t('settings.test_email') }}</span>
          <div class="test-email-row">
            <input v-model="testEmailAddr" :placeholder="t('settings.test_email_placeholder')" />
            <button class="btn-sm" @click="sendTest" :disabled="testing">{{ testing ? t('settings.sending') : t('settings.send_test') }}</button>
          </div>
        </label>
        </div>
    </section>

    <!-- 订单设置（参考独角数卡） -->
    <section class="settings-section">
      <h3>{{ t('settings.order_settings') }}</h3>
      <div class="form-grid">
        <label class="full switch-row">
          <span>{{ t('settings.search_pwd') }}</span>
          <label class="switch-label inline-switch">
            <input type="checkbox" :checked="orderForm['order.search_pwd_enabled'] === '1'" @change="orderForm['order.search_pwd_enabled'] = $event.target.checked ? '1' : '0'" />
            <span class="switch"></span>
            <span class="switch-text">{{ orderForm['order.search_pwd_enabled'] === '1' ? t('common.enabled') : t('common.disabled') }}</span>
          </label>
          <small class="hint">{{ t('settings.search_pwd_hint') }}</small>
        </label>
        <label class="full">
          <span>{{ t('settings.manage_email') }}</span>
          <input v-model="orderForm['order.manage_email']" :placeholder="t('settings.manage_email_placeholder')" />
          <small class="hint">{{ t('settings.manage_email_hint') }}</small>
        </label>
      </div>
    </section>

    <!-- 保存按钮 -->
    <div class="actions">
      <button class="btn-primary" @click="saveAll" :disabled="saving">{{ saving ? t('settings.saving') : t('settings.save_all') }}</button>
    </div>

    <!-- 支付方式弹窗 -->
    <transition name="modal">
      <div v-if="pmModal.open" class="modal-mask" @click.self="closePaymentMethodModal">
        <div class="modal" role="dialog" aria-modal="true">
          <header class="modal-head">
            <h3>{{ pmModal.editingId ? t('settings.payment_method_edit') : t('settings.payment_method_add') }}</h3>
            <button class="modal-close" @click="closePaymentMethodModal" aria-label="close">&times;</button>
          </header>
          <form class="modal-body" @submit.prevent="onSavePaymentMethod">
            <div class="field" :class="{ 'is-error': pmModal.errors.name }">
              <label>{{ t('settings.payment_method_name') }}<span class="field-tip">{{ t('products.required') }}</span></label>
              <input v-model="pmModal.form.name" :placeholder="t('settings.payment_method_name_placeholder')" />
              <p v-if="pmModal.errors.name" class="field-error">{{ pmModal.errors.name }}</p>
            </div>
            <div class="form-grid-2">
              <div class="field" :class="{ 'is-error': pmModal.errors.adapter }">
                <label>{{ t('settings.payment_method_adapter') }}<span class="field-tip">{{ t('products.required') }}</span></label>
                <select v-model="pmModal.form.adapter" :disabled="!!pmModal.editingId">
                  <option value="">{{ t('orders.product_placeholder') }}</option>
                  <option v-for="a in supportedAdapters" :key="a" :value="a">{{ adapterLabel(a) }}</option>
                </select>
                <p class="field-hint">{{ t('settings.payment_method_adapter_tip') }}</p>
                <p v-if="pmModal.errors.adapter" class="field-error">{{ pmModal.errors.adapter }}</p>
              </div>
              <div class="field" :class="{ 'is-error': pmModal.errors.method }">
                <label>{{ t('settings.payment_method_method') }}<span class="field-tip">{{ t('products.required') }}</span></label>
                <select v-model="pmModal.form.method">
                  <option value="">{{ t('orders.product_placeholder') }}</option>
                  <option value="alipay">{{ t('settings.payment_method_method_alipay') }}</option>
                  <option value="wechat">{{ t('settings.payment_method_method_wechat') }}</option>
                </select>
                <p v-if="pmModal.errors.method" class="field-error">{{ pmModal.errors.method }}</p>
              </div>
            </div>
            <div class="form-grid-2">
              <div class="field">
                <label>{{ t('settings.payment_method_sort') }}</label>
                <input v-model.number="pmModal.form.sort" type="number" min="0" />
              </div>
              <div class="field switch-row-inline">
                <label class="switch-label inline-switch">
                  <input type="checkbox" v-model="pmModal.form.enabled" />
                  <span class="switch"></span>
                  <span class="switch-text">{{ pmModal.form.enabled ? t('common.enabled') : t('common.disabled') }}</span>
                </label>
              </div>
            </div>

            <!-- 动态配置字段 -->
            <div class="field-group">
              <h4>{{ t('settings.payment_method_config') }}</h4>
              <template v-if="pmModal.form.adapter === 'hupi'">
                <div class="form-grid-2">
                  <label><span>{{ t('settings.app_id') }}</span><input v-model="pmModal.form.config.app_id" :placeholder="t('settings.app_id_placeholder')" /></label>
                  <label><span>{{ t('settings.app_secret') }}</span><input type="password" v-model="pmModal.form.config.app_secret" :placeholder="t('settings.app_secret_placeholder')" @input="onConfigInput('app_secret')" /></label>
                </div>
              </template>
              <template v-else-if="pmModal.form.adapter === 'yi'">
                <div class="form-grid-2">
                  <label><span>{{ t('settings.merchant_pid') }}</span><input v-model="pmModal.form.config.pid" :placeholder="t('settings.merchant_pid_placeholder')" /></label>
                  <label><span>{{ t('settings.merchant_key') }}</span><input type="password" v-model="pmModal.form.config.key" :placeholder="t('settings.merchant_key_placeholder')" @input="onConfigInput('key')" /></label>
                </div>
                <label class="full"><span>{{ t('settings.api_url') }}</span><input v-model="pmModal.form.config.apiUrl" :placeholder="t('settings.api_url_yi_placeholder')" /></label>
              </template>
              <template v-else>
                <p class="field-hint">{{ t('settings.payment_method_adapter_tip') }}</p>
              </template>
            </div>

            <p v-if="pmModal.error" class="form-error">{{ pmModal.error }}</p>
          </form>
          <footer class="modal-foot">
            <button type="button" class="btn-ghost" @click="closePaymentMethodModal">{{ t('orders.cancel') }}</button>
            <button type="button" class="btn-primary" :disabled="pmModal.submitting" @click="onSavePaymentMethod">
              <span v-if="pmModal.submitting" class="spinner" aria-hidden="true" />
              <span>{{ pmModal.submitting ? t('orders.submitting') : t('common.save') }}</span>
            </button>
          </footer>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '../../composables/useToast.js';
import { useConfirm } from '../../composables/useConfirm.js';
import {
  getSettings, updateSettings, testEmail,
  listPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod,
  getPaymentAdapters,
} from '../../api/admin.js';

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const origin = window.location.origin;

const form = reactive({
  'site.name': '', 'site.description': '', 'site.announcement': '',
  'mail.driver': 'smtp', 'mail.smtp_host': '', 'mail.smtp_port': '465',
  'mail.smtp_secure': 'ssl', 'mail.from_addr': '', 'mail.smtp_pass': '',
  'mail.from_name': t('admin.logo_text'),
  // Resend
  'mail.resend_api_key': '',
  // 阿里云邮件推送
  'mail.aliyun_access_key_id': '',
  'mail.aliyun_access_key_secret': '',
  'mail.aliyun_region': 'cn-hangzhou',
  // 腾讯云 SES
  'mail.tencent_secret_id': '',
  'mail.tencent_secret_key': '',
  'mail.tencent_region': 'ap-guangzhou',
});

// 订单设置（参考独角数卡）
const orderForm = reactive({
  'order.search_pwd_enabled': '0',
  'order.manage_email': '',
});
// 记录后端返回的脱敏字段（对 payment_method 配置使用 pmModal.maskedConfigKeys）

const paymentMethods = ref([]);
const supportedAdapters = ref([]);
const testEmailAddr = ref('');
const testing = ref(false);
const saving = ref(false);

// 支付方式弹窗
const pmModal = reactive({
  open: false,
  editingId: '',
  submitting: false,
  error: '',
  errors: { name: '', adapter: '', method: '' },
  form: {
    name: '',
    adapter: '',
    method: '',
    sort: 0,
    enabled: true,
    config: {},
  },
  maskedConfigKeys: new Set(),
});

const ADAPTER_SECRET_KEYS = ['app_secret', 'key', 'token', 'secret', 'private_key'];
const MASK_PLACEHOLDER = '********';

// 适配器内部编码 → 用户可读标签（避免把 hupi/yi 这类内部代号直接暴露给管理员）
const ADAPTER_LABELS = {
  hupi: '虎皮椒',
  yi: '彩虹易支付',
};

function isMaskedValue(v) {
  return typeof v === 'string' && v.includes(MASK_PLACEHOLDER);
}

function adapterLabel(adapter) {
  return ADAPTER_LABELS[adapter] || adapter;
}

function methodIcon(method) {
  return method === 'alipay' ? '支'
    : method === 'wechat' ? '微'
    : '●';
}

function resetPmModal() {
  pmModal.editingId = '';
  pmModal.error = '';
  pmModal.errors = { name: '', adapter: '', method: '' };
  pmModal.form = { name: '', adapter: '', method: '', sort: 0, enabled: true, config: {} };
  pmModal.maskedConfigKeys = new Set();
}

function openPaymentMethodModal(pm = null) {
  resetPmModal();
  if (pm) {
    pmModal.editingId = pm.id;
    pmModal.form.name = pm.name || '';
    pmModal.form.adapter = pm.adapter || '';
    pmModal.form.method = pm.method || '';
    pmModal.form.sort = Number(pm.sort) || 0;
    pmModal.form.enabled = !!pm.enabled;
    pmModal.form.config = { ...(pm.config || {}) };
    // 记录脱敏字段
    pmModal.maskedConfigKeys = new Set();
    for (const k of ADAPTER_SECRET_KEYS) {
      if (isMaskedValue(pmModal.form.config[k])) pmModal.maskedConfigKeys.add(k);
    }
  }
  pmModal.open = true;
}

function closePaymentMethodModal() {
  pmModal.open = false;
}

function onConfigInput(key) {
  pmModal.maskedConfigKeys.delete(key);
}

function validatePmForm() {
  pmModal.errors = { name: '', adapter: '', method: '' };
  if (!String(pmModal.form.name).trim()) pmModal.errors.name = t('products.required');
  if (!pmModal.form.adapter) pmModal.errors.adapter = t('products.required');
  if (!pmModal.form.method) pmModal.errors.method = t('products.required');
  return !pmModal.errors.name && !pmModal.errors.adapter && !pmModal.errors.method;
}

function buildPmPayload() {
  const config = {};
  for (const [k, v] of Object.entries(pmModal.form.config)) {
    // 脱敏字段未修改则不提交原值
    if (pmModal.maskedConfigKeys.has(k)) continue;
    // 跳过空值字段，避免后端存储无意义的空字符串
    if (v === '' || v === null || v === undefined) continue;
    config[k] = v;
  }
  return {
    name: String(pmModal.form.name).trim(),
    adapter: pmModal.form.adapter,
    method: pmModal.form.method,
    sort: Number(pmModal.form.sort) || 0,
    enabled: !!pmModal.form.enabled,
    config,
  };
}

async function onSavePaymentMethod() {
  if (!validatePmForm()) return;
  pmModal.submitting = true;
  pmModal.error = '';
  try {
    const payload = buildPmPayload();
    if (pmModal.editingId) {
      await updatePaymentMethod(pmModal.editingId, payload);
      toast.success(t('settings.payment_method_toast_updated'));
    } else {
      await createPaymentMethod(payload);
      toast.success(t('settings.payment_method_toast_created'));
    }
    pmModal.open = false;
    await loadPaymentMethods();
  } catch (e) {
    pmModal.error = e?.message || t('settings.toast_save_failed', { msg: '' });
  } finally {
    pmModal.submitting = false;
  }
}

async function togglePaymentMethod(pm) {
  try {
    await updatePaymentMethod(pm.id, { enabled: !pm.enabled });
    toast.success(t('settings.saved'));
    await loadPaymentMethods();
  } catch (e) {
    toast.error(e?.message || t('settings.toast_save_failed', { msg: '' }));
  }
}

async function onDeletePaymentMethod(pm) {
  const ok = await confirm.open({
    title: t('common.delete'),
    message: t('settings.payment_method_delete_confirm', { name: pm.name }),
  });
  if (!ok) return;
  try {
    await deletePaymentMethod(pm.id);
    toast.success(t('settings.payment_method_toast_deleted'));
    await loadPaymentMethods();
  } catch (e) {
    toast.error(e?.message || t('common.failed'));
  }
}

async function loadPaymentMethods() {
  try {
    const [data, adaptersData] = await Promise.all([
      listPaymentMethods(),
      getPaymentAdapters().catch(() => ({ adapters: [] })),
    ]);
    paymentMethods.value = Array.isArray(data) ? data : [];
    supportedAdapters.value = Array.isArray(adaptersData?.adapters)
      ? adaptersData.adapters
      : [];
  } catch { /* ignore */ }
}

async function loadSettings() {
  try {
    const data = await getSettings();
    Object.assign(form, data);
    Object.assign(orderForm, {
      'order.search_pwd_enabled': data['order.search_pwd_enabled'] || '0',
      'order.manage_email': data['order.manage_email'] || '',
    });
  } catch { /* ignore */ }

  await loadPaymentMethods();
}

async function saveAll() {
  saving.value = true;
  try {
    const body = {};
    for (const k of ['site.name', 'site.description', 'site.announcement',
      'mail.driver', 'mail.smtp_host', 'mail.smtp_port', 'mail.smtp_secure',
      'mail.from_addr', 'mail.smtp_pass', 'mail.from_name',
      'mail.resend_api_key',
      'mail.aliyun_access_key_id', 'mail.aliyun_access_key_secret', 'mail.aliyun_region',
      'mail.tencent_secret_id', 'mail.tencent_secret_key', 'mail.tencent_region']) {
      body[k] = form[k];
    }
    // 订单设置字段
    body['order.search_pwd_enabled'] = orderForm['order.search_pwd_enabled'];
    body['order.manage_email'] = orderForm['order.manage_email'];
    await updateSettings(body);
    toast.success(t('settings.saved'));
    // 重新加载以获取最新脱敏值
    await loadSettings();
  } catch (e) {
    toast.error(t('settings.toast_save_failed', { msg: e.message }));
  } finally {
    saving.value = false;
  }
}

async function sendTest() {
  if (!testEmailAddr.value) { toast.error(t('settings.err_test_email')); return; }
  testing.value = true;
  try {
    await testEmail(testEmailAddr.value);
    toast.success(t('settings.toast_test_sent'));
  } catch (e) {
    toast.error(e.message || t('settings.toast_send_failed'));
  } finally {
    testing.value = false;
  }
}

onMounted(loadSettings);
</script>

<style scoped>
/* ====== Settings 特有样式（基础类继承自全局 admin.css） ====== */
.settings-page { max-width: 720px; margin: 0 auto; padding: 24px; }
.settings-section { margin-bottom: 32px; }
.settings-section h3 { font-size: 15px; font-weight: 600; color: var(--color-brand-dim); margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--color-border); }
.hint { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-grid label.full { grid-column: 1 / -1; }
.form-grid label { display: flex; flex-direction: column; gap: 4px; }
.form-grid label span { font-size: 13px; color: var(--color-text-secondary); font-weight: 500; }
.form-grid input, .form-grid select, .form-grid textarea {
  padding: 8px 12px; border: 1px solid var(--color-border-muted); border-radius: 8px; font-size: 14px;
  font-family: inherit; outline: none; transition: border-color .15s;
}
.form-grid input:focus, .form-grid select:focus, .form-grid textarea:focus { border-color: var(--color-text); }

.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--color-border); }
.section-head h3 { margin: 0; padding: 0; border: none; }

.empty-state { text-align: center; padding: 32px 20px; color: var(--color-text-secondary); }
.empty-state p { margin: 0 0 6px; font-size: 14px; }
.empty-state small { font-size: 12px; color: var(--color-text-tertiary); }

.payment-list { display: flex; flex-direction: column; gap: 12px; }
.payment-card { border: 1px solid var(--color-border); border-radius: 12px; padding: 16px; }
.payment-header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.payment-header strong { font-size: 15px; font-weight: 600; }
.payment-header .grow { flex: 1; }
.pm-icon {
  width: 32px; height: 32px; border-radius: 8px;
  display: grid; place-items: center;
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
  font-size: 13px; font-weight: 700;
}
.pm-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pm-subtitle { font-size: 12px; color: var(--color-text-tertiary); }
.badge { font-size: 12px; padding: 2px 8px; border-radius: 999px; }
.badge.on { background: var(--color-success-bg); color: var(--color-success); }
.badge.off { color: var(--color-text-tertiary); }
.method-pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--color-border-light); color: var(--color-text-secondary); }
.payment-meta { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--color-text-secondary); }
.payment-meta .meta-item { display: flex; flex-direction: column; gap: 4px; }
.payment-meta .meta-label { font-size: 11px; color: var(--color-text-tertiary); }
.payment-meta code { font-family: 'SF Mono', Monaco, monospace; padding: 2px 6px; background: var(--color-bg-hover); border-radius: 4px; }
.callback-url-sm { word-break: break-all; }

.test-email-row { display: flex; gap: 8px; }
.test-email-row input { flex: 1; padding: 8px 12px; border: 1px solid var(--color-border-muted); border-radius: 8px; font-size: 14px; }

/* 订单设置：开关行（参考独角数卡） */
.switch-row { gap: 8px; }
.switch-row .hint { margin: 0; font-size: 12px; color: var(--color-text-tertiary); }
.inline-switch { display: inline-flex; align-items: center; gap: 8px; width: auto; flex-shrink: 0; }
.inline-switch .switch-text { font-size: 13px; color: var(--color-text-secondary); }

.actions { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--color-border); }

/* 弹窗内字段间距 */
.modal .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.modal .field label { font-size: 13px; color: var(--color-text-secondary); font-weight: 500; }
.modal .field input, .modal .field select {
  padding: 8px 12px; border: 1px solid var(--color-border-muted); border-radius: 8px; font-size: 14px;
  font-family: inherit; outline: none; transition: border-color .15s; background: var(--color-bg-page); color: var(--color-text);
}
.modal .field input:focus, .modal .field select:focus { border-color: var(--color-text); }
.modal .field.is-error input, .modal .field.is-error select { border-color: var(--color-danger); }
.field-hint { font-size: 12px; color: var(--color-text-tertiary); margin: 2px 0 0; }
.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-grid-2 .field { margin-bottom: 0; }
.field-group { margin: 16px 0; padding: 16px; background: var(--color-bg-hover); border-radius: 10px; }
.field-group h4 { margin: 0 0 14px; font-size: 13px; font-weight: 600; color: var(--color-text); }
.field-group label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--color-text-secondary); }
.field-group input { padding: 8px 12px; border: 1px solid var(--color-border-muted); border-radius: 8px; font-size: 14px; font-family: inherit; }
.field-group .form-grid-2 { margin-bottom: 12px; }
.field-group .full { grid-column: 1 / -1; }
.switch-row-inline { display: flex; align-items: center; min-height: 36px; }

@media (max-width: 600px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-grid-2 { grid-template-columns: 1fr; }
  .payment-header .grow { display: none; }
}
</style>
