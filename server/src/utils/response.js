/**
 * 统一响应与数据库行转换工具
 */

/** 数据库行 → camelCase 对象 */
function row(r) {
  if (!r) return null;
  const obj = {};
  for (const [k, v] of Object.entries(r)) {
    const key = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (['cardSpecs', 'cardIds'].includes(key)) {
      try { obj[key] = JSON.parse(v || '[]'); } catch { obj[key] = v || []; }
    } else { obj[key] = v; }
  }
  return obj;
}

/** 数据库行数组 → camelCase 对象数组 */
function rows(arr) {
  return (arr || []).map(row);
}

/** ISO 时间字符串（统一使用上海时区 +08:00，避免 UTC 与本地时间混用） */
function nowISO() {
  return nowISOFromDate(new Date());
}

/**
 * 将任意 Date 转为上海时区 ISO 字符串（+08:00）
 * @param {Date} d
 * @returns {string}
 */
function nowISOFromDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const pad3 = (n) => String(n).padStart(3, '0');
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t)?.value || '';
  const ms = pad3(d.getMilliseconds());
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.${ms}+08:00`;
}

/**
 * 当前时间 + 指定毫秒数的上海时区 ISO 字符串
 * 用于计算 expires_at 等未来时间，确保与 nowISO() 格式完全一致
 * @param {number} addMs - 增加的毫秒数
 * @returns {string}
 */
function nowISOPlus(addMs) {
  return nowISOFromDate(new Date(Date.now() + addMs));
}

/** 统一成功响应 */
function ok(res, data, status = 200) {
  res.status(status).json({ ok: true, data: data ?? null });
}

/** 统一失败响应 */
function fail(res, message, status = 400) {
  res.status(status).json({ ok: false, message });
}

/**
 * 分页查询助手
 * @param {Database} db
 * @param {string} baseSql - SELECT ... FROM ...
 * @param {string} countSql - SELECT COUNT(*) as total FROM ... (可选，默认自动生成)
 * @param {object} options - { page, pageSize, maxPageSize, params }
 * @returns {{ data, total, page, pageSize, totalPages }}
 */
function paginate(db, baseSql, countSql, { page = 1, pageSize = 20, maxPageSize = 100, params = [] } = {}) {
  const p = Math.max(1, parseInt(page) || 1);
  const ps = Math.min(maxPageSize, Math.max(1, parseInt(pageSize) || 20));
  const offset = (p - 1) * ps;

  // 自动生成 countSql
  let countQuery = countSql;
  if (!countQuery) {
    // 把 SELECT ... FROM 替换为 SELECT COUNT(*) as total FROM
    countQuery = baseSql.replace(/SELECT\s+.*?\s+FROM/i, 'SELECT COUNT(*) as total FROM');
  }

  const { total } = db.prepare(countQuery).get(...params);
  const data = db.prepare(`${baseSql} LIMIT ? OFFSET ?`).all(...params, ps, offset);

  return {
    data,
    total: Number(total),
    page: p,
    pageSize: ps,
    totalPages: Math.ceil(Number(total) / ps),
  };
}

module.exports = { row, rows, nowISO, nowISOFromDate, nowISOPlus, ok, fail, paginate };
