/**
 * 管理后台 - 操作日志查询
 * GET /api/admin/logs
 */

const express = require('express');
const { getDb } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { rows, paginate, ok } = require('../../utils');

const router = express.Router();

router.get('/logs', authMiddleware, (req, res) => {
  const db = getDb();
  const baseSql = 'SELECT * FROM operation_logs ORDER BY created_at DESC';
  if (req.query.page) {
    const result = paginate(db, baseSql, null, {
      page: req.query.page, pageSize: req.query.pageSize, params: [],
    });
    result.data = rows(result.data);
    return ok(res, result);
  }
  ok(res, rows(db.prepare(baseSql).all()));
});

module.exports = router;
