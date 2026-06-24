<template>
  <teleport to="body">
    <div v-if="open" class="ml-mask" @click.self="onClose">
      <div class="ml-modal" role="dialog" aria-label="从媒体库选择">
        <header class="ml-head">
          <h3>从媒体库选择</h3>
          <button type="button" class="ml-close" @click="onClose" aria-label="关闭">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </button>
        </header>

        <div class="ml-toolbar">
          <input v-model="filter" type="text" class="ml-search" placeholder="按文件名 / ID 搜索…" />
          <label class="ml-upload-btn">
            <input type="file" accept="image/*" hidden @change="onUpload" />
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 11V3M4 7l4-4 4 4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>{{ uploading ? '上传中…' : '上传新图' }}</span>
          </label>
        </div>

        <div class="ml-body">
          <div v-if="loading" class="ml-empty">加载中…</div>
          <div v-else-if="!items.length" class="ml-empty">
            <p>媒体库是空的</p>
            <p class="ml-empty-tip">点右上「上传新图」或从别的页面上传</p>
          </div>
          <div v-else class="ml-grid">
            <div
            v-for="f in filtered"
            :key="f.id"
            class="ml-card"
            :class="{ active: modelValue === f.filename }"
            @click="onPick(f)"
          >
            <div class="ml-thumb" :style="f.url ? { backgroundImage: `url(${f.url})` } : null">
              <span v-if="!f.url" class="ml-fallback">图片</span>
              <span class="ml-badge">{{ f.filename }}</span>
            </div>
            <div class="ml-info">
              <div class="ml-name" :title="f.originalName">{{ f.originalName || f.filename }}</div>
              <div class="ml-sub">
                <span>{{ formatSize(f.size || 0) }}</span>
                <span>·</span>
                <span>{{ formatDateTime(f.createdAt) }}</span>
              </div>
            </div>
          </div>
            <div v-if="!filtered.length" class="ml-empty small">没有匹配</div>
          </div>
        </div>

        <footer class="ml-foot">
          <span class="cell-muted">共 {{ items.length }} 个文件 · {{ formatSize(totalSize) }}</span>
          <button type="button" class="link-btn" @click="onClose">取消</button>
        </footer>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { uploadImage, listAllFileIds } from '../../api/media.js';
import { formatSize, formatDateTime } from '../../composables/useFormat.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  modelValue: { type: String, default: '' },
});
const emit = defineEmits(['update:open', 'update:modelValue', 'select']);

const items = ref([]); // { id, filename, originalName, size, createdAt, url }
const loading = ref(false);
const uploading = ref(false);
const filter = ref('');

const totalSize = computed(() => items.value.reduce((s, f) => s + (f.size || 0), 0));
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
    // 服务端返回字段：id, filename, originalName, mimeType, size, createdAt, url
    const out = records.map(rec => ({ ...rec }));
    out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    items.value = out;
  } finally {
    loading.value = false;
  }
}

watch(() => props.open, (v) => { if (v) load(); });

async function onUpload(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  uploading.value = true;
  try {
    const result = await uploadImage(file);
    // uploadImage 返回 { id, filename, url, ... }，存储 filename 作为引用（用于 /api/media/:filename）
    const filename = result?.filename;
    if (!filename) throw new Error('上传返回数据异常');
    await load();
    // 直接选中新上传的图
    emit('update:modelValue', filename);
    emit('select', filename);
    onClose();
  } catch (err) {
    // 用 console 记录，避免引入 toast 造成耦合（本组件可能在任意上下文使用）
    console.error('[MediaLibraryModal] 上传失败:', err?.message || err);
  } finally {
    uploading.value = false;
  }
}

function onPick(f) {
  emit('update:modelValue', f.filename);
  emit('select', f.filename);
  onClose();
}

function onClose() {
  emit('update:open', false);
}
</script>

<style scoped>
.ml-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center;
  z-index: var(--z-modal); padding: 24px;
}
.ml-modal {
  width: 100%; max-width: 760px; max-height: 84vh;
  background: var(--color-bg-page); border-radius: 16px;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,.25);
}
.ml-head {
  padding: 16px 20px; border-bottom: 1px solid rgba(17,24,39,0.06);
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.ml-head h3 { font-size: 16px; font-weight: 600; margin: 0; }
.ml-close {
  background: none; border: 0;
  cursor: pointer; color: var(--color-text-secondary); padding: 4px;
  display: inline-flex; align-items: center; justify-content: center;
}
.ml-close svg { width: 18px; height: 18px; }
.ml-close:hover { color: var(--color-text); }
.ml-toolbar {
  display: flex; gap: 8px; padding: 12px 20px;
  border-bottom: 1px solid rgba(17,24,39,0.06);
}
.ml-search {
  flex: 1; height: 36px; padding: 0 12px;
  border: 1px solid rgba(17,24,39,0.12); border-radius: 8px;
  font-size: 13px; outline: 0; font-family: inherit; background: var(--color-bg-page);
}
.ml-search:focus { border-color: var(--color-text); box-shadow: 0 0 0 3px rgba(17,24,39,0.06); }
.ml-upload-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 14px;
  background: var(--color-brand); color: var(--color-text-inverse); border-radius: 8px;
  font-size: 13px; cursor: pointer; font-weight: 500; font-family: inherit;
}
.ml-upload-btn:hover { background: var(--color-brand-hover); }
.ml-upload-btn svg { width: 14px; height: 14px; }
.ml-body { flex: 1; min-height: 0; overflow-y: auto; }
.ml-empty {
  padding: 60px 20px; text-align: center; color: var(--color-text-secondary); font-size: 13px;
}
.ml-empty p { margin: 0; }
.ml-empty-tip { font-size: 12px; margin-top: 6px !important; opacity: .7; }
.ml-empty.small { padding: 24px 20px; }
.ml-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px; padding: 16px 20px;
}
.ml-card {
  border: 2px solid transparent; border-radius: 10px; padding: 4px;
  cursor: pointer; transition: border-color .12s, background .12s, transform .12s;
  background: transparent;
}
.ml-card:hover { background: var(--color-bg-surface); }
.ml-card.active { border-color: var(--color-text); background: var(--color-border-light); }
.ml-thumb {
  aspect-ratio: 1/1; background: var(--color-border-light) center/cover no-repeat;
  border-radius: 8px; position: relative;
  display: flex; align-items: center; justify-content: center;
  color: var(--color-text-tertiary); font-size: 12px; overflow: hidden;
}
.ml-fallback { text-transform: uppercase; }
.ml-badge {
  position: absolute; bottom: 4px; left: 4px;
  background: rgba(17,24,39,.7); color: var(--color-text-inverse);
  font-size: 9px; padding: 1px 5px; border-radius: 3px;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  max-width: calc(100% - 8px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ml-info { padding: 4px 4px 0; }
.ml-name {
  font-size: 12px; color: var(--color-text); font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ml-sub {
  font-size: 10px; color: var(--color-text-secondary); margin-top: 2px;
  display: flex; gap: 3px; flex-wrap: wrap;
}
.ml-foot {
  padding: 10px 20px; border-top: 1px solid rgba(17,24,39,0.06);
  display: flex; align-items: center; justify-content: space-between;
  background: var(--color-bg-surface);
}
</style>
