<template>
  <div class="shop-page">
    <!-- 面包屑 -->
    <div class="shop-breadcrumb">
      <div class="shop-breadcrumb-inner">
        <a class="bc-link" @click="goHome">{{ $t('shop.breadcrumb_home') }}</a>
        <span class="bc-sep">/</span>
        <a v-if="category" class="bc-link" @click="goHome">{{ category.name }}</a>
        <span v-if="category" class="bc-sep">/</span>
        <span class="bc-current">{{ product?.name || $t('shop.product_detail') }}</span>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="shop-state-block -full">
      <div class="shop-spinner" aria-hidden="true" />
      <p>{{ $t('common.loading') }}</p>
    </div>

    <!-- 商品不存在 -->
    <div v-else-if="!product" class="shop-state-block -full">
      <p class="empty-desc">{{ $t('shop.product_not_found') }}</p>
      <button class="shop-btn -sm" @click="goHome">{{ $t('shop.back_to_home') }}</button>
    </div>

    <!-- 商品详情 -->
    <template v-else>
      <section class="detail-main">
        <div class="detail-inner">
          <!-- 左：图片 -->
          <div class="detail-image">
            <div v-if="pImg(product.image)" class="img-real" :style="{ backgroundImage: `url(${pImg(product.image)})` }" />
            <div v-else class="img-placeholder">
              <span class="img-letter">{{ (product.name || '?').slice(0, 1) }}</span>
            </div>
          </div>

          <!-- 右：信息 -->
          <div class="detail-info">
            <div v-if="category" class="detail-cat">
              <span class="cat-tag">{{ category.name }}</span>
            </div>

            <h1 class="detail-name">{{ product.name }}</h1>

            <div v-if="product.desc" class="detail-desc-box">
              <p class="detail-desc">{{ product.desc }}</p>
            </div>

            <!-- 规格选择 + 库存 -->
            <div v-if="onSaleSpecs.length" class="spec-section">
              <div class="spec-label">{{ $t('shop.select_spec') }}</div>
              <div class="spec-list">
                <button
                  v-for="s in onSaleSpecs"
                  :key="s.id"
                  class="shop-chip"
                  :class="{ active: selectedSpecId === s.id, disabled: !isUnlimitedStock(stockOfSpec(s.id)) && stockOfSpec(s.id) === 0 }"
                  :disabled="!isUnlimitedStock(stockOfSpec(s.id)) && stockOfSpec(s.id) === 0"
                  @click="selectedSpecId = s.id"
                >
                  <span class="spec-chip-check" aria-hidden="true">
                    <svg viewBox="0 0 12 12" width="10" height="10" fill="none"><path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </span>
                  <span class="spec-chip-name">{{ s.name }}</span>
                  <span class="spec-chip-meta">¥{{ Number(s.price).toFixed(2) }} · {{ isUnlimitedStock(stockOfSpec(s.id)) ? $t('shop.in_stock') : (stockOfSpec(s.id) === 0 ? $t('shop.sold_out') : $t('shop.stock_with_count', { count: stockOfSpec(s.id) })) }}</span>
                </button>
              </div>
            </div>

            <!-- 购买数量 -->
            <div class="qty-section">
              <span class="qty-label">{{ $t('shop.purchase_quantity') }}</span>
              <div class="shop-qty">
                <button class="shop-qty-btn" :disabled="qty <= 1" @click="qty = Math.max(1, qty - 1)"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
                <span class="shop-qty-val">{{ qty }}</span>
                <button class="shop-qty-btn" :disabled="qty >= (isManualProduct || isUnlimitedStock(currentStock) ? MAX_QTY : currentStock)" @click="qty = Math.min((isManualProduct || isUnlimitedStock(currentStock) ? MAX_QTY : currentStock), qty + 1)"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
              </div>
            </div>

            <!-- 联系方式 -->
            <div class="contact-section">
              <label class="contact-label">{{ $t('shop.contact') }}</label>
              <input v-model="contact" class="shop-input" :placeholder="$t('shop.contact_placeholder')" />
              <p class="contact-hint">{{ $t('shop.contact_hint') }}</p>
            </div>

            <!-- 邮箱 -->
            <div class="contact-section">
              <label class="contact-label">
                {{ $t('shop.email_label') }}
                <span class="field-optional">{{ $t('shop.optional') }}</span>
              </label>
              <input v-model="email" class="shop-input" type="email" :placeholder="$t('shop.email_placeholder')" />
              <p class="contact-hint">{{ $t('shop.email_hint') }}</p>
            </div>

            <!-- 合计 + 购买 -->
            <div class="buy-section">
              <div class="total-row">
                <span>{{ $t('shop.total') }}</span>
                <span class="total-price"><small>¥</small>{{ totalAmount }}</span>
              </div>
              <div class="buy-actions">
                <button class="shop-btn-outline" @click="shareProduct" :title="$t('shop.share_title')">
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="14" cy="5" r="3"/><circle cx="6" cy="10" r="3"/><circle cx="14" cy="15" r="3"/><path d="M8.7 11.4l3.6 2.2M8.7 8.6l3.6-2.2"/></svg>
                  {{ $t('shop.share') }}
                </button>
                <button class="shop-btn -accent" :disabled="!canBuy" @click="goConfirm">
                  {{ currentStock <= 0 ? $t('shop.sold_out_btn') : $t('shop.buy_now') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 商品详细介绍 -->
      <section v-if="product.content" class="detail-content">
        <div class="content-inner">
          <h2 class="content-title">{{ $t('shop.product_description') }}</h2>
          <div class="content-body" v-html="safeContent" />
        </div>
      </section>
    </template>

    <!-- 移动端底部固定购买栏 -->
    <div v-if="product && !loading" class="mobile-buy-bar">
      <div class="mb-price"><small>¥</small>{{ totalAmount }}</div>
      <button class="mb-btn" :disabled="!canBuy" @click="goConfirm">
        {{ currentStock <= 0 ? $t('shop.sold_out_btn') : $t('shop.buy_now') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import DOMPurify from 'dompurify';
import { useToast } from '../../composables/useToast.js';
import { fetchProductById, fetchCategories, fetchStock } from '../../api/shop.js';
import { resolveImageUrl } from '../../utils/media.js';

const route = useRoute();
const router = useRouter();
const navigate = inject('navigate', () => {});
const toast = useToast();
const { t } = useI18n();

const loading = ref(true);
const product = ref(null);
const category = ref(null);
const stockMap = ref({}); // { [specId]: count }
const selectedSpecId = ref('');
const qty = ref(1);
const contact = ref('');
const email = ref('');

function pImg(imgRef) { return resolveImageUrl(imgRef); }

// 商品详情 HTML 净化（防止存储型 XSS）
const safeContent = computed(() => {
  if (!product.value?.content) return '';
  return DOMPurify.sanitize(product.value.content, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'img', 'span', 'div', 'blockquote', 'code', 'pre', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel', 'width', 'height'],
  });
});

const onSaleSpecs = computed(() => {
  return (product.value?.cardSpecs || []).filter(s => s.status !== 'off');
});

const MAX_QTY = 50;

const selectedSpec = computed(() => {
  if (!selectedSpecId.value) return null;
  return onSaleSpecs.value.find(s => s.id === selectedSpecId.value) || null;
});

const isManualProduct = computed(() => product.value?.type === 'manual');

function isUnlimitedStock(count) {
  return count === -1;
}

const currentStock = computed(() => {
  if (!selectedSpecId.value || !product.value) return 0;
  return stockMap.value[selectedSpecId.value] || 0;
});

function stockOfSpec(specId) {
  if (!specId || !product.value) return 0;
  return stockMap.value[specId] || 0;
}

const totalAmount = computed(() => {
  const price = selectedSpec.value ? Number(selectedSpec.value.price) : 0;
  return (price * qty.value).toFixed(2);
});

const canBuy = computed(() => {
  if (!product.value || onSaleSpecs.value.length === 0 || !selectedSpecId.value || !contact.value.trim()) return false;
  if (qty.value <= 0) return false;
  // manual 类型商品或无限库存不校验卡密库存
  if (isManualProduct.value || isUnlimitedStock(currentStock.value)) {
    return qty.value <= MAX_QTY;
  }
  return currentStock.value > 0 && qty.value <= currentStock.value;
});

function goHome() { navigate('home'); }

function goConfirm() {
  if (!canBuy.value) return;
  router.push({
    name: 'querendingdan',
    query: {
      productId: product.value.id,
      specId: selectedSpecId.value,
      qty: qty.value,
      contact: contact.value.trim(),
      email: email.value.trim(),
    },
  });
}

async function load() {
  loading.value = true;
  try {
    const id = route.params.id;
    // 用单商品 API 直接获取，不再拉全部商品
    const p = await fetchProductById(id);
    if (!p || p.status === 'off') {
      product.value = null;
      return;
    }
    product.value = p;
    // 加载分类
    const cats = await fetchCategories();
    category.value = cats.find(c => c.id === p.categoryId) || null;
    // 加载每个规格的库存
    const specs = (p.cardSpecs || []).filter(s => s.status !== 'off');
    const stockPromises = specs.map(s => fetchStock(p.id, s.id).then(count => ({ specId: s.id, count })).catch(() => ({ specId: s.id, count: 0 })));
    const stockResults = await Promise.all(stockPromises);
    const map = {};
    for (const r of stockResults) { map[r.specId] = r.count; }
    stockMap.value = map;
    // 默认选中第一个有库存或在售规格（manual 类型视为无限库存）
    const availableSpec = specs.find(s => isUnlimitedStock(map[s.id]) || (map[s.id] || 0) > 0);
    if (availableSpec) {
      selectedSpecId.value = availableSpec.id;
    } else if (specs.length) {
      selectedSpecId.value = specs[0].id;
    }
  } catch (error) {
    console.error('加载商品失败:', error);
    toast.error(t('shop.load_product_failed'));
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
  document.title = t('shop.loading_title');
});
// 商品加载完成后更新标题
watch(product, (p) => {
  if (p) document.title = t('shop.product_title_template', { name: p.name });
});

// 分享
function shareProduct() {
  const url = location.href;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => toast.success(t('shop.link_copied')));
  } else {
    // 降级方案
    const ta = document.createElement('textarea');
    ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast.success(t('shop.link_copied'));
  }
}

// 切换规格时自动限制数量（无限库存不限制）
watch(currentStock, (val) => {
  if (!isUnlimitedStock(val) && qty.value > val) qty.value = Math.max(1, val);
});
</script>

<style scoped>
/* ====== 仅保留页面特有样式 ====== */

/* 详情主体 */
.detail-main { padding: 48px 0; }
.detail-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; display: grid; grid-template-columns: 420px 1fr; gap: 48px; align-items: start; }

/* 图片 */
.detail-image {
  width: 100%;
  aspect-ratio: 1/1;
  overflow: hidden;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.img-real { width: 100%; height: 100%; background-size: cover; background-position: center; }
.img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--color-bg-surface); }
.img-letter { font-size: 56px; font-weight: 700; color: var(--color-text-tertiary); opacity: 0.35; user-select: none; }

/* 信息区 */
.detail-info { min-width: 0; }
.detail-cat { margin-bottom: 12px; }
.cat-tag { display: inline-block; padding: 3px 10px; border-radius: var(--radius-sm); background: var(--color-bg-hover); border: 1px solid var(--color-border); color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
.detail-name { font-size: 24px; font-weight: 700; color: var(--color-text); margin: 0 0 16px; letter-spacing: -0.02em; line-height: 1.25; }
.detail-desc-box { padding: 14px 16px; background: var(--color-bg-surface); border-left: 3px solid var(--color-text); border-radius: 0 var(--radius-md) var(--radius-md) 0; margin-bottom: 24px; border-top: 1px solid var(--color-border-light); border-right: 1px solid var(--color-border-light); border-bottom: 1px solid var(--color-border-light); }
.detail-desc { font-size: 13.5px; color: var(--color-text-secondary); line-height: 1.6; margin: 0; }

/* 空状态 */
.empty-desc { font-size: 14px; }

/* 规格选择特有 */
.spec-section { margin-bottom: 24px; }
.spec-label { font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 12px; }
.spec-list { display: flex; flex-wrap: wrap; gap: 10px; }
.spec-chip-check { width: 16px; height: 16px; border-radius: 50%; background: var(--color-border); color: transparent; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .2s var(--ease-out); }
.shop-chip.active .spec-chip-check { background: var(--color-bg-page); color: var(--color-text); }
.spec-chip-name { font-size: 13px; font-weight: 600; white-space: nowrap; }
.spec-chip-meta { font-size: 11px; opacity: 0.75; white-space: nowrap; }
.shop-chip.active .spec-chip-name,
.shop-chip.active .spec-chip-meta { opacity: 1; }

/* 数量 */
.qty-section { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.qty-label { font-size: 13px; font-weight: 600; color: var(--color-text); }

/* 联系方式 */
.contact-section { margin-bottom: 24px; }
.contact-label { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 8px; }
.contact-hint { font-size: 12px; color: var(--color-text-tertiary); margin: 6px 0 0; }
.field-optional { font-size: 11px; font-weight: 400; color: var(--color-text-tertiary); margin-left: 6px; }

/* 购买区 */
.buy-section { display: flex; align-items: center; gap: 24px; padding-top: 20px; border-top: 1px solid var(--color-border); }
.buy-actions { display: flex; gap: 10px; flex: 1; justify-content: flex-end; }
.total-row { display: flex; align-items: baseline; gap: 6px; font-size: 13px; color: var(--color-text-secondary); }
.total-price { font-size: 20px; font-weight: 700; color: var(--color-accent); }
.total-price small { font-size: 13px; font-weight: 500; margin-right: 1px; }

/* 详情内容 */
.detail-content { padding: 48px 0 64px; border-top: 1px solid var(--color-border); }
.content-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.content-title { font-size: 18px; font-weight: 600; color: var(--color-text); margin: 0 0 24px; }
.content-body { font-size: 13.5px; color: var(--color-text-secondary); line-height: 1.8; max-width: 800px; }
.content-body :deep(img) { max-width: 100%; border-radius: var(--radius-md); margin: 12px 0; border: 1px solid var(--color-border-light); }
.content-body :deep(a) { color: var(--color-accent); text-decoration: underline; }

/* 移动端底部固定栏 */
.mobile-buy-bar { display: none; }

@media (max-width: 900px) {
  .detail-inner { grid-template-columns: 1fr; gap: 32px; }
  .detail-image { max-width: 400px; }
}
@media (max-width: 720px) {
  .detail-main { padding: 24px 0; }
  .detail-inner { padding: 0 16px; gap: 24px; }
  .detail-name { font-size: 20px; }
  .buy-section { flex-direction: column; align-items: stretch; gap: 16px; }
  .buy-actions { display: flex; gap: 10px; width: 100%; }
  .shop-btn-outline { flex: 1; padding: 0 16px; }
  .shop-btn.-accent { flex: 2; }
  .spec-list { gap: 8px; }
  .shop-chip { height: auto; min-height: 38px; padding: 8px 14px; flex-wrap: wrap; border-radius: var(--radius-md); }
  .spec-chip-meta { width: 100%; margin-left: 24px; margin-top: 2px; }

  .mobile-buy-bar {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: var(--z-sticky);
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px; background: var(--color-bg-page);
    border-top: 1px solid var(--color-border);
    box-shadow: var(--shadow-lg);
  }
  .mb-price { font-size: 16px; font-weight: 700; color: var(--color-accent); }
  .mb-price small { font-size: 12px; font-weight: 500; }
  .mb-btn {
    height: 38px; padding: 0 24px; border-radius: var(--radius-md);
    background: var(--color-brand);
    color: var(--color-text-inverse); border: none;
    font-size: 13px; font-weight: 600; cursor: pointer;
    transition: all .2s var(--ease-out); font-family: inherit;
  }
  .mb-btn:hover:not(:disabled) { background: var(--color-brand-hover); box-shadow: var(--shadow-sm); }
  .mb-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .shop-page { padding-bottom: 64px; }
}
</style>
