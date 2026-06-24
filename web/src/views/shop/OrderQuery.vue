<template>
  <div class="shop-page">
    <!-- ====== Lottie 查询动画覆盖层 ====== -->
    <LottieLoader
      v-if="showLottie"
      :overlay="true"
      :src="lottieSrc"
      :text="lottieText"
      :width="280"
      :height="136"
    />

    <!-- 页面标题区 -->
    <section class="shop-hero">
      <h1 class="shop-title">{{ $t('shop.order_query') }}</h1>
      <p class="shop-subtitle">{{ $t('shop.query_subtitle') }}</p>
    </section>

    <!-- 查询主体 -->
    <section class="query-section">
      <!-- ====== Tab 分段控制器 ====== -->
      <div class="shop-segment" role="tablist">
        <button
          role="tab"
          :aria-selected="queryMode === 'fuzzy'"
          :class="['shop-segment-tab', { active: queryMode === 'fuzzy' }]"
          @click="switchMode('fuzzy')"
        >
          <span>{{ $t('shop.contact_query') }}</span>
          <span class="shop-segment-badge">{{ $t('shop.recommended') }}</span>
        </button>
        <button
          role="tab"
          :aria-selected="queryMode === 'exact'"
          :class="['shop-segment-tab', { active: queryMode === 'exact' }]"
          @click="switchMode('exact')"
        >
          <span>{{ $t('shop.exact_query') }}</span>
        </button>
      </div>

      <!-- ====== 表单面板 ====== -->
      <div class="form-panel" :key="queryMode">
        <!-- 模糊查询表单 -->
        <form v-if="queryMode === 'fuzzy'" class="shop-card-form" @submit.prevent="onFuzzyQuery" novalidate>
          <p class="form-desc">{{ $t('shop.fuzzy_query_desc') }}</p>

          <div class="shop-field is-required">
            <label for="contact-fuzzy">
              {{ $t('shop.contact') }}
              <span class="shop-field-tip">{{ $t('shop.contact_tip') }}</span>
            </label>
            <input
              id="contact-fuzzy"
              ref="contactFuzzyRef"
              v-model="contactFuzzy"
              type="text"
              class="shop-input -lg"
              :placeholder="$t('shop.contact_input_placeholder')"
              autocomplete="off"
              spellcheck="false"
              :disabled="loading"
            />
          </div>

          <div v-if="searchPwdEnabled" class="shop-field is-required">
            <label for="searchPwd">
              {{ $t('shop.search_pwd') }}
              <span class="shop-field-tip">{{ $t('shop.search_pwd_hint') }}</span>
            </label>
            <input
              id="searchPwd"
              v-model="searchPwd"
              type="text"
              class="shop-input -lg"
              :placeholder="$t('shop.search_pwd_placeholder')"
              autocomplete="off"
              spellcheck="false"
              :disabled="loading"
            />
          </div>

          <button type="submit" class="shop-btn -full -accent" :disabled="!canFuzzyQuery || loading">
            <span>{{ loading && !showLottie ? $t('shop.querying_fuzzy') : $t('shop.fuzzy_query_btn') }}</span>
          </button>
        </form>

        <!-- 精准查询表单 -->
        <form v-if="queryMode === 'exact'" class="shop-card-form" @submit.prevent="onExactQuery" novalidate>
          <p class="form-desc">{{ $t('shop.exact_query_desc') }}</p>

          <div class="shop-field is-required">
            <label for="orderNo-exact">
              {{ $t('shop.order_no') }}
            </label>
            <input
              id="orderNo-exact"
              ref="orderNoRef"
              v-model="orderNoExact"
              type="text"
              class="shop-input -lg"
              :placeholder="$t('shop.order_no_placeholder')"
              autocomplete="off"
              spellcheck="false"
              :disabled="loading"
            />
          </div>

          <div class="shop-field is-required">
            <label for="contact-exact">
              {{ $t('shop.contact') }}
            </label>
            <input
              id="contact-exact"
              v-model="contactExact"
              type="text"
              class="shop-input -lg"
              :placeholder="$t('shop.contact_input_placeholder')"
              autocomplete="off"
              spellcheck="false"
              :disabled="loading"
            />
          </div>

          <button type="submit" class="shop-btn -full -accent" :disabled="!canExactQuery || loading">
            <span>{{ loading && !showLottie ? $t('shop.querying_exact') : $t('shop.exact_query_btn') }}</span>
          </button>
        </form>
      </div>

      <!-- ====== 结果区（仅模糊查询显示列表，精准查询自动跳转详情页） ====== -->
      <div class="result-area">
        <!-- 初始态 -->
        <div v-if="state === 'idle'" class="shop-state-block -idle">
          <svg class="state-svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <rect x="8" y="16" width="48" height="36" rx="6" stroke="#d1d5db" stroke-width="1.5"/>
            <path d="M8 24l24 14 24-14" stroke="#d1d5db" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <p class="state-text">{{ $t('shop.idle_hint_v2') }}</p>
        </div>

        <!-- 未找到 -->
        <div v-else-if="state === 'notfound'" class="shop-state-block -animated -full">
          <svg class="state-svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <circle cx="28" cy="28" r="16" stroke="#d1d5db" stroke-width="1.5"/>
            <path d="m40 40 12 12" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"/>
            <path d="m22 28 6 6 10-12" stroke="#111827" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h3 class="state-title">{{ $t('shop.not_found') }}</h3>
          <p class="state-text">{{ $t('shop.not_found_desc') }}</p>
          <button class="shop-btn-link" @click="reset">{{ $t('shop.requery') }}</button>
        </div>

        <!-- 暂无订单 -->
        <div v-else-if="state === 'empty'" class="shop-state-block -animated -full">
          <svg class="state-svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <rect x="10" y="16" width="44" height="40" rx="6" stroke="#d1d5db" stroke-width="1.5"/>
            <path d="M10 26h44" stroke="#d1d5db" stroke-width="1.5"/>
            <path d="M22 38h20M22 46h12" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <h3 class="state-title">{{ $t('shop.no_orders') }}</h3>
          <p class="state-text">{{ $t('shop.no_orders_desc') }}</p>
          <button class="shop-btn-link" @click="reset">{{ $t('shop.requery') }}</button>
        </div>

        <!-- 错误态 -->
        <div v-else-if="state === 'error'" class="shop-state-block -animated -full">
          <svg class="state-svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <circle cx="32" cy="32" r="22" stroke="#d1d5db" stroke-width="1.5"/>
            <path d="M32 22v14M32 42v.5" stroke="#111827" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <h3 class="state-title">{{ $t('shop.query_failed') }}</h3>
          <p class="state-text">{{ errorMsg }}</p>
          <button class="shop-btn-link" @click="retryLastQuery">{{ $t('common.retry') }}</button>
        </div>

        <!-- 模糊结果：订单卡片列表（点击跳转详情页） -->
        <div v-else-if="state === 'list' && results.length" class="shop-result-list">
          <div class="result-list-head">
            <h3 class="result-list-title">
              {{ $t('shop.recent_orders') }}
              <span class="result-list-count">{{ $t('shop.total_count_bi', { count: results.length }) }}</span>
            </h3>
            <span class="result-list-tip">{{ $t('shop.contact_label', { contact: lastQuery.contact }) }}</span>
          </div>

          <button
            v-for="o in results"
            :key="o.orderNo"
            class="shop-result-link"
            @click="viewDetail(o)"
          >
            <div class="result-left">
              <StatusBadge :status="o.status" />
              <span class="result-name">
                <span class="card-name-main">{{ o.productName }}</span>
                <SpecChip v-if="o.specName" :label="o.specName" />
              </span>
            </div>
            <div class="result-right">
              <span class="result-time">{{ formatTime(o.paidAt || o.createdAt) }}</span>
              <span class="result-amount">¥{{ formatPrice(o.amount) }}</span>
              <svg class="result-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m6 4 4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getOrderConfig, orderQuery, orderQueryByContact } from '../../api/shop.js';
import LottieLoader from '../../components/common/LottieLoader.vue';
import SpecChip from '../../components/shop/SpecChip.vue';
import StatusBadge from '../../components/shop/StatusBadge.vue';
import { formatTime, formatPrice } from '../../composables/useFormat.js';

const router = useRouter();
const { t } = useI18n();

// ====== Lottie 动画 ======
const showLottie = ref(false);
const lottieSrc = '/assets/Heartbeat Lottie Animation.json';
const lottieText = ref('');

// ====== Tab 切换 ======
const queryMode = ref('fuzzy');

function switchMode(mode) {
  if (loading.value) return;
  queryMode.value = mode;
  reset();
  nextTick(() => {
    if (mode === 'fuzzy') contactFuzzyRef.value?.focus?.();
    else orderNoRef.value?.focus?.();
  });
}

// ====== 模糊查询表单 ======
const contactFuzzy = ref('');
const contactFuzzyRef = ref(null);
const searchPwd = ref('');
const searchPwdEnabled = ref(false);

// ====== 精准查询表单 ======
const orderNoExact = ref('');
const orderNoRef = ref(null);
const contactExact = ref('');

// ====== 共享状态 ======
const loading = ref(false);
const lastQueryType = ref('');

// ====== 结果 ======
const state = ref('idle');
const errorMsg = ref('');
const results = ref([]);
const lastQuery = ref({ contact: '', orderNo: '' });

// ====== 校验 ======
const canFuzzyQuery = computed(() => {
  if (!contactFuzzy.value.trim()) return false;
  if (searchPwdEnabled.value) return searchPwd.value.trim().length > 0;
  return true;
});
const canExactQuery = computed(() => {
  return orderNoExact.value.trim().length > 0 && contactExact.value.trim().length > 0;
});

function reset() {
  state.value = 'idle';
  results.value = [];
  errorMsg.value = '';
  showLottie.value = false;
}

/**
 * 关闭 Lottie 覆盖层，延迟确保用户至少看到片刻动画完成态
 */
async function dismissLottie(minMs = 800) {
  await new Promise(r => setTimeout(r, minMs));
  showLottie.value = false;
  lottieText.value = '';
}

/**
 * 跳转订单详情页
 */
function viewDetail(order) {
  if (!order || !order.id) return;
  router.push({ name: 'dingdanxiangqing', params: { id: order.id }, query: { contact: lastQuery.value.contact } });
}

// ====== 模糊查询 ======
async function onFuzzyQuery() {
  if (!canFuzzyQuery.value || loading.value) return;

  loading.value = true;
  lastQueryType.value = 'fuzzy';
  state.value = '';
  errorMsg.value = '';
  results.value = [];

  const c = contactFuzzy.value.trim();
  lastQuery.value = { contact: c, orderNo: '' };

  // 显示 Lottie 动画
  lottieText.value = t('shop.querying_order');
  showLottie.value = true;

  try {
    const list = await orderQueryByContact({
      contact: c,
      days: 3,
      searchPwd: searchPwdEnabled.value ? searchPwd.value.trim() : undefined,
    });

    if (Array.isArray(list) && list.length) {
      results.value = list;
      state.value = 'list';
    } else {
      state.value = 'empty';
    }
  } catch (e) {
    state.value = 'error';
    errorMsg.value = e?.message || t('shop.network_error');
  }

  await dismissLottie();
  loading.value = false;
}

// ====== 精准查询 → 自动跳转详情页 ======
async function onExactQuery() {
  if (!canExactQuery.value || loading.value) return;

  loading.value = true;
  lastQueryType.value = 'exact';
  state.value = '';
  errorMsg.value = '';
  results.value = [];

  const no = orderNoExact.value.trim();
  const c = contactExact.value.trim();
  lastQuery.value = { contact: c, orderNo: no };

  // 显示 Lottie 动画
  lottieText.value = t('shop.querying_order');
  showLottie.value = true;

  try {
    const r = await orderQuery({ orderNo: no, contact: c });
    if (r) {
      // 精准查询成功 → 跳转详情页
      await dismissLottie();
      loading.value = false;
      router.push({ name: 'dingdanxiangqing', params: { id: r.id }, query: { contact: c } });
      return;
    } else {
      state.value = 'notfound';
    }
  } catch (e) {
    state.value = 'error';
    errorMsg.value = e?.message || t('shop.network_error');
  }

  await dismissLottie();
  loading.value = false;
}

function retryLastQuery() {
  if (lastQueryType.value === 'fuzzy') onFuzzyQuery();
  else if (lastQueryType.value === 'exact') onExactQuery();
  else onFuzzyQuery();
}

onMounted(async () => {
  document.title = t('shop.order_query_title');
  try {
    const cfg = await getOrderConfig();
    searchPwdEnabled.value = !!cfg.searchPwdEnabled;
  } catch (e) {
    console.error('[订单查询] 加载配置失败:', e);
  }
});
</script>

<style scoped>
/* ====== 仅保留页面布局特有样式 ====== */

.query-section {
  padding: 48px 24px 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.form-panel { width: 100%; max-width: 520px; }

.form-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0 0 20px;
  line-height: 1.5;
  text-align: center;
}

/* ====== 玻璃质感查询卡片 ====== */
.shop-card-form {
  background: var(--color-bg-glass);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
  backdrop-filter: blur(12px) saturate(160%);
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

/* ====== 胶囊输入框 ====== */
.shop-input {
  border-radius: var(--radius-full);
  padding: 0 18px;
}
.shop-input:focus {
  border-color: var(--color-text);
  box-shadow: 0 0 0 3px rgba(15, 15, 19, 0.06);
}

/* ====== 胶囊查询按钮（accent 蓝 + 白字） ====== */
.shop-btn {
  border-radius: var(--radius-full);
}

/* ====== 胶囊分段控制器 ====== */
.shop-segment {
  border-radius: var(--radius-full);
  padding: 4px;
  background: var(--color-bg-glass);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}
.shop-segment-tab {
  border-radius: var(--radius-full);
  padding: 8px 18px;
}
.shop-segment-tab.active {
  background: var(--color-bg-page);
  border-radius: var(--radius-full);
}

/* ====== 状态徽章 / 规格芯片胶囊化（覆盖子组件） ====== */
:deep(.status-badge) {
  border-radius: var(--radius-full);
  padding: 4px 14px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.01em;
}
:deep(.spec-chip) {
  border-radius: var(--radius-full);
  padding: 2px 12px;
}

/* ====== 结果区特有布局 ====== */
.result-area {
  width: 100%;
  max-width: 1200px;
  margin-top: 48px;
  min-height: 200px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.result-list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px 4px;
  flex-wrap: wrap;
}
.result-list-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 10px;
}
.result-list-count {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-border-light);
  padding: 2px 10px;
  border-radius: var(--radius-full);
}
.result-list-tip {
  font-size: 12px;
  color: var(--color-text-tertiary);
  word-break: break-all;
}

/* ====== 订单结果卡片：圆角 + 轻阴影 ====== */
.shop-result-link {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.shop-result-link:hover {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

/* 结果卡片内联名称 */
.card-name-main {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

/* ====== 状态块圆角容器 ====== */
.shop-state-block {
  border-radius: var(--radius-lg);
}

/* ====== 响应式 ====== */
@media (max-width: 880px) {
  .query-section { padding: 32px 24px 72px; }
}
@media (max-width: 560px) {
  .query-section { padding: 24px 16px 56px; }
  .form-panel { max-width: 100%; }
  .shop-card-form { padding: 20px 16px; border-radius: var(--radius-lg); }
  .shop-input { padding: 0 16px; }
  .shop-segment-tab { padding: 8px 14px; }
}
</style>