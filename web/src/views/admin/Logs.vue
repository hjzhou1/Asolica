<template>
  <div class="logs-page">
    <header class="page-head">
      <h1>{{ t('logs.title') }}</h1>
      <p>{{ t('logs.subtitle') }}</p>
    </header>

    <div v-if="loading" class="loading">{{ t('logs.loading') }}</div>
    <div v-else-if="!items.length" class="empty">{{ t('logs.empty') }}</div>
    <table v-else class="log-table">
      <thead><tr>
        <th>{{ t('logs.col_time') }}</th><th>{{ t('logs.col_operator') }}</th><th>{{ t('logs.col_action') }}</th><th>{{ t('logs.col_target') }}</th><th>{{ t('logs.col_detail') }}</th><th>{{ t('logs.col_ip') }}</th>
      </tr></thead>
      <tbody>
        <tr v-for="l in items" :key="l.id">
          <td class="time">{{ formatDateTime(l.createdAt) }}</td>
          <td>{{ l.adminName || t('logs.system') }}</td>
          <td><span class="action-tag">{{ l.action }}</span></td>
          <td>{{ l.targetType }} {{ l.targetId ? '#' + String(l.targetId).slice(0,8) : '' }}</td>
          <td class="detail">{{ l.detail }}</td>
          <td class="ip">{{ l.ip }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="total > pageSize" class="pager">
      <button :disabled="page<=1" @click="page--;load()">{{ t('common.prev_page') }}</button>
      <span>{{ page }} / {{ Math.ceil(total/pageSize) }}</span>
      <button :disabled="page >= Math.ceil(total/pageSize)" @click="page++;load()">{{ t('common.next_page') }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { getLogs } from '../../api/admin.js';
import { formatDateTime } from '../../composables/useFormat.js';

const { t } = useI18n();
const items = ref([]);
const loading = ref(true);
const page = ref(1);
const pageSize = 20;
const total = ref(0);

async function load() {
  loading.value = true;
  try {
    const d = await getLogs({ page: page.value, pageSize });
    items.value = d.data || d;
    total.value = d.total || (Array.isArray(d) ? d.length : 0);
  } catch { /* ignore */ }
  loading.value = false;
}

onMounted(load);
</script>

<style scoped>
.logs-page { max-width: 1100px; padding: 24px; }
.page-head { margin-bottom: 20px; }
.page-head h1 { font-size: 20px; font-weight: 600; color: var(--color-text); margin: 0 0 4px; }
.page-head p { font-size: 13px; color: var(--color-text-secondary); margin: 0; }

.loading, .empty { text-align: center; padding: 40px; color: var(--color-text-tertiary); font-size: 14px; }

.log-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.log-table th { text-align: left; padding: 10px 12px; border-bottom: 2px solid var(--color-border); color: var(--color-text-secondary); font-weight: 500; white-space: nowrap; }
.log-table td { padding: 10px 12px; border-bottom: 1px solid var(--color-border-light); color: var(--color-brand-dim); }
.log-table tr:hover td { background: var(--color-bg-surface); }
.time { font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
.detail { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ip { font-size: 12px; color: var(--color-text-tertiary); font-family: monospace; }
.action-tag { display: inline-block; padding: 2px 8px; background: var(--color-info-bg); color: var(--color-info); border-radius: 4px; font-size: 12px; font-weight: 500; }

.pager { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; }
.pager button { padding: 6px 14px; border: 1px solid var(--color-border-muted); background: var(--color-bg-page); border-radius: 6px; font-size: 13px; cursor: pointer; }
.pager button:hover:not(:disabled) { background: var(--color-bg-surface); }
.pager button:disabled { opacity: .4; cursor: not-allowed; }
.pager span { font-size: 13px; color: var(--color-text-secondary); }
</style>
