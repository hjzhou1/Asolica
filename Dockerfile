# ===== 阶段 1: 前端构建 =====
FROM node:22-alpine AS frontend-build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ===== 阶段 2: 后端依赖 =====
FROM node:22-alpine AS backend-deps
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev

# ===== 阶段 3: 运行时 =====
FROM node:22-alpine AS runtime

# 安装 dumb-init 用于正确处理信号
RUN apk add --no-cache dumb-init

# 创建非 root 用户
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

# 复制后端依赖
COPY --from=backend-deps /app/node_modules ./node_modules

# 复制后端源码
COPY server/src/ ./src/
COPY server/package.json ./package.json

# 复制前端构建产物
COPY --from=frontend-build /app/web/dist ./web/dist

# 创建数据/上传/日志/备份目录并设置权限
RUN mkdir -p data uploads logs backups && chown -R app:app /app

# 切换非 root 用户
USER app

# 环境变量默认值
ENV NODE_ENV=production
ENV PORT=3200

EXPOSE 3200

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3200/api/health || exit 1

# 使用 dumb-init 正确处理信号（优雅关闭）
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/app.js"]
