/**
 * Asolica 数字商品发卡平台 - 后端服务
 * Node.js + Express + SQLite
 *
 * 重构后入口：使用 config/ 集中配置，db/ 拆分迁移，services/ 提取业务逻辑
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');

const config = require('./config/env');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/error');
const requestId = require('./middleware/requestId');
const {
  publicReadLimiter,
  orderCreateLimiter,
  paymentCreateLimiter,
  paymentStatusLimiter,
  orderQueryLimiter,
  adminLimiter,
  loginLimiter,
} = require('./middleware/rateLimit');

const adminRoutes = require('./routes/admin/index');
const storeRoutes = require('./routes/shop/store');
const orderRoutes = require('./routes/shop/order');
const publicRoutes = require('./routes/public');
const mediaRoutes = require('./routes/media');
const { shopRouter: paymentShopRoutes, callbackRouter: paymentCallbackRoutes, adminRouter: paymentAdminRoutes } = require('./routes/payment');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = config.port;

// 启动时初始化数据库并执行迁移（schema_version 版本追踪）
// getDb() 内部调用 runMigrations(db)，确保所有迁移在服务监听前完成
require('./db').getDb();

// 信任反向代理（nginx/CDN），保证 req.ip 和限流正确工作
app.set('trust proxy', 1);

// ---- 中间件 ----

// 安全头：根据每次请求的实际协议（req.secure）动态设置，
// 而非根据 BASE_URL 静态判断（BASE_URL=https 但用户通过 http://IP:3200 访问时会出错）。
// 用自定义中间件代替 helmet 的 HSTS/CSP，以便按请求动态控制。
app.use((req, res, next) => {
  const isHttps = req.secure;

  // 基础安全头（HTTP/HTTPS 都发）
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'no-referrer');

  // 注意：不设置 Cross-Origin-* 系列头
  // 这些头在反向代理场景下会导致移动端浏览器拒绝加载同源资源
  // （桌面端因 CORS 策略宽松不受影响，但移动端 Safari/Chrome 严格执行）

  if (isHttps) {
    // HTTPS：发 HSTS + upgrade-insecure-requests
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self'; " +
      "connect-src 'self'; " +
      'upgrade-insecure-requests'
    );
  } else {
    // HTTP：不发 HSTS，CSP 也不升级不安全请求
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self'; " +
      "connect-src 'self'"
    );
  }

  next();
});

// Helmet 仅用于其剩余安全头（去掉已由上面中间件控制的项）
// 注意：必须显式关闭 crossOriginResourcePolicy，否则 helmet 默认设置 same-origin，
// 导致反向代理下移动端浏览器拒绝加载 JS/CSS 资源
app.use(helmet({
  contentSecurityPolicy: false,
  strictTransportSecurity: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  originAgentCluster: false,
}));

// CORS: 从 config 读取允许的来源
// 安全修复：空数组时设为 false（禁止跨域），避免 cors 库反射任意 Origin
// 前后端同源部署（Nginx 反代）时无需 CORS，仅当前端独立部署到其他域名时才需配置 CORS_ORIGINS
const corsOrigin = config.corsOrigins.length > 0 ? config.corsOrigins : false;
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// 请求 ID（链路追踪，所有日志和错误响应携带）
app.use(requestId);

// 请求日志（仅开发环境）
if (config.isDev) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      if (req.path.startsWith('/api')) {
        process.stdout.write(`${req.method} ${req.path} → ${res.statusCode} (${ms}ms)\n`);
      }
    });
    next();
  });
}



// ---- 静态文件 ----
// 自动创建上传目录（防止首次部署时 uploads/ 不存在）
const uploadsDir = config.uploadsDir;
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  process.stdout.write(`[初始化] 已自动创建上传目录: ${uploadsDir}\n`);
}

// 前端静态资源目录：支持多种相对路径（兼容不同部署目录结构）
const webDistCandidates = [
  path.join(__dirname, '..', '..', 'web', 'dist'),    // 标准结构: server/src/ → ../../web/dist
  path.join(__dirname, '..', 'web', 'dist'),           // 扁平结构: server/src/ → ../web/dist
  path.join(__dirname, '..', '..', '..', 'web', 'dist'), // 嵌套结构
];
let webDistPath = null;
for (const p of webDistCandidates) {
  if (fs.existsSync(path.join(p, 'index.html'))) {
    webDistPath = p;
    break;
  }
}
if (webDistPath) {
  // 静态文件服务
  // - 显式设置正确的 Content-Type 防止 MIME 混淆
  // - 不设置 COOP/COEP/CORP 头，避免反向代理下移动端浏览器拒绝资源
  app.use(express.static(webDistPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      }
    },
  }));
  process.stdout.write(`[初始化] 前端静态资源目录: ${webDistPath}\n`);
} else {
  process.stderr.write(`[警告] 未找到前端构建产物 web/dist/，仅 API 模式运行\n`);
}

// ---- 限流中间件（按路由组单独挂载，必须在路由之前） ----
// 公开读取接口（产品列表、分类、库存、公告、支付方式列表）
app.use('/api/public', publicReadLimiter);
app.use('/api/store/store-methods', publicReadLimiter);

// 写操作 / 敏感操作（下单、创建支付）
app.use('/api/store/order', orderCreateLimiter);
app.use('/api/store/create-payment', paymentCreateLimiter);

// 支付状态轮询（前端 3-10 秒轮询一次，额度要充足）
app.use('/api/store/payment-status', paymentStatusLimiter);

// 订单查询（根据订单号/联系方式/邮箱查询）
app.use('/api/order', orderQueryLimiter);

// 管理后台：登录用独立严格限流，其他管理接口用高额度限流
app.use('/api/admin/login', loginLimiter);
app.use('/api/admin', (req, res, next) => {
  if (req.path === '/login') return next();
  return adminLimiter(req, res, next);
});

// ---- API 路由 ----
app.use('/api/admin', adminRoutes);
app.use('/api/admin', mediaRoutes);
app.use('/api/admin', paymentAdminRoutes);
app.use('/api/admin', settingsRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/store', paymentShopRoutes);
app.use('/api', paymentCallbackRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/public', publicRoutes);

// ---- Swagger API 文档 ----
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'Asolica 数字商品发卡平台 API', version: '5.4.4', description: '前后端分离发卡平台接口文档' },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
  },
  apis: ['./src/routes/*.js', './src/routes/**/*.js'],
})));

// 公开文件访问
const { getMediaFile } = require('./services/mediaService');
app.get('/api/media/:filename', (req, res) => {
  const result = getMediaFile(req.params.filename);
  if (!result) {
    return res.status(404).json({ ok: false, message: '文件不存在' });
  }
  res.setHeader('Content-Type', result.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
  res.sendFile(result.filePath);
});

// 健康检查（轻量，仅检查进程存活）
app.get('/api/health', (req, res) => {
  // 使用上海时区，与日志时间保持一致
  const d = new Date();
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t)?.value || '';
  const time = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+08:00`;
  res.json({ ok: true, time, service: 'asolica-server' });
});

// 就绪检查（检查依赖服务：数据库连通性）
app.get('/api/ready', (req, res) => {
  try {
    const db = require('./db').getDb();
    db.prepare('SELECT 1').get();
    const d = new Date();
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(d);
    const get = (t) => parts.find(p => p.type === t)?.value || '';
    const time = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+08:00`;
    res.json({ ok: true, time, service: 'asolica-server', db: 'connected' });
  } catch (e) {
    res.status(503).json({ ok: false, time: new Date().toISOString(), service: 'asolica-server', db: 'error', error: e.message });
  }
});

// SPA fallback：仅对 HTML 请求（Accept 头含 text/html）返回 index.html
// API 路径 404 返回 JSON 错误
app.get('*', (req, res, next) => {
  const accept = req.headers.accept || '';
  if (accept.includes('text/html') && !req.path.startsWith('/api')) {
    if (!webDistPath) {
      return res.status(404).json({ ok: false, message: '前端资源未找到，请检查 web/dist/ 目录' });
    }
    const fp = path.join(webDistPath, 'index.html');
    res.sendFile(fp, (err) => {
      if (err) res.status(404).json({ ok: false, message: '页面不存在' });
    });
  } else {
    next(); // 交给 notFoundHandler 处理
  }
});

// ---- 404 处理（所有未匹配路由） ----
app.use(notFoundHandler);

// ---- 统一错误处理 ----
app.use(errorHandler);

// ---- 优雅关闭 ----
let server;
let autoCancelTimer = null;
let emailRetryTimer = null;
let undeliveredTimer = null;
let walCheckpointTimer = null;

function gracefulShutdown(signal) {
  process.stdout.write(`\n收到 ${signal} 信号，开始优雅关闭...\n`);
  if (autoCancelTimer) clearInterval(autoCancelTimer);
  if (emailRetryTimer) clearInterval(emailRetryTimer);
  if (undeliveredTimer) clearInterval(undeliveredTimer);
  if (walCheckpointTimer) clearInterval(walCheckpointTimer);
  if (server) {
    server.close(() => {
      process.stdout.write('服务器已关闭\n');
      process.exit(0);
    });
    // 5 秒后强制退出
    setTimeout(() => process.exit(1), 5000).unref();
  } else {
    process.exit(0);
  }
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ---- 全局未捕获异常兜底（防止进程崩溃，配合 PM2 自动重启） ----
// uncaughtException：同步代码未捕获的异常
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException（同步未捕获异常）', {
    tag: '全局兜底', error: err.message, stack: err.stack,
  });
  // Node.js 官方建议：uncaughtException 后应退出进程，由 PM2 自动重启
  process.exit(1);
});
// unhandledRejection：Promise 未捕获的 reject
process.on('unhandledRejection', (reason, promise) => {
  logger.error('unhandledRejection（Promise 未捕获拒绝）', {
    tag: '全局兜底', reason: reason?.message || String(reason), stack: reason?.stack,
  });
});

// ---- 订单超时自动取消（每分钟检查一次） ----
// 同时将关联的 pending payment 标记为 failed，并释放已分配卡密
const { cancelExpiredOrders } = require('./services/orderService');
autoCancelTimer = setInterval(() => {
  try {
    cancelExpiredOrders();
  } catch (e) {
    process.stderr.write(`[auto-cancel] 错误: ${e.message}\n`);
  }
}, 60 * 1000);
// 允许进程在定时器存在时正常退出
autoCancelTimer.unref();

// ---- 邮件队列重试（每 2 分钟检查一次） ----
const { retryFailedEmails } = require('./services/emailService');
emailRetryTimer = setInterval(() => {
  retryFailedEmails().catch(e => {
    process.stderr.write(`[email-retry] 错误: ${e.message}\n`);
  });
}, 2 * 60 * 1000);
emailRetryTimer.unref();

// ---- 已付款未发卡订单补发（每 2 分钟检查一次） ----
// 场景：支付回调中 allocateCards 失败（库存不足/并发占用），订单卡在 paid 状态
const { allocateCards } = require('./services/cardService');
undeliveredTimer = setInterval(() => {
  try {
    const db = require('./db').getDb();
    // 查找 paid 状态且 card_ids 为空的订单（已付款但未发卡）
    const stuck = db.prepare(
      "SELECT id FROM orders WHERE status = 'paid' AND (card_ids = '[]' OR card_ids IS NULL OR card_ids = '') ORDER BY created_at ASC LIMIT 20"
    ).all();
    if (stuck.length === 0) return;
    process.stdout.write(`[undelivered] 发现 ${stuck.length} 笔已付款未发卡订单，尝试补发\n`);
    for (const o of stuck) {
      try {
        allocateCards(o.id, db);
        process.stdout.write(`[undelivered] 订单 ${o.id} 补发成功\n`);
      } catch (e) {
        process.stderr.write(`[undelivered] 订单 ${o.id} 补发失败: ${e.message}\n`);
      }
    }
  } catch (e) {
    process.stderr.write(`[undelivered] 错误: ${e.message}\n`);
  }
}, 2 * 60 * 1000);
undeliveredTimer.unref();

// ---- WAL Checkpoint（每 6 小时执行一次，防止 WAL 文件过大） ----
walCheckpointTimer = setInterval(() => {
  try {
    const db = require('./db').getDb();
    db.pragma('wal_checkpoint(TRUNCATE)');
    logger.info('WAL checkpoint 完成');
  } catch (e) {
    logger.error('WAL checkpoint 失败', { error: e.message });
  }
}, 6 * 60 * 60 * 1000); // 6 小时
walCheckpointTimer.unref();

// ---- 启动 ----
server = app.listen(PORT, () => {
  process.stdout.write(`\n  Asolica 数字商品发卡平台 - 后端已启动\n  http://localhost:${PORT}\n  API: http://localhost:${PORT}/api\n\n`);
});
