/**
 * 管理后台 - 分类 CRUD
 * GET    /api/admin/categories
 * POST   /api/admin/categories
 * PUT    /api/admin/categories/:id
 * DELETE /api/admin/categories/:id
 */

const express = require('express');
const { getDb } = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');
const { genId, row, rows, ok, fail, createLogger, nowISO } = require('../../utils');

const router = express.Router();
const log = createLogger(getDb);

router.get('/categories', authMiddleware, (req, res) => {
  const db = getDb();
  ok(res, rows(db.prepare('SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort ASC, created_at DESC').all()));
});

router.post('/categories', authMiddleware, validate(schemas.createCategorySchema), (req, res) => {
  const { name, sort = 0, enabled = true, desc = '', image = '' } = req.body || {};
  if (!name?.trim()) return fail(res, '分类名称不能为空');
  const db = getDb();
  const item = {
    id: genId('cat'), name: String(name).trim(), sort: Number(sort) || 0,
    enabled: enabled !== false ? 1 : 0, desc: String(desc || ''), image: String(image || ''),
  };
  const now = nowISO();
  db.prepare('INSERT INTO categories (id, name, sort, enabled, desc, image, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(item.id, item.name, item.sort, item.enabled, item.desc, item.image, now, now);
  log(req.adminId, req.adminName, 'create_category', 'category', item.id, `创建分类: ${item.name}`, req.ip);
  const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(item.id);
  ok(res, row(created), 201);
});

router.put('/categories/:id', authMiddleware, validate(schemas.updateCategorySchema), (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM categories WHERE id = ? AND deleted_at IS NULL').get(req.params.id)) {
    return fail(res, '分类不存在', 404);
  }
  const patch = req.body || {};
  const fields = [], values = [];
  if (patch.name !== undefined) { fields.push('name = ?'); values.push(String(patch.name).trim()); }
  if (patch.sort !== undefined) { fields.push('sort = ?'); values.push(Number(patch.sort) || 0); }
  if (patch.enabled !== undefined) { fields.push('enabled = ?'); values.push(patch.enabled ? 1 : 0); }
  if (patch.desc !== undefined) { fields.push('desc = ?'); values.push(String(patch.desc)); }
  if (patch.image !== undefined) { fields.push('image = ?'); values.push(String(patch.image)); }
  fields.push('updated_at = ?');
  values.push(nowISO());
  values.push(req.params.id);
  db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  log(req.adminId, req.adminName, 'update_category', 'category', req.params.id, '更新分类', req.ip);
  ok(res, null);
});

router.delete('/categories/:id', authMiddleware, (req, res) => {
  const db = getDb();
  // 软删除：仅标记 deleted_at
  if (!db.prepare('SELECT id FROM categories WHERE id = ? AND deleted_at IS NULL').get(req.params.id)) {
    return fail(res, '分类不存在', 404);
  }
  if (db.prepare('SELECT id FROM products WHERE category_id = ? AND deleted_at IS NULL LIMIT 1').get(req.params.id)) {
    return fail(res, '该分类下还有商品，请先删除商品', 409);
  }
  const now = nowISO();
  db.prepare('UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, req.params.id);
  log(req.adminId, req.adminName, 'delete_category', 'category', req.params.id, '删除分类(软删除)', req.ip);
  ok(res, null);
});

module.exports = router;
