<template>
  <div class="gen-panel">
    <!-- 规格提示 -->
    <p v-if="selectedSpec" class="spec-hint" v-html="t('genpanel.will_generate_spec', { count: count || 0, name: selectedSpec.name, duration: durationLabel(selectedSpec.durationSeconds) })"></p>

    <!-- 区域 1: 生成数量 -->
    <section class="gen-section">
      <div class="gen-section-head">
        <span class="gen-section-num">1</span>
        <h4 class="gen-section-title">{{ t('genpanel.count') }}</h4>
      </div>
      <div class="gen-row-2">
        <div class="field">
          <label>{{ t('genpanel.count') }}<span class="field-tip">{{ t('genpanel.count_tip') }}</span></label>
          <input v-model.number="count" type="number" min="1" max="1000" />
        </div>
        <div class="field">
          <label>{{ t('genpanel.charset') }}</label>
          <select v-model="charset">
            <option value="digits">{{ t('genpanel.charset_digits') }}</option>
            <option value="upper">{{ t('genpanel.charset_upper') }}</option>
            <option value="lower">{{ t('genpanel.charset_lower') }}</option>
            <option value="mixed">{{ t('genpanel.charset_mixed') }}</option>
          </select>
        </div>
      </div>
    </section>

    <!-- 区域 2: 卡密格式设置 -->
    <section class="gen-section">
      <div class="gen-section-head">
        <span class="gen-section-num">2</span>
        <h4 class="gen-section-title">卡密格式设置</h4>
      </div>
      <div class="gen-format-grid">
        <div class="field">
          <label>前缀<span class="field-tip">可留空</span></label>
          <input v-model="prefix" type="text" placeholder="如 DLQ" />
        </div>
        <div class="field">
          <label>分隔符</label>
          <select v-model="separator">
            <option value="-">连字符 ( - )</option>
            <option value=" ">空格</option>
            <option value="">无</option>
          </select>
        </div>
        <div class="field">
          <label>每组位数</label>
          <input v-model.number="groupSize" type="number" min="1" max="32" />
        </div>
        <div class="field">
          <label>组数</label>
          <input v-model.number="groupCount" type="number" min="1" max="16" />
        </div>
      </div>
      <div class="gen-presets">
        <span class="presets-label">快捷模板</span>
        <button type="button" class="chip" @click="applyPreset('4x4')">{{ t('genpanel.preset_4x4') }}</button>
        <button type="button" class="chip" @click="applyPreset('3x4')">{{ t('genpanel.preset_3x4') }}</button>
        <button type="button" class="chip" @click="applyPreset('16')">{{ t('genpanel.preset_16') }}</button>
        <button type="button" class="chip" @click="applyPreset('dlq')">{{ t('genpanel.preset_dlq') }}</button>
        <button type="button" class="chip chip-advanced" @click="applyPreset('dlq_date')">{{ t('genpanel.preset_dlq_date') }}</button>
        <button type="button" class="chip chip-advanced" @click="applyPreset('date_3x4')">{{ t('genpanel.preset_date_3x4') }}</button>
        <button type="button" class="chip chip-advanced" @click="applyPreset('yymm_3x4')">{{ t('genpanel.preset_yymm_3x4') }}</button>
      </div>
    </section>

    <!-- 区域 3: 实时预览 -->
    <section class="gen-section">
      <div class="gen-section-head">
        <span class="gen-section-num">3</span>
        <h4 class="gen-section-title">{{ t('genpanel.preview_label') }}</h4>
      </div>
      <div class="preview-display">
        <code class="preview-code">{{ onePreview }}</code>
      </div>
      <!-- 规则说明 -->
      <div class="rule-legend">
        <span class="rule-tag rule-tag-x">X</span><span class="rule-desc">{{ t('genpanel.rule_x_desc') }}</span>
        <span class="rule-tag rule-tag-y">Y</span><span class="rule-desc">{{ t('genpanel.rule_y_desc') }}</span>
        <span class="rule-tag rule-tag-a">A</span><span class="rule-desc">{{ t('genpanel.rule_a_desc') }}</span>
        <span class="rule-tag rule-tag-time">{YYYYMMDD}</span><span class="rule-desc">{{ t('genpanel.rule_time_desc') }}</span>
      </div>
    </section>

    <!-- 去重开关 -->
    <div class="gen-options">
      <label class="switch-label"><input type="checkbox" v-model="dedup" /><span class="switch" /><span>{{ t('genpanel.auto_dedup') }}</span>
        <span class="dedup-hint">{{ t('genpanel.dedup_hint') }}</span>
      </label>
    </div>

    <!-- 错误/状态提示 -->
    <p v-if="error" class="field-error gen-msg">{{ error }}</p>
    <p v-else-if="overLimit" class="field-error gen-msg">
      {{ t('genpanel.over_limit', { max: formatBigNumber(maxPossible), count }) }}
    </p>
    <p v-else-if="result.length" class="gen-status" v-html="t('genpanel.will_generate', { count: result.length })"></p>

    <!-- 预览列表 -->
    <div v-if="result.length" class="preview-box">
      <div v-for="(c, i) in result.slice(0, 20)" :key="i" class="row">
        <span class="num">#{{ i + 1 }}</span><span class="code">{{ c }}</span>
      </div>
      <div v-if="result.length > 20" class="preview-empty">{{ t('genpanel.more', { count: result.length - 20 }) }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { durationLabel } from '../../composables/useFormat.js';

const { t } = useI18n();
const props = defineProps({
  charsets: { type: Object, required: true },
  durPresets: { type: Array, required: true },
  // 父组件传入当前选中的规格（用于显示生成提示）
  selectedSpec: { type: Object, default: null },
});

const count = ref(50);
const charset = ref('upper');
const template = ref('XXXX-XXXX-XXXX-XXXX');
const dedup = ref(true);
const genNow = ref(new Date());

// 格式构建器状态（驱动 template 的可视化控件）
const prefix = ref('');
const separator = ref('-');
const groupSize = ref(4);
const groupCount = ref(4);

/** 根据构建器参数合成模板字符串 */
function buildTemplateFromBuilder() {
  const sep = separator.value;
  const sz = Math.max(1, Math.min(32, Number(groupSize.value) || 1));
  const gc = Math.max(1, Math.min(16, Number(groupCount.value) || 1));
  const groups = Array.from({ length: gc }, () => 'X'.repeat(sz));
  let tpl = groups.join(sep);
  const pre = prefix.value.trim();
  if (pre) tpl = pre + (sep ? sep : '') + tpl;
  return tpl;
}

/** 快捷模板预设 */
function applyPreset(type) {
  switch (type) {
    case '4x4': prefix.value = ''; separator.value = '-'; groupSize.value = 4; groupCount.value = 4; break;
    case '3x4': prefix.value = ''; separator.value = '-'; groupSize.value = 4; groupCount.value = 3; break;
    case '16': prefix.value = ''; separator.value = ''; groupSize.value = 16; groupCount.value = 1; break;
    case 'dlq': prefix.value = 'DLQ'; separator.value = '-'; groupSize.value = 4; groupCount.value = 3; break;
    // 日期类高级模板直接写入 template（构建器不支持日期 token）
    case 'dlq_date': template.value = 'DLQ-{YYYYMMDD}-XXXX-XXXX'; break;
    case 'date_3x4': template.value = '{YYYYMMDD}-{X4}-{X4}-{X4}'; break;
    case 'yymm_3x4': template.value = '{YYMM}-{X4}-{X4}-{X4}'; break;
  }
}

// 构建器参数变化时同步到 template
watch([prefix, separator, groupSize, groupCount], () => {
  template.value = buildTemplateFromBuilder();
});

/** 暴露给父组件 */
const error = computed(() => {
  const n = Number(count.value); if (!n || n < 1) return t('genpanel.err_count'); if (n > 1000) return t('genpanel.err_max');
  if (!template.value?.trim()) return t('genpanel.err_template');
  if (randomPositions.value === 0) return t('genpanel.err_no_random');
  return '';
});
const overLimit = computed(() => {
  const m = maxPossible.value; if (m === 0n) return false;
  return BigInt(getCount()) > m;
});
function getCount() { return Math.max(0, Number(count.value) || 0); }

// ============================================================
// 模板引擎
// ============================================================
const CHARSETS_MAP = props.charsets;
const DIGITS = '0123456789', LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function pad2(n) { return String(n).padStart(2, '0'); }
function dateTokens(d) {
  return { YYYY: String(d.getFullYear()), YY: String(d.getFullYear()).slice(-2), MM: pad2(d.getMonth() + 1), DD: pad2(d.getDate()), HH: pad2(d.getHours()), MI: pad2(d.getMinutes()), SS: pad2(d.getSeconds()), YYYYMMDD: String(d.getFullYear()) + pad2(d.getMonth() + 1) + pad2(d.getDate()), YYMMDD: String(d.getFullYear()).slice(-2) + pad2(d.getMonth() + 1) + pad2(d.getDate()), YYMM: String(d.getFullYear()).slice(-2) + pad2(d.getMonth() + 1), YYYYMM: String(d.getFullYear()) + pad2(d.getMonth() + 1), };
}

function fillTemplate(tpl, charset, date) {
  const tokens = dateTokens(date);
  let out = tpl.replace(/\{([^}]+)\}/g, (m, inner) => {
    if (!inner) return m;
    if (tokens[inner] !== undefined) return tokens[inner];
    const first = inner[0], len = inner.length;
    if (first === 'X' || first === 'x') return Array.from({ length: len }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
    if (first === 'Y') return Array.from({ length: len }, () => DIGITS[Math.floor(Math.random() * 10)]).join('');
    if (first === 'A' || first === 'a') return Array.from({ length: len }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
    return m;
  });
  return out.split('').map(ch => {
    if (ch === 'X' || ch === 'x') return charset[Math.floor(Math.random() * charset.length)];
    if (ch === 'Y') return DIGITS[Math.floor(Math.random() * 10)];
    if (ch === 'A' || ch === 'a') return LETTERS[Math.floor(Math.random() * LETTERS.length)];
    return ch;
  }).join('');
}

function analyzeTemplate(tpl, charset) {
  const tokenNames = new Set(Object.keys(dateTokens(new Date(0))));
  const c = BigInt(Math.max(1, charset.length)), c10 = BigInt(10), c52 = BigInt(LETTERS.length);
  let positions = 0, possibilities = 1n;
  const re = /\{([^}]+)\}|([XYAxya])/g; let m;
  while ((m = re.exec(tpl)) !== null) {
    if (m[1]) {
      if (tokenNames.has(m[1])) continue;
      const n = m[1].length, first = m[1][0]; positions += n;
      if (first === 'X' || first === 'x') possibilities *= c ** BigInt(n);
      else if (first === 'Y') possibilities *= c10 ** BigInt(n);
      else if (first === 'A' || first === 'a') possibilities *= c52 ** BigInt(n);
    } else { positions += 1; const ch = m[2]; if (ch === 'X' || ch === 'x') possibilities *= c; else if (ch === 'Y') possibilities *= c10; else if (ch === 'A' || ch === 'a') possibilities *= c52; }
  }
  return { positions, possibilities: positions === 0 ? 0n : possibilities };
}
function formatBigNumber(n) {
  if (typeof n !== 'bigint') n = BigInt(n || 0);
  if (n === 0n) return '0'; if (n < 1000n) return String(n);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ============================================================
// 响应式计算
// ============================================================
const currentCharset = computed(() => CHARSETS_MAP[charset.value] || CHARSETS_MAP.upper);
const templateAnalysis = computed(() => analyzeTemplate(template.value, currentCharset.value));
const randomPositions = computed(() => templateAnalysis.value.positions);
const maxPossible = computed(() => templateAnalysis.value.possibilities);
const onePreview = computed(() => fillTemplate(template.value, currentCharset.value, genNow.value));

const result = computed(() => {
  if (error.value) return [];
  const num = Math.min(1000, getCount());
  const chars = currentCharset.value; const t = genNow.value;
  const set = new Set(); const out = [];
  const mp = maxPossible.value;
  let maxGuard = mp === 0n ? num * 10 : mp > BigInt(1000000) ? num * 10 : Number(mp) + Math.ceil(Number(mp) * 0.5);
  let guard = 0;
  while (out.length < num && guard < maxGuard) {
    const c = fillTemplate(template.value, chars, t);
    if (dedup.value) { if (!set.has(c)) { set.add(c); out.push(c); } }
    else { out.push(c); }
    guard++;
  }
  return out;
});

watch([template, charset], () => { genNow.value = new Date(); });

/** 重置为默认值，父组件 openImport 调用 */
function reset() {
  count.value = 50; charset.value = 'upper'; template.value = 'XXXX-XXXX-XXXX-XXXX'; dedup.value = true;
  prefix.value = ''; separator.value = '-'; groupSize.value = 4; groupCount.value = 4;
  genNow.value = new Date();
}

defineExpose({ reset, result, error });
</script>

<style scoped>
.gen-panel { padding: 0; display: flex; flex-direction: column; gap: var(--space-md); }

/* 规格提示 */
.spec-hint { margin: 0; font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; }

/* 分区卡片 */
.gen-section {
  padding: var(--space-lg);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.gen-section-head {
  display: flex; align-items: center; gap: var(--space-sm);
  margin-bottom: var(--space-md);
}
.gen-section-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  background: var(--color-brand); color: var(--color-text-inverse);
  border-radius: var(--radius-full);
  font-size: 12px; font-weight: 600; line-height: 1;
  flex: none;
}
.gen-section-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-text); }

/* 两列行 */
.gen-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }

/* 格式设置四列网格 */
.gen-format-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-md); }

/* 快捷模板 */
.gen-presets { display: flex; align-items: center; gap: var(--space-sm); margin-top: var(--space-md); flex-wrap: wrap; }
.presets-label { font-size: 12px; color: var(--color-text-tertiary); flex: none; }
.chip {
  background: var(--color-bg-page); border: 1px solid var(--color-border-muted);
  padding: 4px 12px; font-size: 12px; border-radius: var(--radius-md);
  cursor: pointer; color: var(--color-brand-dim); font-family: inherit;
  transition: all .15s;
}
.chip:hover { background: var(--color-bg-hover); border-color: var(--color-text-tertiary); }
.chip.chip-advanced { color: var(--color-text-tertiary); border-style: dashed; }

/* 实时预览展示 */
.preview-display {
  padding: var(--space-lg) var(--space-lg);
  background: var(--color-brand);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.preview-code {
  display: block;
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--color-text-inverse);
  word-break: break-all;
  line-height: 1.5;
}

/* 规则说明 */
.rule-legend {
  display: flex; flex-wrap: wrap; gap: var(--space-xs) var(--space-md);
  align-items: center; margin-top: var(--space-md);
  font-size: 12px; color: var(--color-text-secondary);
}
.rule-legend .rule-tag {
  display: inline-flex; align-items: center; height: 20px; padding: 0 6px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size: 11px; font-weight: 600; line-height: 1;
  background: var(--color-bg-page); border: 1px solid var(--color-border-muted); color: var(--color-text);
}
.rule-legend .rule-tag.rule-tag-x { background: var(--color-info-bg); color: var(--color-info); border-color: var(--color-info-bg); }
.rule-legend .rule-tag.rule-tag-y { background: var(--color-warning-bg); color: var(--color-warning); border-color: var(--color-warning-bg); }
.rule-legend .rule-tag.rule-tag-a { background: var(--color-success-bg); color: var(--color-success); border-color: var(--color-success-bg); }
.rule-legend .rule-tag.rule-tag-time { background: var(--color-warning-bg); color: var(--color-warning); border-color: var(--color-warning-bg); }
.rule-legend .rule-desc { color: var(--color-text-secondary); font-size: 11px; }

/* 去重选项 */
.gen-options { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm) 0; }
.dedup-hint { margin-left: var(--space-xs); font-size: 11px; color: var(--color-text-tertiary); }

/* 状态消息 */
.gen-msg { margin: 0; }
.gen-status { margin: 0; font-size: 13px; color: var(--color-text-secondary); }
.gen-status :deep(b) { color: var(--color-text); font-weight: 600; }

/* 预览列表 */
.preview-box {
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  max-height: 220px; overflow: auto;
  font-family: var(--font-mono); font-size: 12px;
}
.preview-box .row {
  padding: var(--space-sm) var(--space-lg);
  border-bottom: 1px dashed var(--color-border);
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm);
}
.preview-box .row:last-child { border-bottom: 0; }
.preview-box .row .num { color: var(--color-text-tertiary); flex: none; }
.preview-box .row .code { color: var(--color-text); word-break: break-all; }
.preview-empty { padding: var(--space-lg); text-align: center; color: var(--color-text-tertiary); font-size: 13px; }

/* 响应式：窄屏下格式网格变为两列 */
@media (max-width: 560px) {
  .gen-row-2 { grid-template-columns: 1fr; }
  .gen-format-grid { grid-template-columns: 1fr 1fr; }
}
</style>
