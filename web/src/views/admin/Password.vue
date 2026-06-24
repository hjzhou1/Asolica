<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">{{ t('password.title') }}</h1>
        <p class="page-subtitle">{{ t('password.subtitle') }}</p>
      </div>
    </header>

    <div class="pwd-card">
      <form class="pwd-form" @submit.prevent="onSubmit" novalidate>
        <div class="field" :class="{ 'is-error': errors.oldPwd }">
          <label for="oldPwd">
            {{ t('password.old_password') }}
            <span class="field-tip">{{ t('password.old_password_tip') }}</span>
          </label>
          <input id="oldPwd" v-model="form.oldPwd" type="password" :placeholder="t('password.old_password_placeholder')" autocomplete="current-password" :disabled="loading" @input="clearErr('oldPwd')" />
          <p v-if="errors.oldPwd" class="field-error">{{ errors.oldPwd }}</p>
        </div>

        <div class="field" :class="{ 'is-error': errors.newPwd }">
          <label for="newPwd">
            {{ t('password.new_password') }}
            <span class="field-tip">{{ t('password.new_password_tip') }}</span>
          </label>
          <input id="newPwd" v-model="form.newPwd" type="password" :placeholder="t('password.new_password_placeholder')" autocomplete="new-password" :disabled="loading" @input="clearErr('newPwd')" />
          <p v-if="errors.newPwd" class="field-error">{{ errors.newPwd }}</p>
        </div>

        <div class="field" :class="{ 'is-error': errors.confirmPwd }">
          <label for="confirmPwd">
            {{ t('password.confirm_password') }}
            <span class="field-tip">{{ t('password.confirm_password_tip') }}</span>
          </label>
          <input id="confirmPwd" v-model="form.confirmPwd" type="password" :placeholder="t('password.confirm_password_placeholder')" autocomplete="new-password" :disabled="loading" @input="clearErr('confirmPwd')" />
          <p v-if="errors.confirmPwd" class="field-error">{{ errors.confirmPwd }}</p>
        </div>

        <p v-if="formError" class="form-error">{{ formError }}</p>
        <p v-if="formOk" class="form-ok">{{ formOk }}</p>

        <div class="actions">
          <button type="submit" class="btn-primary" :disabled="loading">
            <span v-if="loading" class="spinner" aria-hidden="true" />
            <span>{{ loading ? t('password.submitting') : t('password.submit') }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { changePassword } from '../../api/admin.js';

const { t } = useI18n();

const form = reactive({ oldPwd: '', newPwd: '', confirmPwd: '' });
const errors = reactive({ oldPwd: '', newPwd: '', confirmPwd: '' });
const formError = ref('');
const formOk = ref('');
const loading = ref(false);

function clearErr(key) {
  if (errors[key]) errors[key] = '';
  if (formError.value) formError.value = '';
  if (formOk.value) formOk.value = '';
}

function validate() {
  let ok = true;
  errors.oldPwd = errors.newPwd = errors.confirmPwd = '';
  if (!form.oldPwd) { errors.oldPwd = t('password.err_old_pwd'); ok = false; }
  if (!form.newPwd) { errors.newPwd = t('password.err_new_pwd'); ok = false; }
  else if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(form.newPwd)) { errors.newPwd = t('password.err_new_pwd_format'); ok = false; }
  else if (form.newPwd === form.oldPwd) { errors.newPwd = t('password.err_new_pwd_same'); ok = false; }
  if (!form.confirmPwd) { errors.confirmPwd = t('password.err_confirm_pwd'); ok = false; }
  else if (form.confirmPwd !== form.newPwd) { errors.confirmPwd = t('password.err_confirm_pwd_mismatch'); ok = false; }
  return ok;
}

async function onSubmit() {
  if (loading.value) return;
  if (!validate()) return;
  loading.value = true;
  formError.value = ''; formOk.value = '';
  try {
    await changePassword({ oldPwd: form.oldPwd, newPwd: form.newPwd });
    formOk.value = t('password.toast_updated');
    form.oldPwd = form.newPwd = form.confirmPwd = '';
  } catch (e) {
    formError.value = e?.message || t('password.toast_failed');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.page { max-width: 1200px; width: 100%; box-sizing: border-box; }
.page-head { margin-bottom: 24px; }
.page-title {
  font-size: 24px; font-weight: 700; color: var(--color-text);
  margin: 0 0 6px; letter-spacing: -0.02em;
}
.page-subtitle { font-size: 13px; color: var(--color-text-secondary); margin: 0; }

.pwd-card {
  max-width: 520px;
  background: var(--color-bg-page);
  border: 1px solid rgba(17, 24, 39, 0.06);
  border-radius: 16px;
  padding: 28px;
}
.pwd-form { display: flex; flex-direction: column; gap: 20px; }
.field { display: flex; flex-direction: column; gap: 8px; }
.field label {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px; font-size: 13px; font-weight: 500; color: var(--color-brand-dim);
}
.field-tip { font-size: 11px; font-weight: 400; color: var(--color-text-tertiary); }
.field input {
  width: 100%; height: 44px; padding: 0 14px; font-size: 14px; color: var(--color-text);
  background: var(--color-bg-page); border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 10px; outline: 0; transition: border-color .15s, box-shadow .15s;
  font-family: inherit;
}
.field input::placeholder { color: var(--color-text-tertiary); }
.field input:hover { border-color: rgba(17, 24, 39, 0.2); }
.field input:focus {
  border-color: var(--color-text);
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.06);
}
.field input:disabled { background: var(--color-bg-surface); color: var(--color-text-tertiary); cursor: not-allowed; }

.field.is-error input { border-color: var(--color-danger); }
.field.is-error input:focus { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12); }
.field-error { font-size: 12px; color: var(--color-danger); margin: 0; }

.form-error {
  font-size: 13px; color: var(--color-danger); background: var(--color-danger-bg);
  border: 1px solid var(--color-danger-bg); border-radius: 10px; padding: 10px 14px; margin: 0;
}
.form-ok {
  font-size: 13px; color: var(--color-success); background: var(--color-success-bg);
  border: 1px solid var(--color-success-bg); border-radius: 10px; padding: 10px 14px; margin: 0;
}

.actions { margin-top: 4px; }
.btn-primary {
  height: 44px; padding: 0 24px; background: var(--color-brand); color: var(--color-text-inverse);
  border: 0; border-radius: 10px; font-size: 14px; font-weight: 500;
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  gap: 8px; transition: background .15s, transform .15s, box-shadow .15s;
  font-family: inherit;
}
.btn-primary:hover:not(:disabled) {
  background: var(--color-brand); transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
.btn-primary:disabled { background: var(--color-border-muted); color: var(--color-text-inverse); cursor: not-allowed; transform: none; box-shadow: none; }

@media (max-width: 560px) { .pwd-card { padding: 20px; } }
</style>
