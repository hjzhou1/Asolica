<template>
  <span :class="['status-badge', `status-${status}`]">{{ label }}</span>
</template>
<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  status: { type: String, required: true }
});

const { t } = useI18n();

const STATUS_LABELS = {
  pending: 'shop.orderStatus.pending',
  paid: 'shop.orderStatus.paid',
  delivered: 'shop.orderStatus.delivered',
  failed: 'shop.orderStatus.failed',
  refunded: 'shop.orderStatus.refunded',
  expired: 'shop.orderStatus.expired',
  available: 'cards.status.available',
  assigned: 'cards.status.assigned',
  sold: 'cards.status.sold',
  enabled: 'common.enabled',
  disabled: 'common.disabled',
};

const label = computed(() => {
  const key = STATUS_LABELS[props.status];
  if (key) return t(key);
  // fallback: 尝试 shop.orderStatus.* key（如出现未在映射表中的订单状态）
  const fallbackKey = 'shop.orderStatus.' + props.status;
  const fallback = t(fallbackKey);
  return fallback !== fallbackKey ? fallback : props.status;
});
</script>
<style scoped>
.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
/* 黑白极简：完成/启用用黑底白字，其余用灰阶 */
.status-pending { background: #f9fafb; color: #374151; }
.status-paid { background: #f3f4f6; color: #111827; }
.status-delivered { background: #111827; color: #ffffff; }
.status-failed { background: #f3f4f6; color: #111827; }
.status-refunded { background: #f9fafb; color: #6b7280; }
.status-expired { background: #f9fafb; color: #9ca3af; }
.status-available { background: #f9fafb; color: #111827; }
.status-assigned { background: #f3f4f6; color: #374151; }
.status-sold { background: #f3f4f6; color: #6b7280; }
.status-enabled { background: #111827; color: #ffffff; }
.status-disabled { background: #f3f4f6; color: #6b7280; }
</style>
