/**
 * 商品数据访问层
 * 所有 products 表查询集中到这里，路由/服务层不再直接写 SQL
 */

function getProductById(db, id) {
  return db.prepare('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL').get(id);
}

function getActiveProductById(db, id) {
  return db.prepare(
    "SELECT * FROM products WHERE id = ? AND status = 'on' AND deleted_at IS NULL"
  ).get(id);
}

function incrementSalesVolume(db, productId, qty) {
  db.prepare('UPDATE products SET sales_volume = sales_volume + ? WHERE id = ?')
    .run(qty, productId);
}

module.exports = {
  getProductById,
  getActiveProductById,
  incrementSalesVolume,
};
