/**
 * 管理后台 - 卡密管理
 * GET    /api/admin/cards
 * POST   /api/admin/cards/import
 * DELETE /api/admin/cards/:id
 */

const express = require('express');
const { getDb } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');
const { rows, ok, fail, paginate, createLogger, nowISO } = require('../../utils');
const { batchImportCards, deleteCard } = require('../../services/cardService');

const router = express.Router();
const log = createLogger(getDb);

router.get('/cards', authMiddleware, (req, res) => {
  const db = getDb();
  // 强制分页，避免卡密量大时单次返回过多数据
  const page = parseInt(req.query.page) || 1;
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 50, 1), 200);

  // 动态构建 WHERE 条件（支持商品、规格、状态筛选）
  const conditions = ['c.deleted_at IS NULL'];
  const params = [];
  if (req.query.productId) {
    conditions.push('c.product_id = ?');
    params.push(req.query.productId);
  }
  if (req.query.specId) {
    conditions.push('c.spec_id = ?');
    params.push(req.query.specId);
  }
  if (req.query.status) {
    conditions.push('c.status = ?');
    params.push(req.query.status);
  }
  if (req.query.keyword) {
    conditions.push('c.content LIKE ?');
    params.push(`%${req.query.keyword}%`);
  }

  const whereSql = conditions.join(' AND ');
  const baseSql = `
    SELECT c.*, p.name as product_name FROM cards c
    LEFT JOIN products p ON c.product_id = p.id
    WHERE ${whereSql}
    ORDER BY c.created_at DESC
  `;
  const result = paginate(db, baseSql, null, { page, pageSize, params });
  ok(res, { ...result, data: rows(result.data) });
});

router.post('/cards/import', authMiddleware, validate(schemas.importCardsSchema), (req, res) => {
  const { productId, contents, specId, isLoop } = req.body || {};
  if (!productId) return fail(res, '缺少商品ID');
  if (!contents || (!Array.isArray(contents) && !String(contents).trim())) {
    return fail(res, '没有可导入的卡密内容');
  }
  try {
    // 注意：durationSeconds 参数已废弃，卡密时长强制取自规格
    const result = batchImportCards({ productId, specId, contents, isLoop });
    log(req.adminId, req.adminName, 'import_cards', 'cards', productId,
      `导入 ${result.count} 张卡密${isLoop === 1 ? '（循环）' : ''}`, req.ip);
    ok(res, { count: result.count });
  } catch (e) {
    const status = e.message === '商品不存在' ? 404 : 400;
    fail(res, e.message, status);
  }
});

router.delete('/cards/:id', authMiddleware, (req, res) => {
  try {
    deleteCard(req.params.id);
    log(req.adminId, req.adminName, 'delete_card', 'cards', req.params.id, '删除卡密', req.ip);
    ok(res, null);
  } catch (e) {
    const status = e.message === '卡密不存在' ? 404
      : e.message === '已分配的卡密不能删除' ? 409 : 400;
    fail(res, e.message, status);
  }
});

module.exports = router;
