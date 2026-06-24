<template>
  <div class="shop-page">
    <!-- 站点公告 -->
    <div v-if="announce" class="announce-bar">
      <span>{{ announce }}</span>
      <button class="announce-close" @click="announce=''" :aria-label="$t('common.close')">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </button>
    </div>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-content">
          <div class="hero-text">
            <div class="hero-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>
              <span>{{ $t('hero.badge') }}</span>
            </div>
            <h1 class="hero-title">{{ $t('hero.title', { br: '\n' }) }}</h1>
            <p class="hero-subtitle">{{ $t('hero.subtitle') }}</p>
            <div class="hero-actions">
              <button class="shop-btn" @click="scrollToProducts">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
                <span>{{ $t('hero.buy_now') }}</span>
              </button>
              <button class="shop-btn-outline" @click="router.push({ name: 'dingdanchaxun' })">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                <span>{{ $t('hero.query_order') }}</span>
              </button>
            </div>
            <div class="hero-stats">
              <div class="stat">
                <div class="stat-num">{{ displayedProducts }}+</div>
                <div class="stat-label">{{ $t('hero.products_count') }}</div>
              </div>
              <div class="stat-divider" />
              <div class="stat">
                <div class="stat-num">{{ displayedStock }}+</div>
                <div class="stat-label">{{ $t('hero.stock_count') }}</div>
              </div>
              <div class="stat-divider" />
              <div class="stat">
                <div class="stat-num">24h</div>
                <div class="stat-label">{{ $t('hero.auto_deliver') }}</div>
              </div>
            </div>
          </div>
          <div class="hero-visual" aria-hidden="true">
            <BrandLogo size="hero" color="var(--color-brand)" />
          </div>
        </div>
      </div>
    </section>

    <!-- 全部商品 -->
    <section id="products" class="shop-section">
      <div class="shop-inner">
        <div class="section-header">
          <h2 class="section-title">{{ $t('product.all') }}</h2>
          <div class="section-tools">
            <select v-model="sortBy" class="sort-select" @change="loadProducts">
              <option value="newest">{{ $t('product.sort.newest') }}</option>
              <option value="sales">{{ $t('product.sort.sales') }}</option>
              <option value="price_asc">{{ $t('product.sort.price_asc') }}</option>
              <option value="price_desc">{{ $t('product.sort.price_desc') }}</option>
              <option value="name">{{ $t('product.sort.name') }}</option>
            </select>
            <div v-if="visibleProducts.length > 0" class="search-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
              </svg>
              <input v-model="kw" :placeholder="$t('product.search_placeholder')" @input="onSearchInput" />
            </div>
          </div>
        </div>

        <!-- 分类胶囊导航 -->
        <div v-if="categoryTabs.length > 1" class="category-nav">
          <div class="category-tabs" ref="categoryTabsRef">
            <button
              v-for="cat in categoryTabs"
              :key="cat.id || 'all'"
              class="shop-chip"
              :class="{ active: activeCategory === (cat.id || 'all') }"
              @click="selectCategory(cat.id || 'all')"
            >
              <span v-if="cat.image && resolveImageUrl(cat.image)" class="chip-icon" :style="{ backgroundImage: `url(${resolveImageUrl(cat.image)})` }" />
              <span v-else-if="cat.id === 'all'" class="chip-icon chip-icon-all">
                <span class="breathing-dot"></span>
              </span>
              <span v-else class="chip-icon chip-icon-letter">{{ cat.name.slice(0, 1) }}</span>
              <span class="chip-label">{{ cat.name }}</span>
              <span v-if="cat.count !== undefined" class="chip-count">{{ cat.count }}</span>
            </button>
          </div>
        </div>

        <!-- 加载中 -->
        <div v-if="loading" class="products-grid">
          <div v-for="i in 8" :key="'sk-'+i" class="product-card skeleton-card">
            <div class="skeleton" style="aspect-ratio: 1/1; border-radius: 0;"></div>
            <div class="card-body">
              <div class="skeleton skeleton-text" style="width: 80%;"></div>
              <div class="skeleton skeleton-text" style="width: 40%; height: 12px;"></div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <EmptyState
          v-else-if="!filteredProducts.length"
          type="box"
          :title="activeCategory === 'all' ? $t('home.empty_title') : $t('home.empty_title_category')"
          :desc="kw.trim() ? $t('home.empty_desc_search', { kw }) : $t('product.empty')"
          :action-label="$t('home.clear_filter')"
          @action="clearFilters"
        />

        <!-- 商品网格 -->
        <div v-else class="products-grid">
          <div
            v-for="p in filteredProducts"
            :key="p.id"
            class="product-card"
            @click="goDetail(p.id)"
          >
            <div class="card-image" :style="pImg(p.image) ? { backgroundImage: `url(${pImg(p.image)})` } : null">
              <span v-if="!pImg(p.image)" class="card-letter">{{ (p.name || '?').slice(0,1) }}</span>
            </div>
            <div class="card-body">
              <h3 class="card-title">{{ p.name }}</h3>
              <div class="card-price-row">
                <span v-if="p.type !== 'manual' && p.stock !== -1 && p.stock <= 0" class="card-sold-out">{{ $t('shop.sold_out') }}</span>
                <span v-else class="card-view-detail">{{ $t('hero.buy_now') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import EmptyState from '../../components/common/EmptyState.vue';
import BrandLogo from '../../components/common/BrandLogo.vue';
import { fetchProducts, fetchCategories, getAnnouncement } from '../../api/shop.js';
import { resolveImageUrl } from '../../utils/media.js';

const router = useRouter();
const { t } = useI18n();

function goDetail(id) {
  router.push({ name: 'shangpinxiangqing', params: { id } });
}

function clearFilters() {
  kw.value = '';
  activeCategory.value = 'all';
}

const loading = ref(false);
const kw = ref('');
const sortBy = ref('newest');
const announce = ref('');
let searchTimer = null;
let rafId = null;
const products = ref([]);
const categories = ref([]);
const activeCategory = ref('all');
const categoryTabsRef = ref(null);

function pImg(ref) { return resolveImageUrl(ref); }

// 分类胶囊导航数据
const categoryTabs = computed(() => {
  const order = (a, b) => (a.sort ?? 0) - (b.sort ?? 0);
  const enabledCats = categories.value
    .filter(c => c.enabled !== false)
    .slice()
    .sort(order);

  const tabs = [
    { id: 'all', name: t('home.all'), count: visibleProducts.value.length },
    ...enabledCats.map(cat => ({
      ...cat,
      count: visibleProducts.value.filter(p => p.categoryId === cat.id).length,
    })),
  ];
  return tabs;
});

// 根据选中的分类筛选商品
const filteredProducts = computed(() => {
  let list = visibleProducts.value;
  if (activeCategory.value !== 'all') {
    list = list.filter(p => p.categoryId === activeCategory.value);
  }
  return list;
});

const visibleProducts = computed(() => {
  const k = kw.value.trim().toLowerCase();
  return products.value
    .filter(p => p.status !== 'off')
    .filter(p => {
      if (!k) return true;
      return (p.name || '').toLowerCase().includes(k)
        || (p.desc || '').toLowerCase().includes(k);
    });
});

const totalProducts = computed(() => visibleProducts.value.length);
const totalStock = computed(() => visibleProducts.value.reduce((sum, p) => sum + (p.type === 'manual' || p.stock === -1 ? 0 : (p.stock || 0)), 0));

function scrollToProducts() {
  const el = document.getElementById('products');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectCategory(categoryId) {
  activeCategory.value = categoryId;
}

// 数字滚动动画
const displayedProducts = ref(0);
const displayedStock = ref(0);
const animating = ref(false);
function animateNumbers() {
  if (animating.value) return;
  animating.value = true;
  const targetP = totalProducts.value;
  const targetS = totalStock.value;
  const duration = 1200;
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    displayedProducts.value = Math.round(targetP * ease);
    displayedStock.value = Math.round(targetS * ease);
    if (progress < 1) rafId = requestAnimationFrame(tick);
    else { rafId = null; displayedProducts.value = targetP; displayedStock.value = targetS; animating.value = false; }
  }
  rafId = requestAnimationFrame(tick);
}

onUnmounted(() => {
  if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; }
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
});

async function load() {
  loading.value = true;
  try {
    const [prods, cats] = await Promise.all([
      fetchProducts({ search: kw.value.trim() || undefined, sortBy: sortBy.value }),
      fetchCategories(),
    ]);
    products.value = Array.isArray(prods) ? prods : [];
    categories.value = Array.isArray(cats) ? cats : [];
  } catch (error) {
    console.error('加载数据失败:', error);
  } finally {
    loading.value = false;
  }
}

async function loadProducts() {
  try {
    const prods = await fetchProducts({ search: kw.value.trim() || undefined, sortBy: sortBy.value });
    products.value = Array.isArray(prods) ? prods : [];
  } catch { /* ignore */ }
}

function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadProducts, 300);
}

onMounted(() => {
  load().then(() => nextTick(() => setTimeout(animateNumbers, 300)));
  document.title = t('home.document_title');
  // 加载公告
  getAnnouncement().then(d => { announce.value = d?.value || ''; }).catch(() => {});
});
</script>

<style scoped>
/* ====== 仅保留首页特有样式 ====== */

/* 公告栏 */
.announce-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 24px;
  background: var(--color-bg-page);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}
.announce-close {
  background: none;
  border: 0;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color .2s var(--ease-out);
}
.announce-close svg { width: 12px; height: 12px; }
.announce-close:hover { color: var(--color-text); }

/* Hero — 质感中性渐变 */
.hero {
  overflow: hidden;
  border-bottom: 1px solid var(--color-border);
  background:
    radial-gradient(680px 360px at 10% 15%, rgba(15, 15, 19, 0.03), transparent 60%),
    radial-gradient(500px 280px at 90% 85%, rgba(15, 15, 19, 0.02), transparent 60%),
    radial-gradient(400px 200px at 50% 50%, rgba(15, 15, 19, 0.015), transparent 60%),
    linear-gradient(180deg, var(--color-bg-surface) 0%, var(--color-bg-page) 100%);
}
.hero-inner { max-width: 1200px; margin: 0 auto; padding: 80px 24px 72px; }
.hero-content { display: grid; grid-template-columns: 1.25fr 1fr; gap: 56px; align-items: center; }
.hero-text { min-width: 0; }
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-brand);
  color: var(--color-text-inverse);
  padding: 5px 12px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 24px;
  animation: fade-in-up .5s var(--ease-smooth) both;
}
.hero-badge svg { color: var(--color-text-inverse); opacity: 0.7; }
.hero-title {
  font-size: 48px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 20px;
  letter-spacing: -0.04em;
  line-height: 1.1;
  animation: fade-in-up .5s var(--ease-smooth) both;
  animation-delay: .05s;
  white-space: pre-line;
}
.hero-subtitle {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0 0 32px;
  line-height: 1.6;
  max-width: 460px;
  animation: fade-in-up .5s var(--ease-smooth) both;
  animation-delay: .1s;
}
.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 40px;
  animation: fade-in-up .5s var(--ease-smooth) both;
  animation-delay: .15s;
}
.hero-stats {
  display: inline-flex;
  align-items: center;
  gap: 24px;
  padding: 16px 24px;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  animation: fade-in-up .5s var(--ease-smooth) both;
  animation-delay: .2s;
}
.stat { text-align: center; min-width: 72px; }
.stat-num { font-size: 20px; font-weight: 700; color: var(--color-text); letter-spacing: -0.02em; }
.stat-label { font-size: 11px; color: var(--color-text-secondary); margin-top: 4px; }
.stat-divider { width: 1px; height: 24px; background: var(--color-border); }
.hero-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  opacity: 1;
  filter: drop-shadow(0 20px 48px rgba(15, 15, 19, 0.08));
  animation: hero-appear .7s var(--ease-smooth) both;
}
@keyframes hero-appear { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

/* Section */
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; gap: 16px; flex-wrap: wrap; }
.section-title { font-size: 24px; font-weight: 700; color: var(--color-text); margin: 0; letter-spacing: -0.02em; animation: fade-in-up .4s var(--ease-smooth) both; }
.section-tools { display: flex; align-items: center; gap: 8px; }
.sort-select {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-page);
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: all .2s var(--ease-out);
}
.sort-select:focus { border-color: var(--color-text); }
.search-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 14px;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  transition: all .2s var(--ease-out);
}
.search-pill:focus-within {
  border-color: var(--color-text);
  box-shadow: 0 0 0 3px rgba(15, 15, 19, 0.04);
}
.search-pill input {
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 13px;
  color: var(--color-text);
  font-family: inherit;
  width: 180px;
}
.search-pill input::placeholder { color: var(--color-text-tertiary); }

/* 分类胶囊导航 */
.category-nav { margin-bottom: 28px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.category-nav::-webkit-scrollbar { display: none; }
.category-tabs { display: flex; gap: 8px; padding: 4px 0; }

/* 芯片特有部分 */
.chip-icon { width: 16px; height: 16px; border-radius: 4px; background-size: cover; background-position: center; flex-shrink: 0; }
.chip-icon-all { background: transparent; display: flex; align-items: center; justify-content: center; }
.breathing-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-brand); animation: breathe 2s ease-in-out infinite; }
@keyframes breathe {
  0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(15, 15, 19, 0.3); }
  50% { opacity: .5; transform: scale(.7); box-shadow: 0 0 6px 3px rgba(15, 15, 19, 0.08); }
}
.shop-chip.active .breathing-dot { background: var(--color-bg-page); animation-name: breathe-white; }
@keyframes breathe-white {
  0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4); }
  50% { opacity: .6; transform: scale(.7); box-shadow: 0 0 8px 4px rgba(255, 255, 255, 0.15); }
}
.chip-icon-letter { background: var(--color-brand-dim); color: var(--color-text-inverse); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; }
.chip-label { line-height: 1; }
.chip-count { font-size: 11px; font-weight: 500; color: var(--color-text-tertiary); }
.shop-chip.active .chip-count { color: rgba(255, 255, 255, 0.7); }

/* 商品卡片 */
.products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px; }
.product-card {
  background: var(--color-bg-page);
  border: 1px solid var(--color-border);
  overflow: hidden;
  cursor: pointer;
  transition: all .25s var(--ease-out);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  will-change: transform, box-shadow;
}
.product-card:hover {
  border-color: var(--color-text);
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}
.skeleton-card { border: 1px solid var(--color-border-light); border-radius: var(--radius-lg); overflow: hidden; pointer-events: none; }
.card-image {
  width: 100%;
  aspect-ratio: 1/1;
  background: var(--color-bg-surface) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform .4s var(--ease-smooth);
  border-bottom: 1px solid var(--color-border-light);
}
.product-card:hover .card-image { transform: scale(1.02); }
.card-letter { font-size: 40px; font-weight: 700; color: var(--color-text-tertiary); opacity: 0.35; }
.card-body { padding: 14px; }
.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-price-row { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.card-price { font-size: 15px; font-weight: 700; color: var(--color-text); }
.card-price small { font-size: 11px; font-weight: 500; margin-right: 1px; }
.card-view-detail {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  padding: 2px 0;
  transition: color .2s var(--ease-out);
}
.product-card:hover .card-view-detail { color: var(--color-text); }
.card-sold-out { font-size: 11px; font-weight: 500; color: var(--color-text-tertiary); padding: 1px 6px; border-radius: 4px; background: var(--color-bg-hover); border: 1px solid var(--color-border); }

@media (max-width: 900px) {
  .hero-inner { padding: 56px 24px 48px; }
  .hero-content { grid-template-columns: 1fr; gap: 32px; }
  .hero-title { font-size: 36px; }
  .hero-visual { width: 180px; height: 180px; margin: 0 auto; }
}
@media (max-width: 720px) {
  .section-title { font-size: 20px; }
  .search-pill input { width: 130px; }
  .category-nav { margin-bottom: 20px; }
  .category-tabs { gap: 6px; }
  .products-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .card-body { padding: 10px 12px 12px; }
  .hero-inner { padding: 36px 16px 28px; }
  .hero-title { font-size: 26px; letter-spacing: -0.03em; }
  .hero-subtitle { font-size: 13px; }
  .hero-stats { width: 100%; justify-content: space-between; gap: 12px; padding: 12px 16px; }
  .stat { min-width: 0; }
  .stat-num { font-size: 16px; }
  .hero-visual { width: 120px; height: 120px; }
}
@media (max-width: 768px) {
  .hero-inner { padding: 40px 16px 32px; }
  .hero-title { font-size: 24px; letter-spacing: -0.03em; margin-bottom: 16px; }
  .hero-subtitle { font-size: 14px; margin-bottom: 24px; }
  .hero-badge { margin-bottom: 16px; font-size: 10px; padding: 4px 10px; }
  .hero-actions { gap: 10px; margin-bottom: 28px; }
  .hero-stats { flex-wrap: wrap; gap: 16px; padding: 12px 16px; }
  .section-header { flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
  .section-tools { width: 100%; flex-wrap: wrap; gap: 8px; }
  .search-pill { flex: 1 1 auto; width: 100%; }
  .search-pill input { width: 100%; flex: 1 1 auto; }
  .products-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
}

@media (max-width: 480px) {
  .hero-inner { padding: 28px 12px 24px; }
  .hero-title { font-size: 22px; margin-bottom: 12px; }
  .hero-subtitle { font-size: 13px; margin-bottom: 20px; }
  .hero-actions { flex-direction: column; align-items: stretch; gap: 8px; margin-bottom: 24px; }
  .hero-actions .shop-btn,
  .hero-actions .shop-btn-outline { width: 100%; justify-content: center; }
  .hero-stats { padding: 10px 12px; gap: 10px; }
  .stat-num { font-size: 16px; }
  .stat-label { font-size: 10px; }
  .section-title { font-size: 18px; }
  .section-tools { gap: 6px; }
  .sort-select { font-size: 11px; padding: 6px 10px; }
  .products-grid { grid-template-columns: 1fr; gap: 12px; }
  .card-body { padding: 10px; }
  .card-title { font-size: 12px; }
  .card-price { font-size: 14px; }
  .card-letter { font-size: 32px; }
  .hero-visual { width: 120px; height: 120px; }
}
</style>
