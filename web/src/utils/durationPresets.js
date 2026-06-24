/**
 * 卡密时长预设（与后端 server/src/config/constants.js 保持一致）
 *
 * 通过 /api/public/constants 接口动态获取，或直接导入此静态常量。
 * 前后端共享，确保三处（Products.vue 规格编辑、Cards.vue 导入覆盖、Cards.vue 生成器）一致。
 */
export const DURATION_PRESETS = [
  { value: 0, key: 'forever', label: '永久' },
  { value: 3600, key: '1h', label: '1小时' },
  { value: 21600, key: '6h', label: '6小时' },
  { value: 86400, key: '1d', label: '1天（天卡）' },
  { value: 604800, key: '7d', label: '7天（周卡）' },
  { value: 2592000, key: '30d', label: '30天（月卡）' },
  { value: 7776000, key: '90d', label: '90天（季卡）' },
  { value: 31536000, key: '365d', label: '365天（年卡）' },
];
