/**
 * 敏感字段掩码工具（消除 routes/settings.js 与 routes/payment.js 的重复）
 */

const { MASK_PLACEHOLDER } = require('../config/constants');

// 敏感字段键（不同 adapter 的密钥字段名，统一维护）
const SECRET_FIELDS = ['app_secret', 'key', 'token', 'secret', 'private_key'];

/**
 * 对配置对象中的敏感字段脱敏
 * @param {object} config - 配置对象
 * @returns {object} 脱敏后的新对象
 */
function maskConfig(config) {
  if (!config || typeof config !== 'object') return config;
  const masked = { ...config };
  for (const f of SECRET_FIELDS) {
    if (masked[f] && typeof masked[f] === 'string' && masked[f].length > 0) {
      masked[f] = masked[f].length <= 4 ? MASK_PLACEHOLDER : MASK_PLACEHOLDER + masked[f].slice(-4);
    }
  }
  return masked;
}

/**
 * 对单个敏感字段值脱敏
 * @param {string} value
 * @returns {string}
 */
function maskValue(value) {
  if (!value || typeof value !== 'string') return '';
  if (value.length <= 4) return MASK_PLACEHOLDER;
  return MASK_PLACEHOLDER + value.slice(-4);
}

/**
 * 判断值是否为掩码（前端未修改敏感字段时回传的占位符）
 * @param {string|object} value
 * @returns {boolean}
 */
function isMaskedValue(value) {
  if (typeof value === 'string') {
    return value === MASK_PLACEHOLDER || value.startsWith(MASK_PLACEHOLDER);
  }
  if (value && typeof value === 'object') {
    return SECRET_FIELDS.some(f =>
      value[f] && typeof value[f] === 'string' &&
      (value[f] === MASK_PLACEHOLDER || value[f].startsWith(MASK_PLACEHOLDER))
    );
  }
  return false;
}

module.exports = {
  SECRET_FIELDS,
  MASK_PLACEHOLDER,
  maskConfig,
  maskValue,
  isMaskedValue,
};
