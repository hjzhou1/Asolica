<template>
  <div class="shop-page">
    <!-- 商品信息无效 -->
    <div v-if="!product || !spec" class="shop-state-block -full">
      <svg class="state-svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="32" cy="32" r="22" stroke="#d1d5db" stroke-width="1.5"/>
        <path d="M32 22v14M32 42v.5" stroke="#111827" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <p class="state-text">{{ $t('shop.invalid_product_info') }}</p>
      <button class="shop-btn -sm" @click="$router.back()">{{ $t('common.back') }}</button>
    </div>

    <!-- 确认订单主体 -->
    <template v-else>
      <section class="main">
        <div class="shop-inner -narrow">

          <!-- 页面标题 -->
          <div class="shop-page-head">
            <h1 class="shop-title">{{ $t('shop.confirm_order') }}</h1>
            <p class="shop-subtitle">{{ $t('shop.confirm_order_subtitle') }}</p>
          </div>

          <!-- 商品信息卡片 -->
          <div class="shop-card">
            <div class="shop-product-row">
              <div class="shop-product-img" :style="resolvedProductImage ? { backgroundImage: `url(${resolvedProductImage})` } : null">
                <span v-if="!resolvedProductImage" class="shop-img-letter">{{ (product.name || '?').charAt(0) }}</span>
              </div>
              <div class="product-info">
                <h3 class="shop-product-name">{{ product.name }}</h3>
                <p class="shop-product-spec">{{ spec.name }}</p>
              </div>
            </div>
          </div>

          <!-- 订单明细 -->
          <div class="shop-card">
            <h4 class="shop-card-title">{{ $t('shop.order_details') }}</h4>
            <dl class="shop-detail-list">
              <div class="shop-detail-item">
                <dt>{{ $t('shop.spec') }}</dt>
                <dd>{{ spec.name }}</dd>
              </div>
              <div class="shop-detail-item">
                <dt>{{ $t('shop.unit_price') }}</dt>
                <dd>¥{{ unitPrice.toFixed(2) }}</dd>
              </div>
              <div class="shop-detail-item">
                <dt>{{ $t('shop.quantity') }}</dt>
                <div class="shop-qty -sm">
                  <button
                    class="shop-qty-btn"
                    type="button"
                    :disabled="quantity <= 1"
                    @click="decreaseQty"
                  ><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
                  <span class="shop-qty-val">{{ quantity }}</span>
                  <button
                    class="shop-qty-btn"
                    type="button"
                    :disabled="quantity >= availableStock"
                    @click="increaseQty"
                  ><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
                  <span v-if="isUnlimitedStock(stockCount)" class="qty-unlimited">{{ $t('shop.in_stock') }}</span>
                </div>
              </div>
              <!-- 优惠码输入 -->
              <div class="shop-detail-item coupon-row">
                <dt>优惠码</dt>
                <div class="coupon-control">
                  <input
                    v-model="couponCode"
                    class="shop-input -sm"
                    type="text"
                    placeholder="输入优惠码"
                    :disabled="couponApplied"
                    style="width:140px"
                  />
                  <button
                    v-if="!couponApplied"
                    class="shop-btn -sm"
                    type="button"
                    :disabled="!couponCode.trim() || couponChecking"
                    @click="onValidateCoupon"
                  >{{ couponChecking ? '验证中' : '使用' }}</button>
                  <button
                    v-else
                    class="shop-btn-outline -sm"
                    type="button"
                    @click="onClearCoupon"
                  >取消</button>
                </div>
              </div>
              <!-- 优惠金额（已应用时显示） -->
              <div v-if="couponApplied" class="shop-detail-item coupon-discount-row">
                <dt>优惠抵扣</dt>
                <dd class="discount-amount">-¥{{ couponDiscount.toFixed(2) }}</dd>
              </div>
              <div class="shop-detail-item shop-detail-total">
                <dt>{{ $t('shop.total') }}</dt>
                <dd>¥{{ totalAmount.toFixed(2) }}</dd>
              </div>
            </dl>
          </div>

          <!-- 联系方式 -->
          <div class="shop-card">
            <h4 class="shop-card-title">{{ $t('shop.contact') }}</h4>
            <input
              v-model="contact"
              class="shop-input"
              type="text"
              :placeholder="$t('shop.contact_placeholder')"
              autocomplete="off"
            />
            <p class="shop-field-hint">{{ $t('shop.contact_hint') }}</p>
          </div>

          <!-- manual 类型商品自定义字段（如 QQ 账号、备注等） -->
          <div v-if="customFields.length > 0" class="shop-card">
            <h4 class="shop-card-title">{{ $t('shop.required_info') }}</h4>
            <div v-for="f in customFields" :key="f.field" class="custom-field">
              <label class="field-label">
                {{ f.desc }}
                <span v-if="f.rule" class="required-mark">*</span>
              </label>
              <input
                v-model="otherIpu[f.field]"
                class="shop-input"
                type="text"
                :placeholder="f.placeholder"
                autocomplete="off"
              />
            </div>
          </div>

          <!-- 邮箱（选填） -->
          <div class="shop-card">
            <h4 class="shop-card-title">
              {{ $t('shop.email_label') }}
              <span class="optional-badge">{{ $t('shop.optional') }}</span>
            </h4>
            <input
              v-model="email"
              class="shop-input"
              type="email"
              :placeholder="$t('shop.email_placeholder')"
              autocomplete="email"
            />
            <p class="shop-field-hint">{{ $t('shop.email_hint') }}</p>
          </div>

          <!-- 查询密码（后台开启时必填） -->
          <div v-if="searchPwdEnabled" class="shop-card">
            <h4 class="shop-card-title">
              {{ $t('shop.search_pwd') }}
              <span class="required-badge">{{ $t('shop.required') }}</span>
            </h4>
            <input
              v-model="searchPwd"
              class="shop-input"
              type="text"
              :placeholder="$t('shop.search_pwd_placeholder')"
              autocomplete="off"
            />
            <p class="shop-field-hint">{{ $t('shop.search_pwd_hint') }}</p>
          </div>

          <!-- 提交按钮区 -->
          <div class="submit-section">
            <button
              class="shop-btn -full"
              type="button"
              :class="{ 'is-submitting': isSubmitting }"
              :disabled="!canSubmit || isSubmitting"
              @click="handleSubmitOrder"
            >
              {{ submitButtonText }}
            </button>
            <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
          </div>

        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useToast } from '../../composables/useToast.js';
import { fetchProducts, fetchStock, placeOrder, validateCoupon, getOrderConfig } from '../../api/shop.js';
import { resolveImageUrl } from '../../utils/media.js';

// 路由和导航
const route = useRoute();
const router = useRouter();
const toast = useToast();
const { t } = useI18n();

// 从 URL query 参数读取初始值
const productId = ref(route.query.productId || '');
const specId = ref(route.query.specId || '');
const contact = ref(route.query.contact || '');
const email = ref(route.query.email || '');
const quantity = ref(Number(route.query.qty) || 1);

// 商品和规格数据
const product = ref(null);
const spec = ref(null);
const stockCount = ref(0);

// UI 状态
const isSubmitting = ref(false);
const errorMessage = ref('');

// 优惠码状态
const couponCode = ref('');
const couponDiscount = ref(0);
const couponApplied = ref(false);
const couponChecking = ref(false);

// 查询密码（后台开启时必填）
const searchPwdEnabled = ref(false);
const searchPwd = ref('');

// manual 类型商品自定义字段输入值
const otherIpu = ref({});

// 计算属性：解析后的商品图片URL
const resolvedProductImage = computed(() => {
  if (!product.value) return null;
  return resolveImageUrl(product.value.image);
});

const MAX_QTY = 50;

// 计算属性：单价
const unitPrice = computed(() => {
  if (!spec.value) return 0;
  return Number(spec.value.price) || 0;
});

// 计算属性：总金额（原价 - 优惠抵扣，不低于0）
const totalAmount = computed(() => {
  const original = unitPrice.value * quantity.value;
  return Math.max(0, original - couponDiscount.value);
});

const isManualProduct = computed(() => product.value?.type === 'manual');

function isUnlimitedStock(count) {
  return count === -1;
}

// 解析商品 other_ipu_cnf 配置为自定义字段列表（与后端 parseOtherIpuCnf 逻辑一致）
const customFields = computed(() => {
  const cnf = product.value?.otherIpuCnf || product.value?.other_ipu_cnf || '';
  if (!cnf || !isManualProduct.value) return [];
  const lines = String(cnf).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const result = [];
  for (const line of lines) {
    const parts = line.split('=');
    if (parts.length < 3) continue; // 与后端一致：至少 3 段 field=desc=rule
    result.push({
      field: (parts[0] || '').trim(),
      desc: (parts[1] || parts[0] || '').trim(),
      rule: (parts[2] || '').trim() === 'true' || (parts[2] || '').trim() === '1',
      placeholder: ((parts[3] || parts[1] || '')).trim(),
    });
  }
  return result.filter(f => f.field);
});

// 计算属性：可用库存数量（manual 类型视为无限库存）
const availableStock = computed(() => {
  if (isManualProduct.value || isUnlimitedStock(stockCount.value)) return MAX_QTY;
  return stockCount.value;
});

// 计算属性：是否可以提交
const canSubmit = computed(() => {
  // 必须有商品和规格
  if (!product.value || !spec.value) return false;

  // 必须有规格ID
  if (!specId.value) return false;

  // 必须填写联系方式
  if (!contact.value.trim()) return false;

  // 查询密码开启时必须填写
  if (searchPwdEnabled.value && !searchPwd.value.trim()) return false;

  // 数量必须在有效范围内
  if (quantity.value <= 0) return false;
  if (quantity.value > availableStock.value) return false;

  // manual 类型商品必填自定义字段校验
  for (const f of customFields.value) {
    if (f.rule && !String(otherIpu.value[f.field] || '').trim()) {
      return false;
    }
  }

  // 不能重复提交
  if (isSubmitting.value) return false;

  return true;
});

// 计算属性：提交按钮文字
const submitButtonText = computed(() => {
  if (isSubmitting.value) return t('shop.processing');
  return t('shop.confirm_payment');
});

// 减少数量
function decreaseQty() {
  if (quantity.value > 1) {
    quantity.value -= 1;
  }
}

// 增加数量
function increaseQty() {
  if (quantity.value < availableStock.value) {
    quantity.value += 1;
  }
}

// 验证优惠码
async function onValidateCoupon() {
  if (!couponCode.value.trim() || !product.value) return;
  couponChecking.value = true;
  errorMessage.value = '';
  try {
    const result = await validateCoupon({
      code: couponCode.value.trim(),
      productId: product.value.id,
    });
    couponDiscount.value = result.discount;
    couponApplied.value = true;
    toast.success(`优惠码已应用，抵扣 ¥${result.discount.toFixed(2)}`);
  } catch (e) {
    toast.error(e.message || '优惠码无效');
    couponDiscount.value = 0;
    couponApplied.value = false;
  } finally {
    couponChecking.value = false;
  }
}

// 清除优惠码
function onClearCoupon() {
  couponCode.value = '';
  couponDiscount.value = 0;
  couponApplied.value = false;
}

// 提交订单
async function handleSubmitOrder() {
  // 防止重复提交
  if (!canSubmit.value || isSubmitting.value) return;

  // 清除错误消息
  errorMessage.value = '';
  isSubmitting.value = true;

  try {
    const payload = {
      productId: productId.value,
      specId: specId.value,
      contact: contact.value.trim(),
      email: email.value.trim() || undefined,
      qty: quantity.value,
      couponCode: couponApplied.value ? couponCode.value.trim() : undefined,
      searchPwd: searchPwdEnabled.value ? searchPwd.value.trim() : undefined,
    };
    // manual 类型商品附加自定义字段
    if (isManualProduct.value && customFields.value.length > 0) {
      payload.otherIpu = JSON.stringify(otherIpu.value);
    }
    const order = await placeOrder(payload);

    // 显示成功提示
    toast.success(t('shop.order_placed_success'));

    // 将订单数据临时存入 sessionStorage，供订单详情页读取
    // 统一使用 order.id（数据库主键）作为 key 和路由参数，与 dingdanxiangqing.vue 保持一致
    try {
      sessionStorage.setItem(`order_${order.id}`, JSON.stringify(order));
    } catch { /* 忽略存储错误 */ }

    // 延迟跳转让用户看到提示
    setTimeout(() => {
      router.replace({
        name: 'dingdanxiangqing',
        params: { id: order.id },
        query: { contact: contact.value.trim() },
      });
    }, 600);

  } catch (error) {
    console.error('[确认订单] 提交失败:', error);
    // 显示错误信息
    errorMessage.value = error.message || t('shop.order_failed_retry');
    // 失败时重置提交状态
    isSubmitting.value = false;
  }

  // 注意：成功时不重置 isSubmitting，因为即将离开页面
}

// 组件挂载时初始化数据
onMounted(async () => {
  const pid = route.query.productId;
  const sid = route.query.specId;

  // 缺少必要参数
  if (!pid || !sid) {
    product.value = null;
    return;
  }

  try {
    // 从后端获取商品列表
    const products = await fetchProducts();
    const foundProduct = products.find(p => p.id === pid);
    if (!foundProduct) {
      product.value = null;
      return;
    }

    product.value = foundProduct;

    // 查找规格
    const foundSpec = (foundProduct.cardSpecs || []).find(s => s.id === sid);
    if (!foundSpec) {
      product.value = null;
      return;
    }

    spec.value = foundSpec;

    // 获取库存
    const stock = await fetchStock(pid, sid);
    stockCount.value = stock;

    // 检查并限制购买数量不超过库存（manual 类型视为无限库存）
    if (!isUnlimitedStock(stock) && quantity.value > stock) {
      quantity.value = Math.max(1, stock);
    }
  } catch (error) {
    console.error('[确认订单] 加载失败:', error);
    product.value = null;
  }

  // 加载订单配置（查询密码开关等）
  try {
    const cfg = await getOrderConfig();
    searchPwdEnabled.value = !!cfg.searchPwdEnabled;
  } catch (e) {
    console.error('[确认订单] 加载订单配置失败:', e);
  }

  document.title = t('shop.confirm_order_title');
});
</script>

<style scoped>
/* ====== 仅保留页面布局特有样式 ====== */

.main { padding: 48px 0 64px; }

.product-info { min-width: 0; flex: 1; }

/* 库存标签 */
.qty-unlimited {
  margin-left: 10px;
  font-size: 12px;
  color: var(--color-success);
}

/* 按钮标签 */
.optional-badge {
  font-size: 11px;
  font-weight: 400;
  color: var(--color-text-tertiary);
  margin-left: 6px;
}
.required-badge {
  font-size: 11px;
  font-weight: 400;
  color: var(--color-danger);
  margin-left: 6px;
}

/* 自定义字段 */
.custom-field { margin-bottom: 14px; }
.custom-field:last-child { margin-bottom: 0; }
.field-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 8px;
}
.required-mark { color: var(--color-danger); margin-left: 2px; }

/* 提交区域 */
.submit-section { margin-top: 24px; text-align: center; }

/* 提交中动画 */
.shop-btn.is-submitting {
  background: var(--color-brand-dim);
  animation: pulse-glow 1.5s ease-in-out infinite;
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(17, 24, 39, 0.2); }
  50% { box-shadow: 0 0 0 10px rgba(17, 24, 39, 0); }
}

.error-text { font-size: 13px; color: var(--color-danger); margin: 10px 0 0; }

/* 优惠码 */
.coupon-row { flex-wrap: wrap; }
.coupon-control { display: flex; gap: 8px; align-items: center; }
.coupon-discount-row .discount-amount { color: var(--color-danger); font-weight: 600; }

@media (max-width: 720px) {
  .main { padding: 24px 0 48px; }
}
</style>
