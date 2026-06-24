const fs = require('fs');
const path = require('path');
const config = require('../config/env');

const LOG_DIR = config.logsDir;
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel = LEVELS[config.logLevel];

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

/** 获取上海时区的日期字符串 YYYY-MM-DD */
function getShanghaiDate(d = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d).replace(/\//g, '-');
}

/** 获取上海时区的 ISO 时间字符串（与 nowISO 一致） */
function getShanghaiISO(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const pad3 = (n) => String(n).padStart(3, '0');
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t)?.value || '';
  const ms = pad3(d.getMilliseconds());
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.${ms}+08:00`;
}

function getLogFile() {
  return path.join(LOG_DIR, `app-${getShanghaiDate()}.log`);
}

// 清理超过 7 天的日志
function cleanOldLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    for (const f of files) {
      const fp = path.join(LOG_DIR, f);
      const stat = fs.statSync(fp);
      if (now - stat.mtimeMs > sevenDays) fs.unlinkSync(fp);
    }
  } catch (e) { /* ignore */ }
}

// 单日日志文件超过 50MB 时自动轮转（防止磁盘爆满的兜底）
// 配合 PM2 的 pm2-logrotate 模块使用，这是应用层的额外保护
const MAX_LOG_SIZE = 50 * 1024 * 1024; // 50MB
function rotateIfTooLarge() {
  try {
    const file = getLogFile();
    if (!fs.existsSync(file)) return;
    const stat = fs.statSync(file);
    if (stat.size > MAX_LOG_SIZE) {
      const rotated = `${file}.${Date.now()}.bak`;
      fs.renameSync(file, rotated);
      // 保留最近 3 份轮转日志
      const dir = path.dirname(file);
      const base = path.basename(file);
      const baks = fs.readdirSync(dir)
        .filter(f => f.startsWith(base) && f.endsWith('.bak'))
        .map(f => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      for (const b of baks.slice(3)) {
        try { fs.unlinkSync(path.join(dir, b.f)); } catch (_) { /* ignore */ }
      }
    }
  } catch (e) { /* ignore */ }
}

function formatMessage(level, message, context) {
  const entry = {
    timestamp: getShanghaiISO(),
    level,
    message,
    ...(context ? { context } : {})
  };
  return entry;
}

function writeLog(level, message, context) {
  if (LEVELS[level] < currentLevel) return;
  const entry = formatMessage(level, message, context);
  const logLine = JSON.stringify(entry) + '\n';

  // 写入文件
  try {
    rotateIfTooLarge();
    fs.appendFileSync(getLogFile(), logLine);
  } catch (e) { /* ignore */ }

  // 输出到 stdout/stderr
  if (process.env.NODE_ENV !== 'production') {
    // 开发环境：可读格式
    const colors = { debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m' };
    const reset = '\x1b[0m';
    const time = entry.timestamp.slice(11, 19);
    const out = `${colors[level]}[${time}] ${level.toUpperCase()}${reset} ${message}${context ? ' ' + JSON.stringify(context) : ''}\n`;
    if (level === 'error') process.stderr.write(out);
    else process.stdout.write(out);
  } else {
    // 生产环境：JSON
    if (level === 'error') process.stderr.write(logLine);
    else process.stdout.write(logLine);
  }
}

const logger = {
  debug: (msg, ctx) => writeLog('debug', msg, ctx),
  info: (msg, ctx) => writeLog('info', msg, ctx),
  warn: (msg, ctx) => writeLog('warn', msg, ctx),
  error: (msg, ctx) => writeLog('error', msg, ctx),
};

// 启动时清理旧日志
cleanOldLogs();

module.exports = logger;
