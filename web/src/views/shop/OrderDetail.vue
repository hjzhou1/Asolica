<template>
  <div class="shop-page">
    <!-- 加载状态：骨架屏 -->
    <div v-if="loading" class="skeleton-detail">
      <div class="skeleton skeleton-status-bar"></div>
      <div class="skeleton skeleton-card-detail">
        <div class="skeleton skeleton-text" style="width: 30%; height: 18px; margin-bottom: 16px;"></div>
        <div class="skeleton skeleton-text" style="width: 90%;"></div>
        <div class="skeleton skeleton-text" style="width: 70%;"></div>
        <div class="skeleton skeleton-text" style="width: 50%;"></div>
      </div>
      <div class="skeleton skeleton-card-detail">
        <div class="skeleton skeleton-text" style="width: 30%; height: 18px; margin-bottom: 16px;"></div>
        <div class="skeleton skeleton-text" style="width: 80%;"></div>
        <div class="skeleton skeleton-text" style="width: 60%;"></div>
      </div>
    </div>

    <!-- 订单不存在 -->
    <div v-else-if="!order" class="shop-state-block -full">
      <svg class="state-svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="28" cy="28" r="16" stroke="#d1d5db" stroke-width="1.5"/>
        <path d="m40 40 12 12" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"/>
        <path d="m22 28 6 6 10-12" stroke="#111827" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h3 class="state-title">{{ t('shop.order_not_exist') }}</h3>
      <p class="state-text">{{ t('shop.order_invalid') }}</p>
      <button class="shop-btn -sm" @click="$router.push('/')">{{ t('shop.back_to_home') }}</button>
    </div>

    <!-- 订单详情主体 -->
    <template v-else>
      <section class="main">
        <div class="shop-inner -narrow">
          <!-- ... status-head kept as is ... -->
          <!-- 状态头部 -->
          <div class="status-head" :class="'status-' + order.status">
            <div class="status-icon-wrap">
              <svg v-if="order.status === 'paid' || order.status === 'delivered'" class="status-icon" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="2"/>
                <path d="M21 33l7 7 15-16" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else-if="order.status === 'pending'" class="status-icon" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="2"/>
                <path d="M32 20v14M32 40v2" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
              <svg v-else class="status-icon" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="2"/>
                <rect x="22" y="22" width="20" height="20" rx="2" stroke="currentColor" stroke-width="2.5" fill="none"/>
              </svg>
            </div>
            <h1 class="status-title">{{ statusLabel }}</h1>
            <p class="status-desc">{{ statusDescription }}</p>
          </div>

          <!-- 商品信息卡片 -->
          <div class="shop-card">
            <h4 class="shop-card-title">{{ t('shop.product_info') }}</h4>

            <div class="shop-product-row">
              <div class="shop-product-img" :style="productImage ? { backgroundImage: `url(${productImage})` } : null">
                <span v-if="!productImage" class="shop-img-letter">{{ (order.productName || '?').charAt(0) }}</span>
              </div>
              <div class="product-info">
                <h3 class="shop-product-name">{{ order.productName }}</h3>
                <span v-if="order.specName" class="shop-product-spec">{{ order.specName }}</span>
              </div>
            </div>

            <!-- 订单元信息 -->
            <dl class="shop-detail-list">
              <div class="shop-detail-item">
                <dt>{{ t('shop.order_no') }}</dt>
                <dd class="mono">{{ order.orderNo }}</dd>
              </div>
              <div class="shop-detail-item">
                <dt>{{ t('shop.created_at') }}</dt>
                <dd>{{ formatTime(order.createdAt) }}</dd>
              </div>
              <div v-if="order.paidAt" class="shop-detail-item">
                <dt>{{ t('shop.paid_at') }}</dt>
                <dd>{{ formatTime(order.paidAt) }}</dd>
              </div>
              <div class="shop-detail-item">
                <dt>{{ t('shop.quantity') }}</dt>
                <dd>{{ t('shop.qty_zhang', { count: order.qty }) }}</dd>
              </div>
              <div class="shop-detail-item shop-detail-total">
                <dt>{{ t('shop.amount') }}</dt>
                <dd>¥{{ Number(order.amount).toFixed(2) }}</dd>
              </div>
              <div v-if="order.paymentChannelLabel" class="shop-detail-item">
                <dt>{{ t('shop.payment_method') }}</dt>
                <dd>{{ order.paymentChannelLabel }}</dd>
              </div>
              <div v-if="order.paymentTradeNo" class="shop-detail-item">
                <dt>{{ t('shop.trade_no') }}</dt>
                <dd class="mono">{{ order.paymentTradeNo }}</dd>
              </div>
              <div class="shop-detail-item">
                <dt>{{ t('shop.contact') }}</dt>
                <dd>{{ order.contact }}</dd>
              </div>
              <div v-if="order.email" class="shop-detail-item">
                <dt>{{ t('shop.email_label') }}</dt>
                <dd>{{ order.email }}</dd>
              </div>
            </dl>
          </div>

          <!-- 卡密 / 支付区 (保留原结构) -->
          <!-- 卡密内容区 -->
          <div v-if="order.status === 'delivered' && codes.length > 0" class="shop-card card-codes">
            <div class="codes-head">
              <h4 class="shop-card-title">{{ t('shop.card_content') }}</h4>
              <span class="codes-count">{{ t('shop.total_count_zhang', { count: codes.length }) }}</span>
            </div>
            <ul class="codes-list">
              <li v-for="(code, index) in codes" :key="index" class="code-item">
                <code>{{ code }}</code>
                <button class="copy-btn" @click="copyToClipboard(code)">{{ t('common.copy') }}</button>
              </li>
            </ul>
            <button class="copy-all-btn" @click="copyToClipboard(codes.join('\n'))">{{ t('shop.copy_all') }}</button>
            <p v-if="copied" class="copied-hint">{{ t('shop.copied_to_clipboard') }}</p>
          </div>

          <!-- 待支付：支付入口 -->
          <div v-if="order.status === 'pending'" class="shop-card card-pay">
            <h4 class="shop-card-title">{{ t('shop.payment_method') }}</h4>
            <div v-if="channelsLoading" class="pay-loading">
              <div class="spinner-sm" aria-hidden="true" />
              <span>{{ t('shop.loading_payment') }}</span>
            </div>
            <div v-else-if="channels.length === 0" class="pay-placeholder">
              <p class="pay-text">{{ t('shop.no_payment') }}</p>
              <p class="pay-sub">{{ t('shop.contact_service') }}</p>
            </div>
            <div v-else class="pay-section">
              <div class="channel-list">
                <label
                  v-for="ch in channels"
                  :key="ch.id"
                  class="channel-item"
                  :class="{ active: selectedChannel === ch.id, ['pay-' + ch.method]: true }"
                >
                  <input type="radio" name="payment-method" :value="ch.id" v-model="selectedChannel" />
                  <span class="pay-icon" v-html="payIcon(ch.method)" aria-hidden="true"></span>
                  <span class="channel-name">{{ ch.name }}</span>
                </label>
              </div>
              <button class="shop-btn -full" :disabled="!selectedChannel || paying" @click="onPay">
                <span v-if="paying" class="spinner-sm" aria-hidden="true" />
                <span>{{ paying ? t('shop.creating_payment') : t('shop.pay_now_amount', { amount: Number(order.amount).toFixed(2) }) }}</span>
              </button>
            </div>
            <div v-if="payResult" class="pay-result">
              <p class="qr-hint">{{ t('shop.redirecting_hint') }}</p>
              <button v-if="payResult.pay_url" class="pay-link-btn" @click="goToPayment()">{{ t('shop.go_to_payment') }}</button>
              <p class="pay-poll-hint">{{ t('shop.pay_poll_hint') }}<a href="#" @click.prevent="pollOnce">{{ t('shop.click_refresh') }}</a></p>
            </div>
          </div>

          <!-- 操作按钮组 -->
          <div class="actions">
            <button class="shop-btn -full" @click="$router.push('/')">{{ t('shop.back_to_home') }}</button>
            <button class="shop-btn-outline -full" @click="$router.push({ path: '/dingdanchaxun', query: { contact: order.contact } })">{{ t('shop.query_more_orders') }}</button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { resolveImageUrl } from '../../utils/media.js';
import { useToast } from '../../composables/useToast.js';
import { formatTime, copyToClipboard as fmtCopy } from '../../composables/useFormat.js';
import { getStoreMethods, createPayment, getPaymentStatus, getOrderById } from '../../api/shop.js';

const route = useRoute();
const toast = useToast();
const { t } = useI18n();

// 响应式数据
const loading = ref(true);
const order = ref(null);
const copied = ref(false);

// 支付相关状态
const channels = ref([]);
const channelsLoading = ref(false);
const selectedChannel = ref('');
const paying = ref(false);
const payResult = ref(null);
let pollTimer = null;
let pollStartTime = 0;
let polling = false; // in-flight 锁：防止 pollOnce 耗时 >3s 时重叠执行
const POLL_MAX_DURATION = 35 * 60 * 1000; // 轮询最长 35 分钟（订单 30 分钟过期 + 5 分钟缓冲）

// 计算属性：卡密列表（后端返回的订单已包含 codes）
const codes = computed(() => {
  if (!order.value) return [];
  return order.value.codes || [];
});

// 计算属性：商品图片（后端 GET /order/:id 返回 productImage 字段）
const productImage = computed(() => {
  if (!order.value || !order.value.productImage) return null;
  return resolveImageUrl(order.value.productImage);
});

// 计算属性：状态标签（统一走 shop.orderStatus.* i18n key）
const statusLabel = computed(() => {
  if (!order.value) return '';
  return t('shop.orderStatus.' + order.value.status);
});

// 计算属性：状态描述（统一走 shop.orderStatusDesc.* i18n key）
const statusDescription = computed(() => {
  if (!order.value) return '';
  const status = order.value.status;

  // 已发货状态根据是否有邮箱动态选择描述
  if (status === 'delivered') {
    return order.value.email
      ? t('shop.orderStatusDesc.delivered_with_email')
      : t('shop.orderStatusDesc.delivered');
  }

  return t('shop.orderStatusDesc.' + status);
});

// 复制到剪贴板（复用 composable）
async function copyToClipboard(text) {
  const ok = await fmtCopy(text);
  if (ok) {
    copied.value = true;
    toast.success(t('shop.copied_to_clipboard'));
  } else {
    toast.error(t('common.copy_failed'));
  }
  setTimeout(() => { copied.value = false; }, 2000);
}

// 支付方式图标（支付宝/微信）
const PAY_ICONS = {
  alipay: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 3h14a2 2 0 0 1 2 2v9.6c-2.2-.9-5.2-2.1-8.3-3.4.6-1.1 1.1-2.2 1.5-3.3H11V6.5h4.2V6H11V3.9h-1.2V6H5.6v.5h4.2v1.4H6.5v.6h6.7c-.3.9-.7 1.8-1.2 2.7-1.7-.7-3.3-1.3-4.5-1.7C5.8 11.4 3.9 13.2 3 14.6V5a2 2 0 0 1 2-2z" fill="#1677ff"/><path d="M21 17.2c-1.5 1.6-4.6 2.8-9 2.8-3.4 0-6.2-.8-8-2.1V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.8z" fill="#1677ff"/><path d="M9.3 13.5c-1.2.9-2.7 1.6-4.3 2 .8.4 2 .8 3.4 1.1 1.2-.9 2.3-2 3.2-3.1-.8 0-1.6 0-2.3 0z" fill="#1677ff"/></svg>',
  wechat: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 4C5.36 4 2 6.69 2 10c0 1.89 1.08 3.56 2.78 4.66L4 17l2.5-1.4c.9.25 1.9.4 3 .4h.27a5.5 5.5 0 0 1-.27-1.7c0-3.2 3.13-5.8 7-5.8.34 0 .67.03 1 .07C17.5 5.9 13.86 4 9.5 4z" fill="#07c160"/><path d="M17 9.5c-3.59 0-6.5 2.46-6.5 5.5 0 1.6.8 3.04 2.06 4.04L12 21l1.8-1c.7.2 1.5.3 2.2.3 3.59 0 6.5-2.46 6.5-5.5S20.59 9.5 17 9.5z" fill="#07c160"/><circle cx="7" cy="9.5" r="1" fill="#fff"/><circle cx="11" cy="9.5" r="1" fill="#fff"/><circle cx="14.5" cy="14.5" r="0.9" fill="#fff"/><circle cx="19.5" cy="14.5" r="0.9" fill="#fff"/></svg>',
};
function payIcon(id) {
  return PAY_ICONS[id] || '';
}

// 加载支付方式（支付宝/微信）
async function loadChannels() {
  channelsLoading.value = true;
  try {
    channels.value = await getStoreMethods();
    if (channels.value.length > 0) {
      selectedChannel.value = channels.value[0].id;
    }
  } catch (e) {
    console.error('[订单详情] 加载支付方式失败:', e);
  } finally {
    channelsLoading.value = false;
  }
}

// 发起支付
async function onPay() {
  if (!selectedChannel.value || !order.value) return;
  paying.value = true;
  payResult.value = null;
  try {
    const result = await createPayment({
      orderId: order.value.id,
      payCheck: selectedChannel.value,
      contact: order.value.contact,
    });
    payResult.value = result;
    toast.success(t('shop.payment_created'));
    // 先启动轮询，再打开支付页面（新标签页），确保当前页面保持轮询能力
    startPolling();
    if (result.pay_url) {
      // 优先新标签页打开，保留当前订单页继续轮询；若被浏览器拦截则回退到当前页跳转
      const win = window.open(result.pay_url, '_blank');
      if (!win) {
        window.location.href = result.pay_url;
      }
    }
  } catch (e) {
    toast.error(e.message || t('shop.create_payment_failed'));
  } finally {
    paying.value = false;
  }
}

// 跳转到支付页面（当前窗口跳转，让支付平台处理 PC/移动端展示）
function goToPayment(url) {
  const payUrl = (typeof url === 'string' && url) || payResult.value?.pay_url;
  if (!payUrl) return;
  // 当前窗口跳转，支付平台会自动判断设备：
  // PC端 → 显示二维码支付页面
  // 移动端 → 自动拉起支付宝/微信App
  window.location.href = payUrl;
}

// 轮询支付状态（渐进式：前 30 秒每 3 秒一次，之后每 10 秒一次）
function startPolling() {
  stopPolling();
  pollStartTime = Date.now();
  polling = false;
  const tick = async () => {
    // 超时保护
    if (Date.now() - pollStartTime > POLL_MAX_DURATION) {
      stopPolling();
      toast.info(t('shop.payment_status_timeout'));
      return;
    }
    // in-flight 锁
    if (polling) {
      scheduleNext();
      return;
    }
    polling = true;
    try {
      await pollOnce();
    } finally {
      polling = false;
    }
    if (pollTimer) scheduleNext();
  };
  const scheduleNext = () => {
    const elapsed = Date.now() - pollStartTime;
    const interval = elapsed < 30000 ? 3000 : 10000; // 前30秒3秒一次，之后10秒一次
    pollTimer = setTimeout(tick, interval);
  };
  pollTimer = setTimeout(tick, 3000);
}

async function pollOnce() {
  if (!order.value) return;
  try {
    const data = await getPaymentStatus(order.value.id);
    const newStatus = data.status;
    const prevStatus = order.value.status;

    // 已发货（卡密已分配）：停止轮询，刷新订单
    if (newStatus === 'delivered') {
      stopPolling();
      toast.success(t('shop.payment_success'));
      await reloadOrder();
      return;
    }

    // 已支付：更新本地状态，提示卡密发放中
    if (newStatus === 'paid' && prevStatus !== 'paid') {
      order.value = { ...order.value, status: 'paid' };
      toast.info(t('shop.payment_detected'));
    }

    // 订单过期/失败：停止轮询，提示用户
    if (['expired', 'failed'].includes(newStatus)) {
      stopPolling();
      order.value = { ...order.value, status: newStatus };
      if (newStatus === 'expired') {
        toast.warning(t('shop.order_expired'));
      } else {
        toast.error(t('shop.payment_failed'));
      }
      await reloadOrder();
    }
  } catch (e) {
    console.error('[订单详情] 轮询支付状态失败:', e);
  }
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

// 重新加载订单数据（支付成功后刷新）
async function reloadOrder() {
  if (!order.value) return;
  try {
    const contact = order.value.contact || route.query.contact || '';
    const data = await getOrderById(order.value.id, contact);
    if (data) {
      order.value = data;
      // 更新 sessionStorage 缓存
      try {
        sessionStorage.setItem(`order_${order.value.id}`, JSON.stringify(data));
      } catch { /* ignore */ }
    }
  } catch (e) {
    console.error('[订单详情] 刷新订单失败:', e);
  }
}

// 组件挂载时加载数据
onMounted(async () => {
  loading.value = true;

  try {
    const orderId = route.params.id;
    const contact = route.query.contact || '';

    if (!orderId) {
      order.value = null;
      return;
    }

    // 优先从 sessionStorage 读取（下单成功后存入的），用于快速展示
    let foundOrder = null;
    try {
      const cached = sessionStorage.getItem(`order_${orderId}`);
      if (cached) {
        foundOrder = JSON.parse(cached);
      }
    } catch { /* 忽略 */ }

    // 先用缓存数据渲染（如果有），立即结束 loading
    if (foundOrder) {
      order.value = foundOrder;
      loading.value = false;
      // pending 订单立即加载支付渠道
      if (foundOrder.status === 'pending') {
        loadChannels();
      }
      // paid 订单自动轮询（卡密可能正在发放中）
      if (foundOrder.status === 'paid') {
        startPolling();
      }
    }

    // 始终尝试从后端拉取最新数据（覆盖缓存）
    // 场景：免费商品下单后缓存无 codes；支付完成后状态变更；页面刷新
    // 修复：刷新后 route.query.contact 丢失，从缓存订单中取 contact，避免"订单不存在"
    const effectiveContact = contact || foundOrder?.contact || '';
    if (effectiveContact) {
      try {
        const data = await getOrderById(orderId, effectiveContact);
        if (data) {
          order.value = data;
          // 更新 sessionStorage 缓存
          try {
            sessionStorage.setItem(`order_${orderId}`, JSON.stringify(data));
          } catch { /* ignore */ }
          // 如果是 pending 且尚未加载渠道，则加载
          if (data.status === 'pending' && channels.value.length === 0 && !channelsLoading.value) {
            loadChannels();
          }
          // 如果后端返回 paid，说明卡密可能正在发放中，启动轮询
          if (data.status === 'paid') {
            startPolling();
          }
          // 如果后端返回 delivered，停止轮询
          if (data.status === 'delivered') {
            stopPolling();
          }
        }
      } catch (e) {
        console.error('[订单详情] 后端查询失败:', e);
        // 后端查询失败时保留缓存数据（如果有）
      }
    } else if (!foundOrder) {
      // 无缓存且无 contact，无法查询
      order.value = null;
    }
  } catch (error) {
    console.error('[订单详情] 加载失败:', error);
    order.value = null;
  } finally {
    loading.value = false;
  }

  document.title = t('shop.order_detail_title');
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped>
/* ====== 仅保留页面布局特有样式 ====== */

/* 骨架屏 */
.skeleton-detail {
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: fade-in .3s var(--ease-out) both;
}
.skeleton-status-bar { height: 100px; border-radius: var(--radius-xl); }
.skeleton-card-detail { height: 160px; border-radius: var(--radius-xl); padding: 20px; display: flex; flex-direction: column; justify-content: center; }

/* 主体 */
.main { padding: 40px 0 64px; }

.product-info { min-width: 0; flex: 1; }

/* 状态头部 */
.status-head {
  text-align: center;
  padding: 48px 24px 40px;
  margin-bottom: 24px;
  background: radial-gradient(circle at center, rgba(0, 82, 255, 0.015) 0%, transparent 100%), var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
}
.status-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.status-icon {
  width: 64px; height: 64px;
  animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes pop-in {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.status-title {
  font-size: 22px; font-weight: 700; color: var(--color-text);
  margin: 0 0 8px; letter-spacing: -0.02em;
}
.status-desc { font-size: 13px; color: var(--color-text-secondary); margin: 0; }

/* 等宽字体 */
.mono { font-family: var(--font-mono); font-size: 13px; word-break: break-all; }

/* 卡密区域 */
.card-codes { background: var(--color-bg-surface); border: 1px solid var(--color-border); }
.codes-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.codes-count { font-size: 11px; color: var(--color-text-tertiary); font-weight: 500; }
.codes-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.code-item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 14px; background: var(--color-bg-page); border: 1px solid var(--color-border); border-radius: var(--radius-md);
}
.code-item code {
  flex: 1; font-family: var(--font-mono); font-size: 13px;
  word-break: break-all; color: var(--color-text); user-select: all;
}
.copy-btn {
  flex-shrink: 0; padding: 5px 12px; background: var(--color-bg-hover);
  border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 11px;
  cursor: pointer; color: var(--color-text-secondary); transition: all 0.2s var(--ease-out); font-family: inherit;
}
.copy-btn:hover { background: var(--color-border-light); color: var(--color-text); border-color: var(--color-text); }
.copy-all-btn {
  width: 100%; margin-top: 12px; padding: 10px;
  background: var(--color-brand); color: var(--color-text-inverse); border: none;
  border-radius: var(--radius-md); font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all 0.2s var(--ease-out); font-family: inherit;
}
.copy-all-btn:hover { background: var(--color-brand-hover); box-shadow: var(--shadow-sm); }
.copied-hint { font-size: 11px; color: var(--color-success); margin: 8px 0 0; text-align: center; }

/* 支付区域 */
.card-pay { text-align: center; }
.pay-loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 24px 0; color: var(--color-text-tertiary); font-size: 13px; }
.spinner-sm {
  width: 16px; height: 16px; border: 2px solid var(--color-border); border-top-color: var(--color-brand);
  border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block;
}
.pay-placeholder { padding: 20px 0 8px; }
.pay-text { font-size: 13px; font-weight: 600; color: var(--color-text); margin: 0 0 4px; }
.pay-sub { font-size: 11px; color: var(--color-text-tertiary); margin: 0; }
.pay-section { text-align: left; }
.channel-list { display: flex; flex-direction: row; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.channel-item {
  display: flex; align-items: center; gap: 8px; padding: 12px 18px;
  border: 1px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer;
  transition: all 0.2s var(--ease-out); flex: 1 1 0; min-width: 140px; justify-content: center;
  background: var(--color-bg-page);
}
.channel-item:hover { border-color: var(--color-text); background: var(--color-bg-hover); }
.channel-item.active { border-color: var(--color-accent); background: var(--color-accent-light); color: var(--color-accent); font-weight: 600; }
.channel-item input[type="radio"] { display: none; }
.pay-icon { display: flex; align-items: center; flex-shrink: 0; }
.channel-name { font-size: 14px; font-weight: 500; }
.pay-result { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--color-border-light); }
.qr-hint { font-size: 13px; color: var(--color-text-secondary); margin: 0 0 12px; }
.pay-link-btn {
  display: inline-block; padding: 10px 24px; background: var(--color-brand);
  color: var(--color-text-inverse); border: none; border-radius: 8px; font-size: 14px;
  font-weight: 600; cursor: pointer; margin: 8px 0 12px; transition: opacity 0.2s;
}
.pay-link-btn:hover { opacity: 0.9; }
.pay-poll-hint { font-size: 12px; color: var(--color-text-tertiary); margin: 12px 0 0; }
.pay-poll-hint a { color: var(--color-brand); }

/* 操作按钮组 */
.actions { display: flex; gap: 10px; margin-top: 24px; }

@media (max-width: 720px) {
  .main { padding: 24px 0 48px; }
  .status-head { padding: 32px 16px 28px; }
  .status-title { font-size: 22px; }
  .actions { flex-direction: column; }
}
</style>
