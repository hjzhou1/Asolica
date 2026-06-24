/**
 * 站点设置缓存服务
 *
 * 问题：site_settings 表被高频读取（每个前台请求都查公告、订单配置等），
 * 原实现每次请求都查库，造成不必要的 IO。
 *
 * 方案：进程内缓存 + TTL（60秒）+ 主动失效（写入时调用 invalidate）。
 * 不用 Map 缓存全部 key 是因为 site_settings 的 key 集合是开放的，
 * 按需缓存更安全。
 */

const { getDb } = require('../db');

const CACHE_TTL_MS = 60 * 1000; // 60 秒
const cache = new Map(); // key → { value, expireAt }

/**
 * 读取 site_settings 中的某个 key（带缓存）
 * @param {string} key
 * @param {string} [def=''] - 默认值（key 不存在时返回）
 * @returns {string}
 */
function getSetting(key, def = '') {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expireAt > now) {
    return hit.value === null ? def : hit.value;
  }
  const db = getDb();
  const r = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key);
  const value = r?.value ?? null;
  cache.set(key, { value, expireAt: now + CACHE_TTL_MS });
  return value === null ? def : value;
}

/**
 * 读取布尔型设置
 * @param {string} key
 * @returns {boolean}
 */
function getBool(key) {
  return getSetting(key) === '1';
}

/**
 * 失效指定 key 的缓存（写入/更新设置后调用）
 * @param {string} key
 */
function invalidate(key) {
  cache.delete(key);
}

/**
 * 失效全部缓存（批量更新设置后调用）
 */
function invalidateAll() {
  cache.clear();
}

module.exports = { getSetting, getBool, invalidate, invalidateAll };
