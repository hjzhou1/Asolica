# 宝塔面板部署指南

## 0. 全新部署（覆盖旧版本）

如果服务器上已有旧版本，**必须先彻底清理**：

```bash
pm2 stop asolica-server 2>/dev/null; pm2 delete asolica-server 2>/dev/null; pm2 save
pkill -f "node.*app.js" 2>/dev/null || true
rm -rf /www/wwwroot/asolica
ss -tlnp | grep 3200  # 确认端口已释放
```

## 1. 上传并解压

将项目压缩包上传到服务器 `/www/wwwroot/`，解压：

```bash
cd /www/wwwroot
unzip Asolica-v5.4.4.zip -d asolica
cd asolica
```

## 2. 安装依赖

```bash
bash install.sh
```

## 3. 启动服务

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

## 4. 验证服务

```bash
pm2 list                          # 确认 online
curl http://localhost:3200/api/health  # 应返回 {"ok":true,...}
pm2 logs asolica-server --lines 50     # 查看管理员密码
```

## 5. 配置 Nginx 反向代理

**方案 A（推荐）：Nginx 直接托管前端 + 代理 API**

在宝塔面板添加站点（域名、纯静态），然后用 `server/nginx.conf` 替换站点配置：

```bash
cp /www/wwwroot/asolica/server/nginx.conf /www/wwwroot/asolica/server/nginx.conf.bak
# 编辑 nginx.conf，替换 your-domain.com 为实际域名，SSL 证书路径
# 宝塔面板 → 站点设置 → 配置文件 → 粘贴 nginx.conf 内容
nginx -t && nginx -s reload
```

此方案 Nginx 直接从 `web/dist/` 提供前端静态文件，仅 `/api/` 代理到后端。

**方案 B：全量代理到 Node.js**

如果不想分离静态文件，可让 Express 处理一切：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    client_max_body_size 8m;

    location / {
        proxy_pass http://127.0.0.1:3200;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
    }

    location ~* \.(db|sqlite|log|env|txt|sh)$ {
        deny all;
    }
}
```

⚠️ **注意**：不要在 Nginx 配置中添加 `Cross-Origin-*` 头，会导致移动端浏览器拒绝加载资源。

## 6. 配置 BASE_URL

编辑 `.env`，设置你的域名：

```bash
BASE_URL=https://your-domain.com
```

重启服务：

```bash
pm2 restart asolica-server
```

## 7. 验证移动端访问

部署完成后，务必用手机（或 Chrome DevTools 移动端模拟）访问验证：

- 页面应正常加载，不应出现空白
- 打开浏览器控制台，不应有 CORS 或 MIME 类型的错误
- 如果空白：检查 Nginx 配置是否添加了 `Cross-Origin-*` 头，如果有则移除

## 常用命令

```bash
pm2 list                          # 查看状态
pm2 logs asolica-server           # 查看日志
pm2 restart asolica-server        # 重启
pm2 stop asolica-server           # 停止
```
