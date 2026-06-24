/**
 * 订单状态机
 * 参考独角数卡订单状态流转，统一管理所有状态转换
 *
 * 合法状态：pending / paid / delivered / expired / failed / refunded
 * 终态：refunded
 *
 * 设计原则：
 * 1. 所有状态变更必须通过 canTransition / transition 校验
 * 2. 非法转换直接拒绝，防止状态混乱
 * 3. 每个状态有明确的语义，不混用
 */

/**
 * 状态转换规则表
 * key = 当前状态，value = 允许转换到的目标状态集合
 *
 * 注意：本表必须与 config/constants.js 中的 ORDER_TRANSITIONS 保持完全一致
 * 修改任一处时必须同步修改另一处，避免状态机分叉
 */
const TRANSITIONS = {
  // pending → delivered：仅用于 manual 类型商品人工处理完成（auto 类型由系统自动发卡走 pending→paid→delivered）
  pending: ['paid', 'delivered', 'expired', 'failed', 'refunded'],
  paid: ['delivered', 'failed', 'refunded'],
  delivered: ['refunded'],
  expired: ['paid', 'refunded'],      // 过期订单收到有效回调可恢复为 paid
  failed: ['paid', 'refunded'],       // 失败订单收到有效回调可恢复为 paid
  refunded: [],                        // 终态，不可再转换
};

/**
 * 检查状态转换是否合法
 * @param {string} from - 当前状态
 * @param {string} to - 目标状态
 * @returns {boolean}
 */
function canTransition(from, to) {
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

module.exports = {
  TRANSITIONS,
  canTransition,
};
