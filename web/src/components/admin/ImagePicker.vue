<template>
  <div class="img-pick">
    <div class="img-row">
      <div class="img-preview" :style="displayUrl ? { backgroundImage: `url(${displayUrl})` } : null" :class="{ 'is-empty': !displayUrl }">
        <span v-if="!displayUrl" class="img-empty">{{ placeholder || '无图' }}</span>
      </div>
      <div class="img-actions">
        <button type="button" class="btn-sm img-library-btn" @click="libraryOpen = true" title="从媒体库选一张（没有的话可以现场上传）">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2.5 4.5l5.5-2 5.5 2v7l-5.5 2-5.5-2v-7z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            <circle cx="5.5" cy="6.5" r=".9" fill="currentColor"/>
            <path d="M2.5 4.5l5.5 2 5.5-2M8 6.5v7" stroke="currentColor" stroke-width="1.4"/>
          </svg>
          <span>从媒体库选</span>
        </button>
        <input
          v-model="urlInput"
          type="text"
          class="img-url-input"
          placeholder="或粘贴图床 URL（https://…）"
          @input="onUrlInput"
          @blur="onUrlInput"
        />
        <button v-if="modelValue" type="button" class="link-btn danger" @click="onClear">清除</button>
      </div>
    </div>
    <p v-if="error" class="field-error" style="margin:0">{{ error }}</p>
    <p v-if="hint" class="cell-muted" style="margin:0;font-size:12px">{{ hint }}</p>

    <MediaLibraryModal v-model:open="libraryOpen" :modelValue="modelValue" @select="onLibrarySelect" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { resolveImageUrl } from '../../utils/media.js';
import MediaLibraryModal from './MediaLibraryModal.vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  hint: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

// 判断是否为媒体库引用
// - m_xxx: 旧 IndexedDB 格式
// - media_xxx: 旧服务端 ID 格式（向后兼容）
// - xxx.jpg: 新 filename 格式（当前推荐）
function isMediaRef(v) {
  if (!v) return false;
  if (v.startsWith('m_') || v.startsWith('media_')) return true;
  // 纯文件名（含扩展名，非 URL）视为媒体库引用
  if (!v.startsWith('http') && !v.startsWith('/api/') && !v.startsWith('data:') && v.includes('.')) return true;
  return false;
}

// 当前显示用 URL：filename / m_xxx / media_xxx 解析为媒体地址，dataURL/外链直接用
const displayUrl = computed(() => resolveImageUrl(props.modelValue));

const urlInput = ref(props.modelValue && !isMediaRef(props.modelValue) && !props.modelValue.startsWith('data:') ? props.modelValue : '');
const error = ref('');
const libraryOpen = ref(false);

function onLibrarySelect(filename) {
  error.value = '';
  emit('update:modelValue', filename);
  urlInput.value = '';
}

watch(() => props.modelValue, (v) => {
  // 同步 urlInput：当用户外部切换为外链时也回填进来
  if (v && !isMediaRef(v) && !v.startsWith('data:')) {
    if (urlInput.value !== v) urlInput.value = v;
  } else if (v && (isMediaRef(v) || v.startsWith('data:'))) {
    urlInput.value = '';
  } else if (!v) {
    urlInput.value = '';
  }
});

function onUrlInput() {
  error.value = '';
  // 不应该让 urlInput 改写 m_xxx / media_xxx 引用
  if (isMediaRef(props.modelValue)) return;
  // 啥都不填就清空
  const v = urlInput.value.trim();
  if (!v) { emit('update:modelValue', ''); return; }
  emit('update:modelValue', v);
}

function onClear() {
  urlInput.value = '';
  error.value = '';
  emit('update:modelValue', '');
}
</script>

<style scoped>
.img-pick { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
.img-row { display: flex; align-items: flex-start; gap: 12px; }
.img-preview {
  width: 72px; height: 72px; flex: none; border-radius: 10px;
  background: var(--color-border-light) center/cover no-repeat;
  border: 1px solid rgba(17,24,39,0.08);
  display: flex; align-items: center; justify-content: center;
  color: var(--color-text-tertiary); font-size: 12px; overflow: hidden;
}
.img-preview.is-empty { background: var(--color-border-light); }
.img-actions { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.btn-sm { display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: var(--color-border-light); color: var(--color-text); border: 1px solid rgba(17,24,39,0.08);
  border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer; font-family: inherit;
  transition: background .15s, border-color .15s;
}
.btn-sm:hover { background: var(--color-border); border-color: rgba(17,24,39,0.16); }
.btn-sm svg { width: 14px; height: 14px; }
.img-library-btn { align-self: flex-start; }
.img-url-input {
  width: 100%; min-height: 32px; padding: 6px 10px; font-size: 13px;
  background: var(--color-bg-page); border: 1px solid rgba(17,24,39,0.12);
  border-radius: 6px; outline: 0; transition: border-color .15s, box-shadow .15s;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  box-sizing: border-box;
}
.img-url-input:focus { border-color: var(--color-text); box-shadow: 0 0 0 3px rgba(17,24,39,0.06); }
.img-empty { font-size: 12px; }
</style>
