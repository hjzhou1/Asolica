<template>
  <div class="media-page">
    <header class="page-head">
      <div>
        <h1 class="page-title">{{ t('media.title') }}</h1>
        <p class="page-desc">{{ t('media.desc') }}</p>
      </div>
      <div class="head-actions">
        <label class="btn-primary" :class="{ 'is-disabled': uploading }">
          <input type="file" accept="image/*" multiple hidden @change="onUpload" :disabled="uploading" />
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 11V3M4 7l4-4 4 4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>{{ uploading ? t('media.uploading', { progress: uploadProgress }) : t('media.upload') }}</span>
        </label>
        <button class="btn-ghost" @click="load" :disabled="loading">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8a6 6 0 0 1 10.2-4.3M14 8a6 6 0 0 1-10.2 4.3M12 1v3.5h-3.5M4 15v-3.5h3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>{{ t('media.refresh') }}</span>
        </button>
        <button class="btn-ghost" @click="onExportAll" :disabled="!items.length || exporting">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2v8m-3-3l3 3 3-3M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>{{ exporting ? t('media.exporting') : t('media.download_all') }}</span>
        </button>
        <button class="btn-primary" @click="onPickFolder" :disabled="exporting" :title="folderSupport ? t('media.save_to_folder_title') : t('media.browser_not_support_title')">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 5.5l4-1 4 1 4-1v8l-4 1-4-1-4 1v-8zM6 4.5v8M14 4.5v8" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
          <span>{{ folderSupport ? t('media.save_to_folder') : t('media.browser_not_support') }}</span>
        </button>
      </div>
    </header>

    <!-- 空状态 -->
    <div v-if="!items.length" class="empty card">
      <p class="empty-title">{{ t('media.empty') }}</p>
      <p class="empty-desc">{{ t('media.empty_desc') }}</p>
    </div>

    <!-- 文件列表 -->
    <div v-else class="card media-grid-wrap">
      <div class="grid-bar">
        <span class="cell-muted">{{ t('media.x_files', { count: items.length, size: formatSize(totalSize) }) }}</span>
        <div class="bar-right">
          <input v-model="filter" type="text" class="search-input" :placeholder="t('media.search_placeholder')" />
        </div>
      </div>

      <div v-if="!filtered.length" class="empty small"><p>{{ t('media.no_match') }}</p></div>

      <ul v-else class="media-grid">
        <li v-for="f in filtered" :key="f.id" class="media-card">
          <div class="thumb" :style="f.url ? { backgroundImage: `url(${f.url})` } : null">
            <span v-if="!f.url" class="thumb-fallback">{{ (f.mimeType || '?').replace('image/', '') }}</span>
            <span class="badge-id" :title="f.filename">{{ f.filename }}</span>
          </div>
          <div class="meta">
            <div class="meta-name" :title="f.originalName">{{ f.originalName || f.filename }}</div>
            <div class="meta-sub cell-muted">
              <span>{{ formatSize(f.size || 0) }}</span>&middot;<span>{{ formatDateTime(f.createdAt) }}</span>
            </div>
          </div>
          <div class="ops">
            <button class="link-btn" @click="onOpen(f)">{{ t('media.preview') }}</button>
            <button class="link-btn" @click="onDownload(f)">{{ t('media.download') }}</button>
            <button class="link-btn" @click="copyAndToast(f.filename, t('media.toast_copied', { label: f.filename }), t('media.toast_copy_failed'))">{{ t('media.copy_id') }}</button>
            <button class="link-btn danger" @click="onDelete(f)">{{ t('media.delete') }}</button>
          </div>
        </li>
      </ul>
    </div>

    <!-- 大图预览 -->
    <div v-if="preview" class="preview-mask" @click.self="preview = null">
      <div class="preview-box">
        <button class="preview-close" @click="preview = null">&times;</button>
        <img :src="preview" alt="preview" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { listAllFileIds, deleteFile as dbDelete, uploadImage } from '../../api/media.js';
import { useToast } from '../../composables/useToast.js';
import { useConfirm } from '../../composables/useConfirm.js';
import { useClipboard } from '../../composables/useClipboard.js';
import { formatSize, formatDateTime } from '../../composables/useFormat.js';

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const { copyAndToast } = useClipboard();

const items = ref([]); // { id, filename, originalName, mimeType, size, createdAt, url }
const loading = ref(false);
const exporting = ref(false);
const uploading = ref(false);
const uploadProgress = ref('');
const filter = ref('');
const preview = ref(null);

const folderSupport = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

const totalSize = computed(() => items.value.reduce((sum, f) => sum + (f.size || 0), 0));
const filtered = computed(() => {
  const k = filter.value.trim().toLowerCase();
  if (!k) return items.value;
  return items.value.filter(f =>
    (f.originalName || '').toLowerCase().includes(k) ||
    (f.filename || '').toLowerCase().includes(k) ||
    (f.id || '').toLowerCase().includes(k)
  );
});

async function load() {
  loading.value = true;
  try {
    const records = await listAllFileIds();
    const out = records.map(rec => ({ ...rec }));
    out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    items.value = out;
  } finally { loading.value = false; }
}

// 通过 url 下载文件（服务端存储，无 blob 字段）
async function fetchBlob(url) {
  const r = await fetch(url);
  return await r.blob();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename || 'download';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

async function onDownload(f) {
  if (!f.url) { toast.error(t('media.toast_download_failed')); return; }
  try {
    const blob = await fetchBlob(f.url);
    downloadBlob(blob, f.originalName || f.filename || 'download.jpg');
  } catch { toast.error(t('media.toast_download_failed')); }
}

function onOpen(f) {
  if (!f.url) { toast.error(t('media.toast_preview_failed')); return; }
  preview.value = f.url;
}

async function onDelete(f) {
  const name = f.originalName || f.filename || f.id;
  const ok = await confirm.open({ title: t('media.delete_title'), message: t('media.delete_confirm', { name }), confirmText: t('media.delete') });
  if (!ok) return;
  try {
    await dbDelete(f.id);
    items.value = items.value.filter(x => x.id !== f.id);
    toast.success(t('media.toast_deleted'));
  } catch (e) { toast.error(t('media.toast_delete_failed', { msg: e?.message || '' })); }
}

async function onExportAll() {
  if (!items.value.length) return; exporting.value = true;
  try {
    for (let i = 0; i < items.value.length; i++) {
      const f = items.value[i];
      if (!f.url) continue;
      try {
        const blob = await fetchBlob(f.url);
        downloadBlob(blob, f.originalName || f.filename || 'download.jpg');
        await new Promise(r => setTimeout(r, 250));
      } catch { /* 单个失败跳过 */ }
    }
    toast.success(t('media.toast_batch_download'));
  } finally { exporting.value = false; }
}

async function onPickFolder() {
  if (!folderSupport) { toast.error(t('media.toast_browser_not_support')); return; }
  let dir;
  try { dir = await window.showDirectoryPicker({ mode: 'readwrite' }); }
  catch (e) { if (e?.name === 'AbortError') return; toast.error(t('media.toast_open_folder_failed', { msg: e?.message || '' })); return; }
  exporting.value = true;
  let ok = 0, fail = 0;
  try {
    for (const f of items.value) {
      if (!f.url) { fail++; continue; }
      let name = f.originalName || f.filename || 'download.jpg', i = 1;
      while (await nameExists(dir, name)) {
        const dot = name.lastIndexOf('.'), base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
        name = `${base} (${i})${ext}`; i++;
      }
      try {
        const blob = await fetchBlob(f.url);
        const fh = await dir.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
        ok++;
      } catch { fail++; }
    }
  } catch { fail++; }
  toast.success(fail ? t('media.toast_save_failed', { fail }) : t('media.toast_saved', { count: ok }));
  exporting.value = false;
}
async function nameExists(dir, name) {
  try { await dir.getFileHandle(name, { create: false }); return true; }
  catch { return false; }
}

async function onUpload(e) {
  const files = Array.from(e.target.files || []); e.target.value = '';
  if (!files.length) return; uploading.value = true; let ok = 0, fail = 0;
  try {
    for (let i = 0; i < files.length; i++) {
      uploadProgress.value = `${i + 1}/${files.length}`;
      try { await uploadImage(files[i]); ok++; } catch { fail++; }
    }
    if (ok) { toast.success(fail ? t('media.toast_upload_failed', { fail }) : t('media.toast_upload_ok', { ok })); }
    else { toast.error(t('media.toast_upload_all_failed')); }
    await load();
  } finally { uploading.value = false; uploadProgress.value = ''; }
}

onMounted(load);
</script>

<style scoped>
.media-page { display: flex; flex-direction: column; gap: 20px; }

.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.page-title { font-size: 22px; font-weight: 600; margin: 0; letter-spacing: -0.01em; }
.page-desc { font-size: 13px; color: var(--color-text-secondary); margin: 4px 0 0; }
.head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.head-actions .btn-ghost, .head-actions .btn-primary { display: inline-flex; align-items: center; gap: 6px; }
.head-actions svg { width: 14px; height: 14px; }
.head-actions .is-disabled { opacity: .55; cursor: not-allowed; pointer-events: none; }

.card { background: var(--color-bg-page); border-radius: 14px; box-shadow: 0 1px 2px rgba(17,24,39,0.04); border: 1px solid rgba(17,24,39,0.06); }
.empty { padding: 60px 24px; text-align: center; } .empty.small { padding: 24px; }
.empty-title { font-size: 16px; font-weight: 500; margin: 0 0 6px; }
.empty-desc { color: var(--color-text-secondary); font-size: 13px; margin: 0 0 18px; }

.media-grid-wrap { overflow: hidden; }
.grid-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid rgba(17,24,39,0.06); gap: 12px; flex-wrap: wrap; }
.search-input { height: 32px; padding: 0 12px; font-size: 13px; border: 1px solid rgba(17,24,39,0.12); border-radius: 8px; background: var(--color-bg-page); outline: 0; min-width: 220px; font-family: inherit; }
.search-input:focus { border-color: var(--color-text); box-shadow: 0 0 0 3px rgba(17,24,39,0.06); }

.media-grid { list-style: none; padding: 16px; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
.media-card { border: 1px solid rgba(17,24,39,0.06); border-radius: 12px; background: var(--color-bg-page); overflow: hidden; display: flex; flex-direction: column; transition: border-color .15s, box-shadow .15s; }
.media-card:hover { border-color: rgba(17,24,39,0.18); box-shadow: 0 4px 12px rgba(17,24,39,0.06); }
.thumb { aspect-ratio: 1.3 / 1; background: var(--color-border-light) center/cover no-repeat; position: relative; display: flex; align-items: center; justify-content: center; color: var(--color-text-secondary); font-size: 12px; }
.thumb-fallback { text-transform: uppercase; letter-spacing: .04em; }
.badge-id { position: absolute; top: 6px; left: 6px; background: rgba(17,24,39,.7); color: var(--color-text-inverse); font-size: 10px; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; max-width: calc(100% - 12px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { padding: 10px 12px 0; }
.meta-name { font-size: 13px; font-weight: 500; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta-sub { font-size: 11px; margin-top: 2px; display: flex; gap: 4px; flex-wrap: wrap; }
.ops { display: flex; gap: 8px; flex-wrap: wrap; padding: 8px 12px 12px; border-top: 1px solid rgba(17,24,39,0.04); margin-top: 10px; }
.link-btn { background: none; border: 0; padding: 0; font-size: 12px; color: var(--color-brand-dim); cursor: pointer; font-family: inherit; }
.link-btn:hover { color: var(--color-text); text-decoration: underline; }
.link-btn.danger { color: var(--color-danger); } .link-btn.danger:hover { color: var(--color-danger); }

.preview-mask { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: var(--z-modal); padding: 32px; }
.preview-box { position: relative; max-width: 90vw; max-height: 90vh; background: var(--color-bg-page); border-radius: 12px; padding: 8px; }
.preview-box img { max-width: 100%; max-height: 88vh; display: block; border-radius: 8px; }
.preview-close { position: absolute; top: -10px; right: -10px; width: 32px; height: 32px; border-radius: 50%; background: var(--color-bg-page); border: 0; font-size: 20px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,.2); }
</style>
