/**
 * 媒体管理 API（服务端文件上传，替代浏览器 IndexedDB）
 *
 * POST   /api/admin/media/upload   - 上传文件
 * GET    /api/admin/media           - 文件列表
 * DELETE /api/admin/media/:id       - 删除文件
 *
 * 注意：公开访问文件的路由 /api/media/:filename 定义在 app.js 中（无需认证）
 */

/**
 * @swagger
 * tags:
 *   - name: Media
 *     description: 媒体文件管理接口（需 JWT Bearer Token）
 */

const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { handleUpload, listMedia, deleteMedia } = require('../services/mediaService');
const { ok, fail } = require('../utils/response');

const router = express.Router();

/** POST /api/admin/media/upload - 管理员上传文件 */
router.post('/media/upload', authMiddleware, async (req, res) => {
  try {
    const data = await handleUpload(req, res);
    ok(res, data, 201);
  } catch (err) {
    fail(res, err.message, 400);
  }
});

/** GET /api/admin/media - 管理员查看文件列表 */
router.get('/media', authMiddleware, (req, res) => {
  const result = listMedia({ page: req.query.page, pageSize: req.query.pageSize });
  ok(res, result);
});

/** DELETE /api/admin/media/:id - 管理员删除文件 */
router.delete('/media/:id', authMiddleware, (req, res) => {
  try {
    deleteMedia(req.params.id);
    ok(res, null);
  } catch (err) {
    fail(res, err.message, 404);
  }
});

module.exports = router;
