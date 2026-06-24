/**
 * 环境变量集中解析与校验
 * 统一导出 config 对象，避免散落的 process.env 读取
 *
 * 自动加载项目根目录的 .env 文件（Docker / systemd / 手动启动均可复用）
 * 如果 .env 不存在，自动从 .env.example 复制并生成随机 JWT_SECRET
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 项目根目录（server/src/config/ 往上三级）
const PROJECT_ROOT = path.join(__dirname, '../../../');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');
const ENV_EXAMPLE = path.join(PROJECT_ROOT, '.env.example');

/**
 * 自动生成随机 JWT 密钥（64 字符 hex）
 */
function generateJwtSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 确保 .env 文件存在
 * 如果不存在，从 .env.example 复制，并自动填入随机 JWT_SECRET
 */
function ensureEnvFile() {
  if (fs.existsSync(ENV_FILE)) return;

  let content = '';
  if (fs.existsSync(ENV_EXAMPLE)) {
    content = fs.readFileSync(ENV_EXAMPLE, 'utf-8');
  } else {
    // 兜底：内置最小配置
    content = [
      'JWT_SECRET=',
      'PORT=3200',
      'NODE_ENV=production',
      '',
    ].join('\n');
  }

  // 生成随机密钥并替换
  const secret = generateJwtSecret();
  content = content.replace(
    /JWT_SECRET=.*/,
    `JWT_SECRET=${secret}`
  );

  fs.writeFileSync(ENV_FILE, content, 'utf-8');
  process.stdout.write('[初始化] 已自动创建 .env 文件并生成随机 JWT_SECRET\n');
}

// 确保 .env 存在
ensureEnvFile();

// 加载 .env（不覆盖已存在的环境变量，便于容器/系统环境优先）
require('dotenv').config({ path: ENV_FILE });

const nodeEnv = process.env.NODE_ENV || 'production';
const isProd = nodeEnv === 'production';
const isDev = !isProd;

// JWT_SECRET：如果未设置或为默认值，自动生成并写回 .env
let jwtSecret = process.env.JWT_SECRET || '';
const DEFAULT_SECRETS = [
  'change-me-to-a-random-32-char-string',
  '',
];

if (!jwtSecret || DEFAULT_SECRETS.includes(jwtSecret) || jwtSecret.length < 32) {
  jwtSecret = generateJwtSecret();
  // 写回 .env 文件，确保下次启动不需要重新生成
  try {
    let envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    if (/^JWT_SECRET=/m.test(envContent)) {
      envContent = envContent.replace(/^JWT_SECRET=.*/m, `JWT_SECRET=${jwtSecret}`);
    } else {
      envContent = `JWT_SECRET=${jwtSecret}\n` + envContent;
    }
    fs.writeFileSync(ENV_FILE, envContent, 'utf-8');
    process.stdout.write('[初始化] 已自动生成随机 JWT_SECRET 并写入 .env\n');
  } catch (e) {
    // 写入失败时仅警告，不阻止启动（内存中已有密钥）
    process.stderr.write(`[警告] 无法写入 JWT_SECRET 到 .env: ${e.message}\n`);
  }
}

module.exports = {
  nodeEnv,
  isProd,
  isDev,
  port: parseInt(process.env.PORT, 10) || 3200,
  jwtSecret,
  // 数据库路径：默认 server/data/asolica.db
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/asolica.db'),
  // 上传目录：默认 server/uploads
  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads'),
  // 日志目录
  logsDir: process.env.LOGS_DIR || path.join(__dirname, '../../logs'),
  // CORS 允许的来源（逗号分隔），为空则允许所有（方便首次部署）
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean),
  // 站点根 URL（用于支付回调地址，防 Host 头欺骗）
  // 必须配置为完整的外部可访问URL，如 https://yourdomain.com
  baseUrl: process.env.BASE_URL || '',
  // 默认管理员密码（首次初始化用）
  adminDefaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || '',
  // 日志级别
  logLevel: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  // 订单超时时间（分钟），默认 30 分钟
  orderExpireMinutes: parseInt(process.env.ORDER_EXPIRE_MINUTES, 10) || 30,
};
