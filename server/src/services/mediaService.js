/**
 * 媒体文件业务服务
 * 文件上传、列表、删除、访问
 */

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const multer = require('multer');
const { getDb } = require('../db');
const { genId, row, rows, paginate, nowISO } = require('../utils');
const config = require('../config/env');
const {
  MAX_FILE_SIZE,
  ALLOWED_UPLOAD_MIMES,
  MIME_EXT_MAP,
} = require('../config/constants');

const UPLOAD_DIR = config.uploadsDir;

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // 扩展名从 MIME 类型推导，不信任客户端上传的 originalname 扩展名
    const exts = MIME_EXT_MAP[file.mimetype];
    const ext = (exts && exts[0]) || '.bin';
    const name = `${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_UPLOAD_MIMES.includes(file.mimetype)) {
      return cb(new Error('不支持的文件类型，仅允许 JPEG/PNG/GIF/WebP'));
    }
    // 二次校验：通过文件头魔数验证真实类型（防止伪造 MIME）
    cb(null, true);
  },
});

/** 通过文件头魔数校验真实文件类型，防止伪造 MIME 绕过 */
function validateMagicBytes(buf, mimetype) {
  if (buf.length < 4) return false;
  // JPEG: FF D8 FF
  if (mimetype === 'image/jpeg') return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  // PNG: 89 50 4E 47
  if (mimetype === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  // GIF: 47 49 46 38
  if (mimetype === 'image/gif') return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50 (RIFF....WEBP)
  if (mimetype === 'image/webp') {
    return buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
      && buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  }
  return false;
}

/**
 * 上传文件（multer 中间件 + 魔数校验 + 入库）
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
function handleUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.single('file')(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return reject(new Error('文件过大，最大支持 5MB'));
        }
        return reject(new Error(`上传失败: ${err.message}`));
      }
      if (err) {
        return reject(err);
      }
      if (!req.file) {
        return reject(new Error('请选择要上传的文件'));
      }

      // 魔数校验：异步读取文件头验证真实类型，避免阻塞事件循环
      try {
        const buf = await fsp.readFile(req.file.path);
        if (!validateMagicBytes(buf, req.file.mimetype)) {
          // 删除不合规文件
          try { await fsp.unlink(req.file.path); } catch (_) { /* ignore */ }
          return reject(new Error('文件内容与类型不匹配，疑似伪造文件'));
        }
      } catch (e) {
        // 读取失败：删除文件并拒绝
        try { await fsp.unlink(req.file.path); } catch (_) { /* ignore */ }
        return reject(new Error('文件校验失败'));
      }

      const id = genId('media');
      const db = getDb();
      const now = nowISO();
      db.prepare(`
        INSERT INTO media_files (id, filename, original_name, mime_type, size, path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, req.file.filename, now);

      resolve({
        id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: `/api/media/${req.file.filename}`,
      });
    });
  });
}

/**
 * 获取文件列表（支持分页）
 * @param {object} options - { page, pageSize }
 */
function listMedia({ page, pageSize } = {}) {
  const db = getDb();
  const baseSql = 'SELECT * FROM media_files ORDER BY created_at DESC';
  if (page) {
    const result = paginate(db, baseSql, null, { page, pageSize, params: [] });
    result.data = rows(result.data).map(normalizeMediaRow);
    return result;
  }
  return rows(db.prepare(baseSql).all()).map(normalizeMediaRow);
}

/** 补充 url 字段，统一返回格式 */
function normalizeMediaRow(r) {
  return {
    ...r,
    url: `/api/media/${r.filename}`,
  };
}

/**
 * 删除文件（同时删除磁盘文件和数据库记录）
 * @param {string} id
 */
function deleteMedia(id) {
  const db = getDb();
  const file = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id);
  if (!file) throw new Error('文件不存在');

  // 删除磁盘文件
  const filePath = path.join(UPLOAD_DIR, file.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM media_files WHERE id = ?').run(id);
}

/**
 * 公开访问文件（返回文件路径与真实 MIME 类型）
 * @param {string} filename
 * @returns {{ filePath, mimeType } | null}
 */
function getMediaFile(filename) {
  const safeFilename = path.basename(filename); // 防止路径遍历
  const filePath = path.join(UPLOAD_DIR, safeFilename);
  if (!fs.existsSync(filePath)) return null;
  const db = getDb();
  const record = db.prepare('SELECT mime_type FROM media_files WHERE filename = ?').get(safeFilename);
  const mimeType = record ? record.mime_type : 'application/octet-stream';
  return { filePath, mimeType };
}

module.exports = { handleUpload, listMedia, deleteMedia, getMediaFile, UPLOAD_DIR };
