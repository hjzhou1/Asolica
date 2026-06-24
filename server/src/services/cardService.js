/**
 * 卡密业务服务
 * 卡密分配、批量导入、删除、库存查询
 *
 * 阶段二完善：
 * - 集成订单状态机，发卡前校验状态转换合法性
 * - 发卡事务内增加状态条件，防止并发重复发卡
 */

const { getDb } = require('../db');
const { genId, nowISO, row } = require('../utils');
const logger = require('../utils/logger');
const { sendOrderEmail } = require('./emailService');
const { triggerApiHook } = require('./apiHookService');
const { canTransition } = require('./orderStateMachine');

/**
 * 支付成功后自动发卡
 * 分配卡密（事务内 SELECT + UPDATE 带 status='available' 条件，防并发重复分配）
 * 参考独角数卡 OrderProcessService::completedOrder：
 *   - 分配卡密
 *   - 订单状态 → delivered
 *   - 商品销量 +qty（销量统计）
 *   - 发送订单邮件通知
 *   - 触发 API 回调
 * @param {string} orderId - 订单ID
 * @param {Database} [dbInstance] - 可选数据库实例（不传则用单例）
 */
function allocateCards(orderId, dbInstance) {
  const db = dbInstance || getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return;

  // 修复：card_ids 默认 '[]' 字符串恒 truthy，必须 JSON.parse 后判断长度
  let cardIds = [];
  try { cardIds = JSON.parse(order.card_ids || '[]'); } catch { cardIds = []; }
  if (cardIds.length > 0) return; // 已发卡

  // 状态机校验：只有 paid 订单才能发卡（防止 pending/expired 等状态误发）
  if (!canTransition(order.status, 'delivered')) {
    logger.info('发卡跳过：订单状态不允许转换到 delivered', { tag: '发卡', orderNo: order.order_no, status: order.status });
    return;
  }

  // 人工处理商品（manual）：不分配卡密，订单状态保持 paid（待处理）
  // 管理员在后台手动处理完成后，再将订单标记为 delivered
  if (order.type === 'manual') {
    logger.info('人工处理商品订单，跳过自动发卡', { tag: '发卡', orderNo: order.order_no });
    // 人工处理订单也触发 API 回调（参考独角数卡 completedOrder 统一触发）
    triggerApiHook(order);
    return;
  }

  // 分配卡密（事务内 SELECT + UPDATE 带 status='available' 条件，防并发重复分配）
  const assignTxn = db.transaction(() => {
    // 事务内再次校验订单状态（防止并发回调同时进入）
    const currentOrder = db.prepare('SELECT status, card_ids FROM orders WHERE id = ?').get(orderId);
    if (!currentOrder) throw new Error('订单不存在');
    let currentCardIds = [];
    try { currentCardIds = JSON.parse(currentOrder.card_ids || '[]'); } catch { currentCardIds = []; }
    if (currentCardIds.length > 0) return; // 已被其他并发发卡
    if (currentOrder.status !== 'paid') {
      throw new Error(`订单状态为 ${currentOrder.status}，不允许发卡`);
    }

    const picked = db.prepare(`
      SELECT id, is_loop FROM cards WHERE product_id = ? AND spec_id = ? AND status = 'available' AND deleted_at IS NULL
      ORDER BY created_at ASC LIMIT ?
    `).all(order.product_id, order.spec_id, order.qty);

    if (picked.length < order.qty) {
      throw new Error(`库存不足: 订单 ${order.order_no}, 需要 ${order.qty}, 剩余 ${picked.length}`);
    }

    const now = nowISO();
    let assigned = 0;
    const newCardIds = [];
    for (const c of picked) {
      const r = db.prepare(
        "UPDATE cards SET status = 'assigned', order_id = ?, assigned_at = ? WHERE id = ? AND status = 'available'"
      ).run(orderId, now, c.id);
      if (r.changes === 1) {
        assigned++;
        newCardIds.push(c.id);
        // 循环卡密：分配后立即重置为 available，可被后续订单再次分配（参考独角数卡 CarmisService::soldByIDS）
        if (c.is_loop === 1) {
          db.prepare(
            "UPDATE cards SET status = 'available', order_id = NULL, assigned_at = NULL WHERE id = ?"
          ).run(c.id);
        }
      }
    }
    if (assigned < order.qty) {
      throw new Error('卡密被并发占用，请重试');
    }

    // 条件 UPDATE：仅当订单仍为 paid 时才更新为 delivered（并发安全）
    db.prepare("UPDATE orders SET card_ids = ?, status = 'delivered', delivered_at = ?, updated_at = ? WHERE id = ? AND status = 'paid'")
      .run(JSON.stringify(newCardIds), now, now, orderId);
    // 销量统计：订单完成时商品销量 +qty（参考独角数卡 Goods::incrementSalesVolume）
    db.prepare('UPDATE products SET sales_volume = sales_volume + ? WHERE id = ?')
      .run(order.qty, order.product_id);
  });

  // 不再吞掉发卡失败异常：让调用方（paymentService）感知失败并标记订单为 failed
  // 原实现 try-catch + return 会吞掉错误，导致订单卡在 paid 状态未发货
  assignTxn();

  // 发送邮件通知
  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (updatedOrder.email) {
    sendOrderEmail(row(updatedOrder), updatedOrder.email).catch((e) => {
      logger.error('发卡邮件发送失败', { tag: '发卡', error: e.message });
    });
  }

  // 触发 API 回调（参考独角数卡 completedOrder）
  triggerApiHook(updatedOrder);
}

/**
 * 批量导入卡密
 *
 * 设计原则（精修后）：
 * 1. 卡密时长强制取自规格（specInfo.durationSeconds），不再支持 durationSeconds 覆盖参数
 *    - 原因：覆盖会导致"月卡"规格的卡密实际时长被改为 1 小时，引发客诉
 *    - 若需不同时长，应创建不同规格而非覆盖
 * 2. cards.type 字段为"导入时的规格名快照"，仅用于历史数据展示，不参与业务逻辑
 *    - 运行时卡密时长应通过 spec_id JOIN products.card_specs 获取
 *
 * @param {object} params - { productId, specId, contents, isLoop? }
 * @param {number} [params.isLoop] - 可选，1=循环卡密（可重复分配），0=普通
 * @returns {{ count: number }}
 */
function batchImportCards({ productId, specId, contents, isLoop }) {
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL').get(productId);
  if (!product) throw new Error('商品不存在');

  let specInfo = null;
  if (specId) {
    let specs = [];
    try { specs = JSON.parse(product.card_specs || '[]'); } catch { /* ignore */ }
    specInfo = specs.find(s => s.id === specId);
    if (!specInfo) throw new Error('该商品没有这个规格');
  }

  let lines = Array.isArray(contents) ? contents : String(contents)
    .split(/\r?\n|，|,|\s+/g).map(s => s.trim()).filter(Boolean);
  if (!lines.length) throw new Error('没有可导入的卡密内容');

  // 卡密时长强制取自规格，不再支持覆盖
  const finalDuration = specInfo?.durationSeconds || 0;
  // type 字段为规格名快照（仅用于历史数据展示，不参与业务逻辑）
  const specNameSnapshot = specInfo?.name || '';

  const loopFlag = isLoop === 1 ? 1 : 0;
  const ts = nowISO();
  const insert = db.prepare(
    `INSERT INTO cards (id, product_id, spec_id, content, type, duration_seconds, status, is_loop, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?)`
  );

  const importMany = db.transaction((items) => {
    for (const content of items) {
      insert.run(genId('crd'), productId, specId || '', content,
        specNameSnapshot, finalDuration, loopFlag, ts);
    }
  });
  importMany(lines);
  return { count: lines.length };
}

/**
 * 删除卡密（软删除，已分配状态不允许删除）
 * 参考独角数卡 SoftDeletes
 * @param {string} cardId
 */
function deleteCard(cardId) {
  const db = getDb();
  const card = db.prepare('SELECT * FROM cards WHERE id = ? AND deleted_at IS NULL').get(cardId);
  if (!card) throw new Error('卡密不存在');
  if (card.status === 'assigned') throw new Error('已分配的卡密不能删除');
  db.prepare('UPDATE cards SET deleted_at = ? WHERE id = ?').run(nowISO(), cardId);
}

/**
 * 获取卡密库存
 * @param {string} productId
 * @param {string} [specId]
 * @returns {number}
 */
function getCardStock(productId, specId) {
  const db = getDb();
  let sql = "SELECT COUNT(*) as c FROM cards WHERE product_id = ? AND status = 'available' AND deleted_at IS NULL";
  const params = [productId];
  if (specId) { sql += ' AND spec_id = ?'; params.push(specId); }
  return db.prepare(sql).get(...params).c;
}

module.exports = { allocateCards, batchImportCards, deleteCard, getCardStock };
