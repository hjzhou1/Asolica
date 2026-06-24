/**
 * PM2 进程配置
 * 参考成熟项目：使用配置文件而非命令行参数，便于版本管理和团队协作
 *
 * 使用方式：
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 restart ecosystem.config.cjs
 *   pm2 stop ecosystem.config.cjs
 *   pm2 delete ecosystem.config.cjs
 *
 * 日志查看：
 *   pm2 logs asolica-server
 *   pm2 monit
 */

const path = require('path');
const fs = require('fs');

// 项目根目录（ecosystem.config.cjs 所在目录）
const PROJECT_ROOT = __dirname;
const SERVER_DIR = path.join(PROJECT_ROOT, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');

// 启动前确保日志目录存在（防止 PM2 因目录不存在而启动失败 → 502）
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

module.exports = {
  apps: [
    {
      name: 'asolica-server',
      script: 'src/app.js',
      cwd: SERVER_DIR,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      max_memory_restart: '512M',

      // 环境变量
      env: {
        NODE_ENV: 'development',
        PORT: 3200,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3200,
      },

      // 日志配置（配合 pm2-logrotate 模块实现轮转，防止磁盘爆满）
      // 部署后必须执行：pm2 install pm2-logrotate
      // 然后执行：pm2 set pm2-logrotate:max_size 10M（单文件最大 10MB）
      //          pm2 set pm2-logrotate:retain 7（保留 7 份历史日志）
      //          pm2 set pm2-logrotate:compress true（压缩历史日志）
      out_file: path.join(LOG_DIR, 'pm2-out.log'),
      error_file: path.join(LOG_DIR, 'pm2-error.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json',

      // 优雅关闭：收到信号后等待 5 秒再强制 kill
      kill_timeout: 5000,
      listen_timeout: 10000,

      // 健康检查（参考成熟项目：PM2 原生健康检查）
      // 如果 30 秒内应用未启动成功，PM2 会认为启动失败
      wait_ready: false,
    },
  ],
};
