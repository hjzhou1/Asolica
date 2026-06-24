/**
 * 卡密数据访问层
 * 所有 cards 表查询集中到这里
 */

function countAvailable(db, productId, specId) {
  let sql = `
    SELECT COUNT(*) as c FROM cards
    WHERE product_id = ? AND status = 'available' AND deleted_at IS NULL
  `;
  const params = [productId];
  if (specId) {
    sql += ' AND spec_id = ?';
    params.push(specId);
  }
  return db.prepare(sql).get(...params).c;
}

function countAvailableLoop(db, productId, specId) {
  let sql = `
    SELECT COUNT(*) as c FROM cards
    WHERE product_id = ? AND spec_id = ? AND is_loop = 1
      AND status = 'available' AND deleted_at IS NULL
  `;
  return db.prepare(sql).get(productId, specId).c;
}

function pickAvailable(db, productId, specId, limit) {
  return db.prepare(`
    SELECT id, is_loop FROM cards
    WHERE product_id = ? AND spec_id = ? AND status = 'available' AND deleted_at IS NULL
    ORDER BY created_at ASC LIMIT ?
  `).all(productId, specId, limit);
}

function assignCard(db, cardId, orderId, now) {
  return db.prepare(
    "UPDATE cards SET status = 'assigned', order_id = ?, assigned_at = ? WHERE id = ? AND status = 'available'"
  ).run(orderId, now, cardId);
}

function resetLoopCard(db, cardId) {
  db.prepare(
    "UPDATE cards SET status = 'available', order_id = NULL, assigned_at = NULL WHERE id = ?"
  ).run(cardId);
}

function getCardsByIds(db, ids) {
  if (!ids || ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`SELECT content FROM cards WHERE id IN (${placeholders})`).all(...ids);
}

function getCardById(db, id) {
  return db.prepare('SELECT is_loop FROM cards WHERE id = ?').get(id);
}

module.exports = {
  countAvailable,
  countAvailableLoop,
  pickAvailable,
  assignCard,
  resetLoopCard,
  getCardsByIds,
  getCardById,
};
