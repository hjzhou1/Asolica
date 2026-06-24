# Asolica - 数字商品自动发卡平台

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-5.4.4-emerald.svg)]()
[![Vue](https://img.shields.io/badge/vue-3.x-emerald.svg)](https://vuejs.org/)
[![Express](https://img.shields.io/badge/express-4.x-black.svg)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/sqlite-3.x-blue.svg)](https://sqlite.org/)

Asolica 是一套开箱即用的数字商品自动发货系统，适用于软件授权码、会员账号、充值卡、游戏点卡等数字商品的在线销售与自动化交付场景。采用前后端分离架构，单机部署即可平稳运行，无需配置 MySQL/Redis 等复杂的外部依赖。

---

## 核心特性

### 数字商品与库存管理
- **多规格支持**：支持为商品配置多种不同的规格（例如：月卡/季卡/年卡），并可为每种规格配置独立的价格与卡密库存
- **混合发卡模式**：支持"自动卡密发货"与"人工手动处理"双重销售模式
- **库存控制**：支持批量导入卡密、循环卡密（单卡密多次销售）、软删除以及库存预警

### 交易与支付系统
- **可插拔支付适配器**：支持虎皮椒、彩虹易支付等主流第三方支付通道，后台动态管理，基于数据库配置驱动，无缝热插拔
- **支付幂等防护**：支付回调链路经过幂等设计，规避重复充值或多次下发卡密
- **6态状态机**：订单涵盖 6 个严谨状态（`pending` 待支付、`paid` 已支付、`delivered` 已发货、`refunded` 已退款、`failed` 失败、`expired` 超时已取消），状态机流转支持高并发及超时自动回滚

### 安全防护
- **身份认证**：后台基于 JWT 签名与 bcrypt 强加密算法进行管理权限认证
- **输入强校验**：前后端采用 `zod` 校验体系，杜绝 SQL 注入与 XSS 攻击
- **敏感数据脱敏**：卡密在交付及查询时均按需脱敏，敏感的邮件及支付 API 密钥加密存储在数据库中，绝不在前端暴露

### 多渠道通知与营销
- **优惠券系统**：支持配置有效期、最低消费门槛、单用户限用次数以及适用的商品白名单
- **异步邮件群发**：内置 SMTP / Resend / 阿里云 / 腾讯云四种邮件驱动，采用异步队列机制（`email_queue`），发送失败自动重试
- **消息推送**：支持 Telegram Bot 和 Bark (iOS 推送)，方便管理员实时接收销售动态

### 国际化
- **中英双语**：前台商城与后台管理均支持中英文无缝切换

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Vue 3 + Vite + Vue Router + Vue I18n | 单页应用，支持中英双语 |
| 后端 | Node.js + Express | 轻量化、高性能 |
| 数据库 | SQLite (`better-sqlite3`) | WAL 模式，无需外部数据库 |
| 认证 | JWT + bcrypt | 安全令牌 + 密码散列 |
| API文档 | Swagger UI | 访问 `/api-docs` 查看交互式文档 |

---

## 项目结构

```
asolica/
├── server/                        # 后端 Express 服务
│   ├── src/
│   │   ├── app.js                 # 应用入口
│   │   ├── config/                # 常量与环境变量配置
│   │   ├── db/                    # 数据库迁移(Migrations)与种子数据
│   │   ├── middleware/            # JWT认证、速率限制、Zod校验等中间件
│   │   ├── routes/                # 路由层（管理后台与前台商城接口）
│   │   ├── services/              # 订单状态机、邮件发送、支付适配等核心业务服务
│   │   ├── repositories/          # 数据访问层（消除N+1查询，统一数据库操作）
│   │   └── utils/                 # 公用工具函数
│   ├── data/                      # 运行时 SQLite 数据库存储目录（自动创建）
│   ├── uploads/                   # 媒体文件上传目录（自动创建）
│   └── scripts/                   # 管理员密码重置等运维辅助脚本
├── web/                           # 前端 Vue 3 单页应用
│   ├── src/
│   │   ├── api/                   # 前后端 API 交互请求客户端
│   │   ├── components/            # Vue 共享组件与前后台核心 UI
│   │   ├── layouts/               # 整体布局 (AdminLayout / ShopLayout)
│   │   ├── locales/               # 国际化语言包 (中文 / 英文)
│   │   ├── router/                # 前端路由控制与登录守卫
│   │   ├── styles/                # 全局样式与设计令牌系统
│   │   └── views/                 # 页面级组件 (商城页面与后台管理界面)
│   └── dist/                      # 前端静态打包产物目录
├── Dockerfile                     # Docker 镜像构建配置
├── docker-compose.yml             # Docker 容器编排配置
├── ecosystem.config.cjs           # PM2 进程管理配置
└── install.sh                     # 一键安装脚本
```

---

## 快速启动

### 方法一：Docker 部署（推荐）

> **Docker 是什么？** 简单理解，Docker 就像一个"万能工具箱"，把你的应用和所有依赖（Node.js、数据库等）打包在一起，在任何装了 Docker 的机器上都能一键运行，不用手动装环境。
>
> **Dockerfile**：类似"配方"，告诉 Docker 怎么打包你的应用。
> **docker-compose.yml**：类似"启动按钮"，一条命令启动整个项目。
>
> **是否需要上传到 Docker Hub？** 不需要！Dockerfile 在源码里，用户下载源码后在**本地构建**镜像即可。

#### 步骤

**第一步：安装 Docker**

服务器安装 Docker（如果已安装跳过）：

```bash
# 一键安装（推荐，适用于 Ubuntu/Debian/CentOS）
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker
```

安装完成后验证：
```bash
docker --version
docker compose version
```

> 如果一键脚本安装失败，请参考官方文档：https://docs.docker.com/engine/install/

**第二步：下载源码**

```bash
# 方式1：从 GitHub Release 下载 zip（推荐）
# 访问 https://github.com/你的用户名/asolica/releases
# 下载 Asolica-v5.4.4.zip 并解压到任意目录

# 方式2：git clone
git clone https://github.com/你的用户名/asolica.git
cd asolica

# 方式3：手动上传
# 将 Asolica-v5.4.4.zip 上传到服务器任意目录（如 /opt/asolica）
# 解压：unzip Asolica-v5.4.4.zip -d /opt/asolica
```

**第三步：配置环境变量**

```bash
# 进入项目目录（根据你的实际路径调整）
cd /opt/asolica  # 或 cd asolica（如果是git clone）

# 复制配置文件
cp .env.example .env

# 编辑配置文件（必须修改）
nano .env
```

**必须修改的配置项**：
```bash
# 修改为至少 32 个字符的随机字符串（用于 JWT 签名）
JWT_SECRET=your-secret-key-at-least-32-characters-long

# 修改为你的实际域名（用于支付回调等）
BASE_URL=https://your-domain.com

# 其他配置保持默认即可
```

> 生成随机密钥：`openssl rand -hex 32`

**第四步：一键启动**

```bash
# 在项目根目录执行（确保当前目录有 Dockerfile 和 docker-compose.yml）
docker compose up -d
```

启动成功后访问：
- 前台商城：`http://你的服务器IP:3200`
- 管理后台：`http://你的服务器IP:3200/#/login`

**第五步：查看初始管理员密码**

首次启动会自动创建管理员账号，有 **3 种方式** 查看密码：

```bash
# 方式1（推荐）：直接查看密码文件
cat server/data/admin_password.txt

# 方式2：从日志中过滤
docker compose logs | grep "密码"

# 方式3：如果以上都找不到，重置密码
docker compose exec app node server/scripts/reset-password.js
```

方式1 和方式2 都会直接显示管理员账号和密码，无需在大量日志中翻找。

**第六步：配置 Nginx 反向代理（可选，用于域名访问）**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3200;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

配置完成后访问 `http://your-domain.com` 即可。

---

### 方法二：宝塔面板部署（适合新手）

> 宝塔面板是服务器图形化管理工具，适合不熟悉命令行的用户。

#### 第一步：安装宝塔面板

```bash
# 一键安装（适用于 CentOS/Ubuntu/Debian）
if [ -f /usr/bin/curl ];then curl -sSO https://download.bt.cn/install/install_panel.sh;else wget -O install_panel.sh https://download.bt.cn/install/install_panel.sh;fi;bash install_panel.sh ed8484bec
```

> 安装完成后，终端会显示宝塔面板的访问地址和登录信息。
> 官方文档：https://www.bt.cn/new/download.html

#### 第二步：在宝塔中安装 Node.js 和 PM2

1. 登录宝塔面板（浏览器访问终端显示的地址）
2. 进入 **软件商店**
3. 搜索 **PM2管理器**，点击安装
4. 安装过程中会自动安装 Node.js（推荐选择 v22 LTS）

> 如果软件商店中没有 PM2管理器，也可以通过命令行安装：
> ```bash
> # 安装 Node.js（使用 nvm）
> curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.5/install.sh | bash
> source ~/.bashrc
> nvm install 22
>
> # 安装 PM2
> npm install pm2 -g
> ```

#### 第三步：上传源码

1. 在宝塔面板中进入 **文件** 管理
2. 上传 `Asolica-v5.4.4.zip` 到 `/www/wwwroot/asolica/`（或任意目录）
3. 右键解压 zip 文件

#### 第四步：安装依赖并启动

在宝塔终端中执行（或通过宝塔的文件管理进入项目目录后使用终端）：

```bash
# 进入项目目录
cd /www/wwwroot/asolica

# 复制并编辑配置文件
cp .env.example .env
nano .env
# 修改 JWT_SECRET（至少32字符）和 BASE_URL（你的域名）

# 安装后端依赖
cd server
npm install

# 安装前端依赖并构建
cd ../web
npm install
npm run build

# 回到项目根目录，使用 PM2 启动
cd ..
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

#### 第五步：配置 Nginx 反向代理

1. 在宝塔面板中进入 **网站** → **添加站点**
2. 填写你的域名，PHP 版本选择 **纯静态**
3. 点击站点 **设置** → **反向代理** → **添加反向代理**
4. 目标 URL 填写：`http://127.0.0.1:3200`
5. 保存后即可通过域名访问

#### 第六步：查看管理员密码

```bash
# 在项目根目录执行
cat server/data/admin_password.txt
```

---

### 方法三：本地开发模式

#### 环境要求
- Node.js >= 18（推荐 Node 22）
- npm >= 9

#### 启动后端
```bash
cd server
npm install
JWT_SECRET=your-dev-secret-at-least-32-chars-long npm run dev
```
后端运行在 `http://localhost:3200`。首次启动自动创建数据库并生成管理员密码（见控制台输出或 `server/data/admin_password.txt`）。

#### 启动前端
```bash
cd web
npm install
npm run dev
```
前端运行在 `http://localhost:5173`：
- 前台商城：`http://localhost:5173/`
- 管理后台：`http://localhost:5173/#/login`

---

## 升级指南

### 方式一：保留数据升级（推荐）

适用于：从旧版本升级到新版本，保留所有商品、订单、卡密等数据。

**Docker 部署升级：**

```bash
# 1. 进入项目目录
cd /opt/asolica

# 2. 备份数据（重要！）
cp -r server/data server/data_backup_$(date +%Y%m%d)

# 3. 停止服务
docker compose down

# 4. 替换源码（保留 server/data、server/uploads、server/backups 目录）
# 方式A：git pull
git pull

# 方式B：手动替换（删除旧文件，上传新文件，但不要删除 server/data 目录）

# 5. 重新构建并启动
docker compose up -d --build

# 6. 查看日志确认启动正常
docker compose logs -f
```

**宝塔/PM2 部署升级：**

```bash
# 1. 进入项目目录
cd /www/wwwroot/asolica

# 2. 备份数据
cp -r server/data server/data_backup_$(date +%Y%m%d)

# 3. 停止服务
pm2 stop asolica-server

# 4. 替换源码（保留 server/data、server/uploads 目录）

# 5. 重新安装依赖（如果 package.json 有更新）
cd server && npm install
cd ../web && npm install && npm run build

# 6. 重启服务
cd ..
pm2 restart asolica-server
```

### 方式二：全新部署（不保留数据）

适用于：不需要旧数据，完全重新部署。

> **重要提示**：很多用户删除旧文件夹后拖入新源码，发现旧数据还在。这是因为数据文件存储在 `server/data/` 目录中，如果你只删除了代码文件但没删除这个目录，旧数据就会保留。

**Docker 部署全新安装：**

```bash
# 1. 停止并删除容器
docker compose down

# 2. 删除数据目录（这会清除所有数据！）
rm -rf server/data
rm -rf server/uploads
rm -rf server/backups

# 3. 如果使用了 Docker 数据卷，也需要清理
docker volume ls  # 查看是否有相关数据卷
docker volume rm <数据卷名称>  # 删除指定数据卷

# 4. 上传新源码并重新部署
# ... 按照"快速启动"步骤操作
```

**宝塔/PM2 部署全新安装：**

```bash
# 1. 停止服务
pm2 stop asolica-server
pm2 delete asolica-server

# 2. 删除整个项目目录（包括数据）
rm -rf /www/wwwroot/asolica

# 3. 上传新源码并重新部署
# ... 按照"宝塔面板部署"步骤操作
```

---

## 常见问题

### 1. 删除旧文件夹后拖入新源码，旧数据还在？

**原因**：数据存储在 `server/data/` 目录中，如果你只删除了代码文件但没删除这个目录，旧数据就会保留。

**解决**：
- 如果要保留数据：直接替换代码文件即可，`server/data/` 不要删除
- 如果要清除数据：同时删除 `server/data/` 目录

### 2. 忘记管理员密码怎么办？

```bash
# Docker 部署
docker compose exec asolica node server/scripts/reset-password.js

# 宝塔/PM2 部署（在项目根目录执行）
cd server && node scripts/reset-password.js
```

执行后会生成新的随机密码并显示在终端，同时更新 `server/data/admin_password.txt` 文件。

### 3. 如何修改端口？

编辑 `docker-compose.yml`（Docker）或 `server/src/config/env.js`（非Docker），修改 `PORT` 配置项。

### 4. 数据库在哪里？

- SQLite 数据库文件位于 `server/data/asolica.db`
- Docker 部署时通过数据卷挂载到宿主机，容器删除重建数据不丢失

### 5. 如何备份数据？

```bash
# 手动备份
cp server/data/asolica.db server/data/asolica_backup_$(date +%Y%m%d).db

# 自动备份：系统每天凌晨 3 点自动备份到 server/backups/ 目录
```

---

## Docker 新手入门

> 本章节面向从未接触过 Docker 的用户，用最通俗的语言帮你理解。

### Docker 是什么？

打个比方：你开了一家奶茶店（你的应用），需要奶茶机、原料、杯子等（依赖环境）。传统方式是你到每家分店（每台服务器）都重新采购安装一遍，费时费力还容易装错。Docker 就像一个"移动奶茶车"，把所有设备原料都装好了，推到哪家分店都能直接开卖。

### 为什么用 Docker？

| 传统部署 | Docker 部署 |
|---------|------------|
| 手动装 Node.js、Nginx 等 | 不用装，Docker 镜像里全有 |
| 换台机器可能环境不一致 | 哪台机器都一样 |
| 升级要手动操作 | 重新构建镜像即可 |
| 适合有运维经验的人 | 适合所有人 |

### 三个核心概念

1. **镜像（Image）**：类似"安装包"，包含应用和所有依赖。Dockerfile 就是构建镜像的"配方"。
2. **容器（Container）**：镜像运行起来就是容器，类似"正在运行的应用实例"。
3. **docker-compose**：当一个项目需要多个服务配合时（比如应用+数据库），用它一条命令全部启动。

### 本项目的 Docker 文件说明

- **[Dockerfile](./Dockerfile)**：分3阶段构建——先构建前端 → 再装后端依赖 → 最后合并成运行时镜像。使用非 root 用户运行，内置健康检查。
- **[docker-compose.yml](./docker-compose.yml)**：定义端口映射（3200）、环境变量、数据卷挂载（数据库/上传文件/备份自动持久化到宿主机）。

### 常用 Docker 命令

```bash
# 启动服务（后台运行）
docker compose up -d

# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 更新代码后重新构建
git pull  # 或重新上传源码
docker compose up -d --build
```

### 数据持久化

docker-compose.yml 已配置数据卷挂载，即使容器删除重建，你的数据也不会丢失：
- `server/data/` → 数据库文件
- `server/uploads/` → 用户上传的图片
- `server/backups/` → 自动备份文件

---

## 二次开发

### API 响应格式

所有 API 统一返回标准格式：
```json
// 成功
{ "ok": true, "data": ... }

// 失败
{ "ok": false, "message": "错误描述" }
```

### 前端 API 层

- `web/src/api/admin.js`：后台 API 客户端，`apiFetch` 自动解包响应
- `web/src/api/shop.js`：前台 API 客户端，`shopFetch` 自动解包响应
- `web/src/api/media.js`：媒体上传 API

### 后端分层架构

```
routes/        → 路由层（参数校验、调用 service）
services/      → 业务层（核心业务逻辑）
repositories/  → 数据层（数据库查询，消除 N+1）
utils/         → 工具层（响应格式、时间、脱敏等）
```

### 数据库迁移

迁移脚本位于 `server/src/db/migrations/`，服务启动时自动执行。当前版本 v1。

---

## 部署文档

| 文档 | 说明 | 适合人群 |
|------|------|---------|
| [DEPLOY_BT.md](./DEPLOY_BT.md) | 宝塔面板生产环境部署指南 | 新手、使用宝塔面板的用户 |
| Swagger API 文档 | 运行后访问 `/api-docs` | 二次开发者 |

---

## 开源许可

本项目基于 **MIT License** 开源，详情请参阅 [LICENSE](./LICENSE) 文件。

你可以自由使用、修改、分发本项目，包括商业用途。如果二次开发后开源，请保留原始版权声明。
