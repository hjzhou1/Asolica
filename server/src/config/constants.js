/**
 * 全局常量集中定义
 * 状态机转换、邮件重试、上传限制、JWT、卡密时长预设等
 */

// 订单状态机：合法的状态转换
// 直接复用 orderStateMachine.js 的 TRANSITIONS，避免两处定义分叉
// failed → paid / expired → paid：支付回调延迟到达时允许恢复（参考独角数卡补单逻辑）
// pending → delivered：仅用于 manual 类型商品人工处理完成（auto 类型由系统自动发卡走 pending→paid→delivered）
const { TRANSITIONS: ORDER_TRANSITIONS } = require('../services/orderStateMachine');

// 邮件队列最大重试次数
const EMAIL_MAX_ATTEMPTS = 5;

// 前台单次下单最大数量
const MAX_QTY = 50;

// 文件上传限制
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// 允许上传的 MIME 类型
const ALLOWED_UPLOAD_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

// MIME 类型与扩展名映射
const MIME_EXT_MAP = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
};

// 管理员账户锁定阈值
const ADMIN_LOCK_THRESHOLD = 5; // 失败 5 次锁定
const ADMIN_LOCK_MINUTES = 15;  // 锁定 15 分钟

// JWT 配置
const JWT_EXPIRES = '4h';
const JWT_ALGORITHMS = ['HS256'];

// 掩码占位符（敏感字段脱敏）
const MASK_PLACEHOLDER = '********';

/**
 * 卡密时长预设（统一前后端使用）
 * value: 秒数，0 表示永久
 * key: 唯一标识，用于前后端数据交换
 * label: 中文标签
 */
const DURATION_PRESETS = [
  { value: 0, key: 'forever', label: '永久' },
  { value: 3600, key: '1h', label: '1小时' },
  { value: 21600, key: '6h', label: '6小时' },
  { value: 86400, key: '1d', label: '1天（天卡）' },
  { value: 604800, key: '7d', label: '7天（周卡）' },
  { value: 2592000, key: '30d', label: '30天（月卡）' },
  { value: 7776000, key: '90d', label: '90天（季卡）' },
  { value: 31536000, key: '365d', label: '365天（年卡）' },
];

module.exports = {
  ORDER_TRANSITIONS,
  EMAIL_MAX_ATTEMPTS,
  MAX_QTY,
  MAX_FILE_SIZE,
  ALLOWED_UPLOAD_MIMES,
  MIME_EXT_MAP,
  ADMIN_LOCK_THRESHOLD,
  ADMIN_LOCK_MINUTES,
  JWT_EXPIRES,
  JWT_ALGORITHMS,
  MASK_PLACEHOLDER,
  DURATION_PRESETS,
};
