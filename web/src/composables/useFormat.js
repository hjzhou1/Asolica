/**
 * 统一格式化工具集
 * 所有页面共用，消除重复定义
 */

import i18n from '../i18n.js';

/**
 * 将时间字符串标准化为 Date 对象
 * 处理两种格式：
 * 1. ISO 带时区：'2026-06-23T14:30:00.000+08:00' → 直接解析
 * 2. UTC 无时区标记：'2026-06-22 22:30:00' → 视为 UTC，补 'Z' 后解析
 */
function parseDate(iso) {
  if (!iso) return null;
  let str = String(iso).trim();
  // 'YYYY-MM-DD HH:MM:SS' 格式（无 T、无时区标记）→ 视为 UTC
  if (str.includes(' ') && !str.includes('T') && !str.endsWith('Z') && !str.includes('+', 10)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

/** 用上海时区格式化为 "YYYY-MM-DD HH:MM" */
export function formatTime(iso) {
  const d = parseDate(iso);
  if (!d) return '—';
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/** 用上海时区格式化为 "YYYY-MM-DD" */
export function formatDate(iso) {
  const d = parseDate(iso);
  if (!d) return '—';
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** "2026-06-16 12:34" （别名，与 store.js 导出一致） */
export function formatDateTime(iso) { return formatTime(iso); }

/** ¥ 12.00 */
export function formatPrice(n) {
  return (Number(n) || 0).toFixed(2);
}

/** ¥ 1,234.56 */
export function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "1.5 KB" / "2.3 MB" */
export function formatSize(b) {
  if (!b) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

// ============================================================
// 通用工具
// ============================================================

/** 复制文本到剪贴板 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 计算卡密到期时间 */
export function getCardExpiry(card) {
  if (!card) return null;
  if (card.status !== 'assigned') return null;
  const sec = Number(card.durationSeconds) || 0;
  if (sec <= 0) return null;
  const base = card.assignedAt ? new Date(card.assignedAt) : new Date();
  if (isNaN(base)) return null;
  return new Date(base.getTime() + sec * 1000).toISOString();
}

/** 时长秒数 → 本地化标签 */
export function durationLabel(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const t = i18n.global.t;
  if (s <= 0) return t('common.duration_forever');
  if (s < 60) return t('common.duration_seconds', { s });
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? t('common.duration_minutes_seconds', { m, s: r }) : t('common.duration_minutes', { m });
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const r = s % 3600;
    if (!r) return t('common.duration_hours', { h });
    const m = Math.floor(r / 60);
    return m ? t('common.duration_hours_minutes', { h, m }) : t('common.duration_hours_seconds', { h, r });
  }
  const d = Math.floor(s / 86400);
  const r = s % 86400;
  if (!r) return t('common.duration_days', { d });
  const h = Math.floor(r / 3600);
  return h ? t('common.duration_days_hours', { d, h }) : t('common.duration_days', { d });
}
