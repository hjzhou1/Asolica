/**
 * @swagger
 * tags:
 *   - name: Public
 *     description: 前台公开接口
 */

/**
 * 前台公开 API - 商品/分类/库存查询
 */

const express = require('express');
const { getDb } = require('../db');
const { row, rows, ok, fail } = require('../utils');
const { getCardStock } = require('../services/cardService');

const router = express.Router();

/** GET /api/public/products - 在售商品（含分类名 + 库存数，支持搜索/排序） */
/**
 * @swagger
 * /public/products:
 *   get:
 *     tags: [Public]
 *     summary: 获取在售商品列表
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜索关键词
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [newest, oldest, price_asc, price_desc, name]
 *         description: 排序方式
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: 分类筛选
 *     responses:
 *       200:
 *         description: 商品列表
 */
router.get('/products', (req, res) => {
  try {
    const db = getDb();
    const { search, sortBy = 'newest', categoryId } = req.query;

    let sql = `
      SELECT p.*, c.name as category_name FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status != 'off' AND p.deleted_at IS NULL
    `;
    const params = [];

    if (search) {
      sql += ' AND p.name LIKE ?';
      params.push(`%${search}%`);
    }
    if (categoryId) {
      sql += ' AND p.category_id = ?';
      params.push(categoryId);
    }

    // 排序：参考独角数卡，支持 ord 权重 + 销量 + 价格 + 时间
    const sortMap = {
      newest: 'p.created_at DESC',
      oldest: 'p.created_at ASC',
      price_asc: "CAST(json_extract(p.card_specs, '$[0].price') AS REAL) ASC",
      price_desc: "CAST(json_extract(p.card_specs, '$[0].price') AS REAL) DESC",
      name: 'p.name ASC',
      sales: 'p.sales_volume DESC',           // 按销量降序
      ord: 'p.ord DESC, p.created_at DESC',   // 按权重
    };
    sql += ` ORDER BY ${sortMap[sortBy] || sortMap.newest}`;

    const products = db.prepare(sql).all(...params);

    // 批量查询库存（消除 N+1：原实现循环内逐个查 COUNT）
    const autoProductIds = products.filter(p => p.type !== 'manual').map(p => p.id);
    const stockMap = new Map();
    if (autoProductIds.length > 0) {
      const placeholders = autoProductIds.map(() => '?').join(',');
      const stockRows = db.prepare(
        `SELECT product_id, COUNT(*) as count FROM cards WHERE product_id IN (${placeholders}) AND status = 'available' AND deleted_at IS NULL GROUP BY product_id`
      ).all(...autoProductIds);
      for (const r of stockRows) stockMap.set(r.product_id, r.count);
    }

    const result = rows(products).map(p => {
      // 安全：不向前台暴露敏感字段 apiHook（参考独角数卡前台不返回 api_hook）
      const { apiHook, ...safe } = p;
      // manual 类型商品人工处理，不依赖卡密库存，标记为无限库存
      const isManual = p.type === 'manual';
      const count = isManual ? -1 : (stockMap.get(p.id) || 0);
      // 计算最低价格用于前台展示
      let minPrice = null;
      try {
        const specs = JSON.parse(p.cardSpecs || '[]');
        const prices = specs.filter(s => s.status !== 'off').map(s => Number(s.price)).filter(n => !isNaN(n));
        if (prices.length) minPrice = Math.min(...prices).toFixed(2);
      } catch { /* ignore */ }
      return { ...safe, stock: count, minPrice };
    });

    ok(res, result);
  } catch (error) {
    fail(res, '查询商品失败', 500);
  }
});

/** GET /api/public/products/:id - 单个商品详情（含库存） */
/**
 * @swagger
 * /public/products/{id}:
 *   get:
 *     tags: [Public]
 *     summary: 获取商品详情
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: 商品ID
 *     responses:
 *       200:
 *         description: 商品详情（含库存数）
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 name: { type: string }
 *                 status: { type: string, enum: [on, off] }
 *                 desc: { type: string }
 *                 image: { type: string }
 *                 content: { type: string, description: 商品详情(HTML) }
 *                 cardSpecs:
 *                   type: array
 *                   description: 卡密规格列表
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       durationSeconds: { type: integer }
 *                       price: { type: number }
 *                       status: { type: string, enum: [on, off] }
 *                 categoryName: { type: string }
 *                 stock: { type: integer, description: 可用库存数 }
 *       404:
 *         description: 商品不存在
 *       500:
 *         description: 查询商品失败
 */
router.get('/products/:id', (req, res) => {
  try {
    const db = getDb();
    const product = db.prepare(`
      SELECT p.*, c.name as category_name FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.deleted_at IS NULL
    `).get(req.params.id);

    if (!product) {
      return fail(res, '商品不存在', 404);
    }

    const stockCount = { count: getCardStock(product.id) };

    // 安全：不向前台暴露 apiHook
    const { apiHook, ...safeProduct } = row(product);
    // manual 类型商品不依赖卡密库存，标记为无限库存
    const isManual = product.type === 'manual';
    ok(res, { ...safeProduct, stock: isManual ? -1 : (stockCount?.count || 0) });
  } catch (error) {
    fail(res, '查询商品失败', 500);
  }
});

/** GET /api/public/categories - 启用分类 */
/**
 * @swagger
 * /public/categories:
 *   get:
 *     tags: [Public]
 *     summary: 获取启用的分类列表
 *     description: 仅返回 enabled != 0 的分类，按 sort 升序、created_at 升序排列
 *     responses:
 *       200:
 *         description: 分类列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   name: { type: string }
 *                   sort: { type: integer }
 *                   enabled: { type: integer }
 *                   desc: { type: string }
 *                   image: { type: string }
 *       500:
 *         description: 查询分类失败
 */
router.get('/categories', (req, res) => {
  try {
    const db = getDb();
    const categories = db.prepare(
      'SELECT * FROM categories WHERE enabled != 0 AND deleted_at IS NULL ORDER BY sort ASC, created_at ASC'
    ).all();
    ok(res, rows(categories));
  } catch (error) {
    fail(res, '查询分类失败', 500);
  }
});

/** GET /api/public/stock?productId=&specId= - 库存查询 */
/**
 * @swagger
 * /public/stock:
 *   get:
 *     tags: [Public]
 *     summary: 查询商品库存
 *     parameters:
 *       - in: query
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *         description: 商品ID
 *       - in: query
 *         name: specId
 *         schema: { type: string }
 *         description: 规格ID（可选，传入则只统计该规格库存）
 *     responses:
 *       200:
 *         description: 库存数量
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 count: { type: integer, description: 可用卡密数 }
 *       400:
 *         description: 缺少 productId 参数
 *       500:
 *         description: 查询库存失败
 */
router.get('/stock', (req, res) => {
  try {
    const { productId, specId } = req.query;
    if (!productId) {
      return fail(res, '缺少 productId 参数', 400);
    }
    const db = getDb();
    const product = db.prepare("SELECT type FROM products WHERE id = ? AND deleted_at IS NULL").get(productId);
    if (!product) {
      return fail(res, '商品不存在', 404);
    }
    // manual 类型商品人工处理，不依赖卡密库存，标记为无限库存
    if (product.type === 'manual') {
      return ok(res, { count: -1 });
    }
    const count = getCardStock(productId, specId);
    const result = { count };
    ok(res, { count: result?.count || 0 });
  } catch (error) {
    fail(res, '查询库存失败', 500);
  }
});

/** GET /api/public/announcement - 获取站点公告 */
/**
 * @swagger
 * /public/announcement:
 *   get:
 *     tags: [Public]
 *     summary: 获取站点公告
 *     responses:
 *       200:
 *         description: 站点公告
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 value: { type: string, description: 公告内容（无则空字符串） }
 */
router.get('/announcement', (_req, res) => {
  const { getSetting } = require('../services/settingsService');
  const value = getSetting('site.announcement');
  ok(res, { value: value || '' });
});

/** GET /api/public/site-info - 获取站点基本信息（名称、描述等） */
router.get('/site-info', (_req, res) => {
  const { getSetting } = require('../services/settingsService');
  ok(res, {
    name: getSetting('site.name') || 'Asolica',
    description: getSetting('site.description') || '',
    announcement: getSetting('site.announcement') || '',
  });
});

/** GET /api/public/order-config - 订单查询配置（是否需要查询密码） */
router.get('/order-config', (_req, res) => {
  const { getBool } = require('../services/settingsService');
  ok(res, { searchPwdEnabled: getBool('order.search_pwd_enabled') });
});

/** GET /api/public/constants - 前端共享常量（如卡密时长预设） */
router.get('/constants', (_req, res) => {
  const { DURATION_PRESETS } = require('../config/constants');
  ok(res, { durationPresets: DURATION_PRESETS });
});

module.exports = router;
