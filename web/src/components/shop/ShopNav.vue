<template>
  <header class="shop-nav">
    <div class="shop-nav-dock">
      <a class="shop-logo" href="#/" @click.prevent="$router.push('/')">
        <BrandLogo size="sm" color="var(--color-brand)" />
        <span class="shop-logo-text">{{ siteName }}</span>
      </a>
      <nav class="shop-nav-links">
        <a
          v-for="item in items"
          :key="item.key"
          class="shop-nav-link"
          :class="{ 'is-active': activeKey === item.key }"
          @click="item.action"
        >{{ item.label }}</a>
      </nav>
      <div class="nav-tools">
        <LocaleToggle />
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, inject, ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BrandLogo from '../common/BrandLogo.vue';
import LocaleToggle from '../common/LocaleToggle.vue';
import { fetchSiteInfo } from '../../api/shop.js';

const { t } = useI18n();
const props = defineProps({
  active: { type: String, default: '' },
});

const route = useRoute();
const navigate = inject('navigate', () => {});

const siteName = ref('Asolica');
onMounted(async () => {
  try {
    const info = await fetchSiteInfo();
    if (info?.name) siteName.value = info.name;
  } catch { /* 保持默认 */ }
});

const activeKey = computed(() => props.active || route.name || '');

const items = computed(() => [
  { key: 'home', label: t('nav.home'), action: () => navigate('home') },
  { key: 'dingdanchaxun', label: t('nav.order_query'), action: () => navigate('dingdanchaxun') },
]);
</script>

<style scoped>
.shop-nav {
  position: sticky; top: 0; z-index: var(--z-sticky);
  background: var(--color-bg-glass);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-bottom: 1px solid var(--color-border);
  transition: all .25s var(--ease-smooth);
}
.shop-nav.scrolled { box-shadow: var(--shadow-sm); }
.shop-nav-dock {
  max-width: 1200px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  height: 56px; padding: 0 24px;
}
.nav-tools { display: flex; align-items: center; gap: 8px; }
.shop-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--color-text); transition: opacity .2s var(--ease-smooth); }
.shop-logo:hover { opacity: 0.8; }
.shop-logo-text { font-size: 15px; font-weight: 600; letter-spacing: -0.02em; }

.shop-nav-links { display: flex; gap: 4px; }
.shop-nav-link {
  padding: 6px 14px;
  border-radius: var(--radius-full);
  font-size: 13px; font-weight: 500; color: var(--color-text-secondary);
  cursor: pointer; transition: all .2s var(--ease-smooth); user-select: none;
  background: none; border: none; font-family: inherit;
  position: relative;
}
.shop-nav-link:hover { color: var(--color-text); background: rgba(15, 15, 19, 0.04); }
.shop-nav-link.is-active { color: var(--color-text); background: rgba(15, 15, 19, 0.07); font-weight: 600; }

@media (max-width: 720px) {
  .shop-nav-dock { padding: 0 16px; }
  .shop-logo-text { display: none; }
}
@media (max-width: 480px) {
  .shop-nav-dock { padding: 0 12px; }
}
</style>
