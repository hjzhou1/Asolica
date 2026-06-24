<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">{{ t('email_queue.title') }}</h1>
        <p class="page-subtitle">{{ t('email_queue.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn-ghost" :class="{ 'is-loading': loading }" @click="refresh">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 8a5 5 0 11-1.5-3.5L13 6M13 3v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>{{ t('email_queue.refresh') }}</span>
        </button>
        <button v-if="selectedIds.length > 0" class="btn-primary" :disabled="batchResending" @click="onBatchResend">
          <span>{{ t('email_queue.batch_resend', { count: selectedIds.length }) }}</span>
        </button>
      </div>
    </header>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">{{ t('email_queue.stat_total') }}</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-card stat-sent">
        <div class="stat-label">{{ t('email_queue.stat_sent') }}</div>
        <div class="stat-value">{{ stats.sent }}</div>
        <div class="stat-rate">{{ stats.successRate }}%</div>
      </div>
      <div class="stat-card stat-failed">
        <div class="stat-label">{{ t('email_queue.stat_failed') }}</div>
        <div class="stat-value">{{ stats.failed }}</div>
      </div>
      <div class="stat-card stat-pending">
        <div class="stat-label">{{ t('email_queue.stat_pending') }}</div>
        <div class="stat-value">{{ stats.pending }}</div>
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <input v-model="filter.keyword" class="search" type="search" :placeholder="t('email_queue.search_placeholder')" @input="onFilterChange" />
        <select v-model="filter.status" @change="onFilterChange">
          <option value="all">{{ t('email_queue.all_status') }}</option>
          <option value="sent">{{ t('email_queue.status_sent') }}</option>
          <option value="failed">{{ t('email_queue.status_failed') }}</option>
          <option value="pending">{{ t('email_queue.status_pending') }}</option>
        </select>
        <div class="grow" />
        <span class="cell-muted">{{ t('email_queue.x_emails', { count: total }) }}</span>
      </div>

      <div v-if="loading" class="state-block"><div class="spinner-lg" aria-hidden="true" /><p>{{ t('email_queue.loading') }}</p></div>
      <div v-else-if="!list.length" class="state-block empty">
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect x="8" y="14" width="48" height="36" rx="3" stroke="#d1d5db" stroke-width="1.5"/>
          <path d="M8 24h48" stroke="#d1d5db" stroke-width="1.5"/>
          <path d="M16 34h12M16 40h20" stroke="#d1d5db" stroke-width="1.5"/>
        </svg>
        <h3>{{ t('email_queue.no_emails') }}</h3>
        <p>{{ t('email_queue.no_emails_hint') }}</p>
      </div>

      <table v-else class="data-table">
        <thead>
          <tr>
            <th class="col-check"><input type="checkbox" :checked="allSelected" @change="toggleSelectAll" /></th>
            <th>{{ t('email_queue.col_to') }}</th>
            <th>{{ t('email_queue.col_subject') }}</th>
            <th>{{ t('email_queue.col_status') }}</th>
            <th class="col-attempts">{{ t('email_queue.col_attempts') }}</th>
            <th class="col-time">{{ t('email_queue.col_created_at') }}</th>
            <th class="col-time">{{ t('email_queue.col_sent_at') }}</th>
            <th class="col-actions">{{ t('email_queue.col_actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in list" :key="e.id">
            <td class="col-check"><input type="checkbox" :value="e.id" v-model="selectedIds" /></td>
            <td><span class="mono">{{ e.toAddr }}</span></td>
            <td class="cell-subject">{{ e.subject }}</td>
            <td>
              <span class="status-badge" :class="`status-${e.status}`">{{ statusLabel(e.status) }}</span>
            </td>
            <td class="col-attempts mono">{{ e.attempts }}</td>
            <td class="col-time cell-muted">{{ formatTime(e.createdAt) }}</td>
            <td class="col-time cell-muted">{{ e.sentAt ? formatTime(e.sentAt) : '—' }}</td>
            <td class="col-actions">
              <button class="link-btn" @click="openDetail(e)">{{ t('email_queue.detail') }}</button>
              <button class="link-btn" @click="onResend(e)">{{ t('email_queue.resend') }}</button>
              <button v-if="e.status !== 'pending'" class="link-btn danger" @click="onDelete(e)">{{ t('email_queue.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="totalPages > 1" class="pagination">
        <button class="btn-sm" :disabled="page <= 1" @click="page--">{{ t('common.prev_page') }}</button>
        <span class="cell-muted">{{ t('email_queue.page_of', { page, total: totalPages }) }}</span>
        <button class="btn-sm" :disabled="page >= totalPages" @click="page++">{{ t('common.next_page') }}</button>
      </div>
    </div>

    <!-- 详情/补发弹窗 -->
    <transition name="modal">
      <div v-if="detail.open" class="modal-mask" @click.self="detail.open = false">
        <div class="modal modal-lg" role="dialog" aria-modal="true">
          <header class="modal-head">
            <h3>{{ t('email_queue.detail_title') }}</h3>
            <button class="modal-close" @click="detail.open = false" aria-label="close">&times;</button>
          </header>
          <div class="modal-body">
            <div class="kv">
              <div class="kv-row">
                <span class="kv-k">{{ t('email_queue.kv_to') }}</span>
                <span class="kv-v">
                  <input v-model="detail.form.toAddr" class="resend-input" :placeholder="t('email_queue.kv_to')" />
                </span>
              </div>
              <div class="kv-row">
                <span class="kv-k">{{ t('email_queue.kv_subject') }}</span>
                <span class="kv-v">
                  <input v-model="detail.form.subject" class="resend-input" />
                </span>
              </div>
              <div class="kv-row">
                <span class="kv-k">{{ t('email_queue.kv_status') }}</span>
                <span class="kv-v">
                  <span class="status-badge" :class="`status-${detail.email.status}`">{{ statusLabel(detail.email.status) }}</span>
                  <span class="cell-muted" style="margin-left:8px">{{ t('email_queue.kv_attempts', { n: detail.email.attempts }) }}</span>
                </span>
              </div>
              <div class="kv-row">
                <span class="kv-k">{{ t('email_queue.kv_order_id') }}</span>
                <span class="kv-v mono">{{ detail.email.orderId || '—' }}</span>
              </div>
              <div class="kv-row">
                <span class="kv-k">{{ t('email_queue.kv_created_at') }}</span>
                <span class="kv-v">{{ formatTime(detail.email.createdAt) }}</span>
              </div>
              <div class="kv-row" v-if="detail.email.sentAt">
                <span class="kv-k">{{ t('email_queue.kv_sent_at') }}</span>
                <span class="kv-v">{{ formatTime(detail.email.sentAt) }}</span>
              </div>
              <div class="kv-row" v-if="detail.email.lastError">
                <span class="kv-k">{{ t('email_queue.kv_last_error') }}</span>
                <span class="kv-v error-text">{{ detail.email.lastError }}</span>
              </div>
            </div>
            <div class="body-section">
              <div class="body-head">{{ t('email_queue.kv_body') }}</div>
              <textarea v-model="detail.form.body" class="body-textarea" rows="10"></textarea>
            </div>
            <p v-if="detailError" class="form-error">{{ detailError }}</p>
          </div>
          <footer class="modal-foot">
            <button type="button" class="btn-ghost" @click="detail.open = false">{{ t('email_queue.close') }}</button>
            <button type="button" class="btn-primary" :disabled="resending" @click="onResendFromDetail">
              {{ resending ? t('email_queue.sending') : t('email_queue.resend_with_edit') }}
            </button>
          </footer>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '../../composables/useToast';
import { useConfirm } from '../../composables/useConfirm';
import { formatTime } from '../../composables/useFormat';
import {
  listEmailQueue, getEmailQueueDetail, resendEmailQueue, batchResendEmailQueue, deleteEmailQueue,
} from '../../api/admin.js';

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const totalPages = ref(0);
const stats = ref({ total: 0, sent: 0, failed: 0, pending: 0, successRate: 0 });

const filter = reactive({ keyword: '', status: 'all' });
const selectedIds = ref([]);
const resending = ref(false);
const batchResending = ref(false);
const detailError = ref('');

const detail = reactive({
  open: false,
  email: {},
  form: { toAddr: '', subject: '', body: '' },
});

const allSelected = computed(() =>
  list.value.length > 0 && list.value.every(e => selectedIds.value.includes(e.id))
);

function statusLabel(s) {
  const map = {
    sent: t('email_queue.status_sent'),
    failed: t('email_queue.status_failed'),
    pending: t('email_queue.status_pending'),
  };
  return map[s] || s;
}

let filterDebounce = null;
function onFilterChange() {
  if (filterDebounce) clearTimeout(filterDebounce);
  filterDebounce = setTimeout(() => { page.value = 1; loadList(); }, 300);
}

async function loadList() {
  loading.value = true;
  try {
    const data = await listEmailQueue({
      page: page.value,
      pageSize: pageSize.value,
      status: filter.status,
      keyword: filter.keyword,
    });
    list.value = data.data || [];
    total.value = data.total || 0;
    totalPages.value = data.totalPages || 0;
    if (data.stats) stats.value = data.stats;
  } catch (e) {
    toast.error(e.message || t('common.error'));
  } finally {
    loading.value = false;
  }
}

function refresh() { loadList(); }

function toggleSelectAll(e) {
  if (e.target.checked) {
    selectedIds.value = list.value.map(x => x.id);
  } else {
    selectedIds.value = [];
  }
}

async function openDetail(email) {
  detailError.value = '';
  try {
    const full = await getEmailQueueDetail(email.id);
    detail.email = full;
    detail.form.toAddr = full.toAddr;
    detail.form.subject = full.subject;
    detail.form.body = full.body;
    detail.open = true;
  } catch (e) {
    toast.error(e.message || t('common.error'));
  }
}

async function onResend(email) {
  const ok = await confirm.open({
    title: t('email_queue.resend_confirm_title'),
    message: t('email_queue.resend_confirm', { to: email.toAddr, subject: email.subject }),
  });
  if (!ok) return;
  resending.value = true;
  try {
    await resendEmailQueue(email.id);
    toast.success(t('email_queue.resend_success'));
    await loadList();
  } catch (e) {
    toast.error(t('email_queue.resend_failed', { msg: e.message }));
  } finally {
    resending.value = false;
  }
}

async function onResendFromDetail() {
  if (!detail.form.toAddr) {
    detailError.value = t('email_queue.err_to_required');
    return;
  }
  resending.value = true;
  detailError.value = '';
  try {
    await resendEmailQueue(detail.email.id, {
      to: detail.form.toAddr,
      subject: detail.form.subject,
      body: detail.form.body,
    });
    toast.success(t('email_queue.resend_success'));
    detail.open = false;
    await loadList();
  } catch (e) {
    detailError.value = t('email_queue.resend_failed', { msg: e.message });
  } finally {
    resending.value = false;
  }
}

async function onBatchResend() {
  if (selectedIds.value.length === 0) return;
  const ok = await confirm.open({
    title: t('email_queue.batch_resend_title'),
    message: t('email_queue.batch_resend_confirm', { count: selectedIds.value.length }),
  });
  if (!ok) return;
  batchResending.value = true;
  try {
    const r = await batchResendEmailQueue(selectedIds.value);
    toast.success(t('email_queue.batch_resend_result', {
      success: r.succeeded, fail: r.failed,
    }));
    selectedIds.value = [];
    await loadList();
  } catch (e) {
    toast.error(e.message || t('common.error'));
  } finally {
    batchResending.value = false;
  }
}

async function onDelete(email) {
  const ok = await confirm.open({
    title: t('email_queue.delete_confirm_title'),
    message: t('email_queue.delete_confirm', { to: email.toAddr, subject: email.subject }),
  });
  if (!ok) return;
  try {
    await deleteEmailQueue(email.id);
    toast.success(t('email_queue.deleted'));
    await loadList();
  } catch (e) {
    toast.error(e.message || t('common.error'));
  }
}

watch(page, () => loadList());

onMounted(() => loadList());
</script>

<style scoped>
/* ====== EmailQueue 特有样式（基础类继承自全局 admin.css） ====== */
.head-actions { display: flex; gap: 8px; align-items: center; }

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.stat-card {
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-muted);
  border-radius: 12px;
  padding: 16px;
}
.stat-label { font-size: 12px; color: var(--color-text-secondary); }
.stat-value { font-size: 28px; font-weight: 600; margin-top: 4px; }
.stat-rate { font-size: 12px; color: var(--color-success); margin-top: 4px; }
.stat-sent { border-left: 3px solid var(--color-success); }
.stat-failed { border-left: 3px solid var(--color-danger); }
.stat-pending { border-left: 3px solid var(--color-warning); }

/* 表格特有列 */
.col-check { width: 36px; text-align: center; }
.col-attempts { width: 80px; text-align: center; }
.cell-subject { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 邮件状态徽章 */
.status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.status-sent { background: var(--color-success-bg); color: var(--color-success); }
.status-failed { background: var(--color-danger-bg); color: var(--color-danger); }
.status-pending { background: var(--color-warning-bg); color: var(--color-warning); }

/* 链接按钮禁用态 */
.link-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 分页 */
.pagination { display: flex; justify-content: center; align-items: center; gap: 12px; padding: 16px; }

/* 详情弹窗键值表单 */
.kv { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.kv-row { display: flex; gap: 12px; align-items: flex-start; }
.kv-k { width: 100px; color: var(--color-text-secondary); font-size: 13px; flex-shrink: 0; padding-top: 6px; }
.kv-v { flex: 1; font-size: 14px; word-break: break-all; }
.resend-input { width: 100%; padding: 6px 10px; border: 1px solid var(--color-border-muted); border-radius: 6px; font-size: 14px; background: var(--color-bg-surface); }
.error-text { color: var(--color-danger); font-size: 13px; }

/* 邮件正文区 */
.body-section { margin-top: 12px; }
.body-head { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 6px; }
.body-textarea { width: 100%; padding: 10px; border: 1px solid var(--color-border-muted); border-radius: 6px; font-family: ui-monospace, monospace; font-size: 12px; resize: vertical; background: var(--color-bg-surface); }

@media (max-width: 768px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .data-table { font-size: 12px; }
  .col-time { display: none; }
}
</style>
