<template>
  <div class="page">
    <!-- 顶栏：极简，仅 Logo + 标题 -->
    <header class="nav">
      <div class="nav-dock">
        <a class="logo" href="#/">
          <BrandLogo size="sm" color="var(--color-brand)" />
          <span class="logo-text">{{ t('admin.logo_text') }}</span>
        </a>
      </div>
    </header>

    <!-- 登录主体 -->
    <section class="login-section">
      <div class="login-container">
        <h1 class="page-title">{{ t('admin.login') }}</h1>
        <p class="page-subtitle">{{ t('admin.login_subtitle') }}</p>

        <form class="login-form" @submit.prevent="onSubmit" novalidate>
          <div class="field" :class="{ 'is-error': errors.username }">
            <label for="username">{{ t('admin.username') }}</label>
            <input
              id="username" v-model="username" type="text"
              placeholder="admin" autocomplete="username"
              spellcheck="false" :disabled="loading"
              @input="clearErr('username')"
            />
            <p v-if="errors.username" class="field-error">{{ errors.username }}</p>
          </div>

          <div class="field" :class="{ 'is-error': errors.password }">
            <label for="password">{{ t('admin.password') }}</label>
            <div class="password-wrap">
              <input
                id="password" v-model="password"
                :type="showPwd ? 'text' : 'password'"
                :placeholder="t('admin.password_placeholder')" autocomplete="current-password"
                :disabled="loading" @input="clearErr('password')"
              />
              <button type="button" class="toggle-pwd" @click="showPwd = !showPwd"
                :aria-label="showPwd ? t('admin.hide_password') : t('admin.show_password')" tabindex="-1">
                <svg v-if="!showPwd" viewBox="0 0 20 20" fill="none"><path d="M2 10s2.5-5.5 8-5.5S18 10 18 10s-2.5 5.5-8 5.5S2 10 2 10Z" stroke="currentColor" stroke-width="1.4"/><circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.4"/></svg>
                <svg v-else viewBox="0 0 20 20" fill="none"><path d="M3 3l14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M6.5 6.5C3.5 8 2 10 2 10s2.5 5.5 8 5.5c1.7 0 3.2-.5 4.4-1.2M9 4.6c.3 0 .7-.1 1-.1 5.5 0 8 5.5 8 5.5s-.7 1.6-2.3 3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
              </button>
            </div>
            <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
          </div>

          <p v-if="formError" class="form-error">{{ formError }}</p>

          <button type="submit" class="login-btn" :disabled="loading">
            <span v-if="loading" class="spinner" aria-hidden="true" />
            <span>{{ loading ? t('admin.logging_in') : t('admin.login_btn') }}</span>
          </button>
        </form>
      </div>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { adminLogin } from '../../api/admin.js';
import { useAdmin } from '../../stores/admin.js';
import BrandLogo from '../../components/common/BrandLogo.vue';

const { t } = useI18n();
const router = useRouter();
const { setAuth } = useAdmin();

const username = ref('');
const password = ref('');
const showPwd = ref(false);
const loading = ref(false);
const formError = ref('');
const errors = reactive({ username: '', password: '' });

function clearErr(key) {
  if (errors[key]) errors[key] = '';
  if (formError.value) formError.value = '';
}

function validate() {
  let ok = true;
  errors.username = '';
  errors.password = '';
  if (!username.value.trim()) { errors.username = t('admin.err_username_required'); ok = false; }
  else if (username.value.trim().length < 2) { errors.username = t('admin.err_username_min'); ok = false; }
  if (!password.value) { errors.password = t('admin.err_password_required'); ok = false; }
  else if (password.value.length < 6) { errors.password = t('admin.err_password_min'); ok = false; }
  return ok;
}

async function onSubmit() {
  if (loading.value) return;
  if (!validate()) return;
  loading.value = true;
  formError.value = '';
  try {
    const { token, admin } = await adminLogin({ username: username.value.trim(), password: password.value });
    setAuth({ token, admin });
    router.push({ name: 'admin-home' });
  } catch (e) {
    formError.value = e?.message || t('admin.login_failed');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh; width: 100%; max-width: 100vw; box-sizing: border-box;
  background: var(--color-bg-page); color: var(--color-text);
  font-family: var(--font-sans);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.nav { position: fixed; top: 0; left: 0; right: 0; z-index: var(--z-sticky); background: rgba(255,255,255,0.72); backdrop-filter: saturate(180%) blur(20px); border-bottom: 1px solid rgba(17,24,39,0.06); }
.nav-dock { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; height: 60px; padding: 0 var(--space-xl); }
.logo { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--color-text); }
.logo-text { font-size: 16px; font-weight: 600; letter-spacing: -0.02em; }

.login-section { flex: 1; display: flex; align-items: center; justify-content: center; padding: 80px 24px 40px; }
.login-container { width: 100%; max-width: 420px; }
.page-title { font-size: 28px; font-weight: 700; text-align: center; margin: 0 0 8px; letter-spacing: -0.02em; }
.page-subtitle { font-size: 14px; color: var(--color-text-secondary); text-align: center; margin: 0 0 32px; }
.login-form { display: flex; flex-direction: column; gap: 20px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 13px; font-weight: 500; color: var(--color-text-secondary); }
.field input { width: 100%; height: 48px; padding: 0 16px; font-size: 15px; color: var(--color-text); background: var(--color-bg-page); border: 1px solid rgba(17,24,39,0.12); border-radius: 12px; outline: 0; transition: border-color .15s, box-shadow .15s; font-family: inherit; box-sizing: border-box; }
.field input::placeholder { color: var(--color-text-tertiary); }
.field input:focus { border-color: var(--color-brand); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
.field input:disabled { opacity: .5; cursor: not-allowed; }
.field.is-error input { border-color: var(--color-danger); }
.field-error { font-size: 12px; color: var(--color-danger); margin: 0; }
.password-wrap { position: relative; }
.password-wrap input { padding-right: 48px; }
.toggle-pwd { position: absolute; top: 50%; right: 8px; transform: translateY(-50%); width: 36px; height: 36px; display: grid; place-items: center; background: transparent; border: 0; color: var(--color-text-tertiary); border-radius: 8px; cursor: pointer; }
.toggle-pwd:hover { color: var(--color-text); }
.toggle-pwd svg { width: 18px; height: 18px; }
.form-error { font-size: 13px; color: var(--color-danger); background: var(--color-danger-bg); border: 1px solid var(--color-danger-bg); border-radius: 10px; padding: 10px 14px; margin: 0; }
.login-btn { height: 48px; background: var(--color-brand); color: var(--color-text-inverse); border: 0; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: background .15s, transform .15s; font-family: inherit; }
.login-btn:hover:not(:disabled) { background: var(--color-brand-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
.login-btn:disabled { opacity: .5; cursor: not-allowed; }
</style>
