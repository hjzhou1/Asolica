<template>
  <footer class="shop-footer">
    <div class="shop-footer-inner">
      <div class="shop-footer-grid">
        <div class="shop-footer-col shop-footer-brand-col">
          <div class="shop-footer-brand">
            <BrandLogo size="sm" color="var(--color-text)" />
            <span class="shop-footer-brand-name">Asolica</span>
          </div>
          <p class="shop-footer-desc">{{ $t('app.subtitle') }}</p>
        </div>
        <div class="shop-footer-col">
          <div class="shop-footer-contact">
            <span>hi@asuolika.com</span>
            <span>Telegram @asuolika</span>
          </div>
        </div>
      </div>
      <div class="shop-footer-bottom">
        <span>&copy; {{ year }} Asolica &middot; 数字商品自动发卡平台</span>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue';
import BrandLogo from '../common/BrandLogo.vue';

const year = computed(() => new Date().getFullYear());
</script>

<style scoped>
.shop-footer {
  width: 100%;
  box-sizing: border-box;
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  border-top: 1px solid var(--color-border);
  margin-top: auto;
}
.shop-footer-inner {
  max-width: 1200px; margin: 0 auto;
  padding: 56px 24px 24px;
}
.shop-footer-grid {
  display: flex; justify-content: space-between; align-items: center;
  gap: var(--space-2xl); padding-bottom: var(--space-xl);
  border-bottom: 1px solid var(--color-border);
}
.shop-footer-col { min-width: 0; }
.shop-footer-brand { display: flex; align-items: center; gap: 8px; }
.shop-footer-brand-name { font-size: 14px; font-weight: 600; color: var(--color-text); letter-spacing: -0.01em; }
.shop-footer-desc { font-size: 12px; color: var(--color-text-tertiary); margin: 6px 0 0; }
.shop-footer-contact { display: flex; gap: var(--space-xl); font-size: 13px; color: var(--color-text-secondary); }
.shop-footer-bottom {
  padding-top: 20px; text-align: center; font-size: 12px; color: var(--color-text-tertiary);
}

@media (max-width: 720px) {
  .shop-footer-inner { padding: 40px 16px 20px; }
  .shop-footer-grid { flex-direction: column; align-items: flex-start; gap: var(--space-lg); padding-bottom: 20px; }
  .shop-footer-contact { flex-direction: column; gap: var(--space-sm); }
}
</style>
