/**
 * ID 与订单号生成
 */

const crypto = require('crypto');

/** 生成安全的随机 ID */
function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * 生成订单号
 * 格式：YYYYMMDD-XXXXXXXX（8位hex，43亿种可能，碰撞概率极低）
 * 日期部分统一使用上海时区（Asia/Shanghai），避免 UTC 0-8 点生成"昨天"前缀
 * 配合数据库 UNIQUE 约束，碰撞时由调用方重试
 */
function genOrderNo() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t)?.value || '';
  const ymd = `${get('year')}${get('month')}${get('day')}`;
  return `${ymd}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

module.exports = { genId, genOrderNo };
