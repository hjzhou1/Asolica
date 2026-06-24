#!/bin/bash
# ==========================================
# Asolica 数字商品发卡平台 - 一键安装脚本 v4
# ==========================================
# 适用：已手动装好 Node.js 22 + npm + PM2 的服务器
# 功能：安装后端依赖、创建配置和目录
# 用法：bash install.sh
# 注意：如果环境未准备好，脚本会提示手动安装命令，不会假装安装成功
# ==========================================

set -e

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=========================================="
echo "  Asolica 数字商品发卡平台 - 一键安装"
echo "=========================================="
echo ""

# ==========================================
# 第1步：检测 Node.js
# ==========================================
echo -e "${CYAN}[1/6] 检测 Node.js 环境...${NC}"

NODE_OK=false
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 18 ]; then
    echo -e "${GREEN}  ✓ 已安装 Node.js $NODE_VERSION${NC}"
    NODE_OK=true
  else
    echo -e "${YELLOW}  ⚠ Node.js 版本过低 ($NODE_VERSION)，需要 18+${NC}"
  fi
fi

if [ "$NODE_OK" = false ]; then
  echo ""
  echo -e "${YELLOW}  系统未安装 Node.js 18+，正在尝试自动安装...${NC}"
  echo -e "${YELLOW}  （如果自动安装失败，请按下方提示手动安装）${NC}"
  echo ""

  # 尝试方式1：宝塔的 Node.js 版本管理器
  if command -v bt &> /dev/null; then
    echo -e "${CYAN}  检测到宝塔面板，尝试通过宝塔安装 Node.js 22...${NC}"
    bt 22 install 0 2>/dev/null || true
    bt 22 install_node 22 2>/dev/null || true
    export PATH="/www/server/nodejs/v22/bin:$PATH"
    hash -r 2>/dev/null || true
  fi

  # 尝试方式2：NodeSource 官方源
  if ! command -v node &> /dev/null; then
    echo -e "${CYAN}  尝试通过 NodeSource 安装 Node.js 22...${NC}"
    if command -v apt-get &> /dev/null; then
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
      curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
      yum install -y nodejs
    fi
  fi

  # 最终验证：到底有没有装上
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
      NODE_OK=true
      echo -e "${GREEN}  ✓ Node.js $NODE_VERSION 已可用${NC}"
    fi
  fi

  if [ "$NODE_OK" = false ]; then
    echo ""
    echo -e "${RED}  ✗ 自动安装 Node.js 失败，请手动安装后再运行本脚本${NC}"
    echo ""
    echo -e "${YELLOW}  请按以下步骤手动安装（推荐方法 A）：${NC}"
    echo ""
    echo "  方法 A - 宝塔面板（可视化，最稳）："
    echo "    1. 宝塔左侧 → 「软件商店」"
    echo "    2. 搜索「Node.js」→ 安装「Node.js 版本管理器」"
    echo "    3. 打开「Node.js 版本管理器」→ 安装 Node.js 22"
    echo "    4. 安装完成后，终端执行：export PATH=\"/www/server/nodejs/v22/bin:\$PATH\""
    echo ""
    echo "  方法 B - 命令行（Ubuntu/Debian）："
    echo "    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -"
    echo "    apt-get install -y nodejs"
    echo ""
    echo "  方法 C - 命令行（CentOS/RedHat）："
    echo "    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -"
    echo "    yum install -y nodejs"
    echo ""
    echo "  安装后验证以下命令都能显示版本号："
    echo "    node -v"
    echo "    npm -v"
    echo ""
    echo "  验证通过后再运行：bash install.sh"
    echo ""
    exit 1
  fi
fi

# ==========================================
# 第2步：检测 npm
# ==========================================
echo ""
echo -e "${CYAN}[2/6] 检测 npm...${NC}"

# 先在常见路径里找 npm
NPM_CMD=""
for p in "$(command -v npm 2>/dev/null)" "/www/server/nodejs/v22/bin/npm" "/www/server/nodejs/v20/bin/npm" "/www/server/nodejs/v18/bin/npm" "/usr/local/bin/npm" "/usr/bin/npm"; do
  if [ -n "$p" ] && [ -x "$p" ]; then
    NPM_CMD="$p"
    break
  fi
done

if [ -z "$NPM_CMD" ]; then
  echo ""
  echo -e "${RED}  ✗ npm 未安装${NC}"
  echo ""
  echo -e "${YELLOW}  说明：Node.js 虽然可能显示安装成功，但 npm 没一起装上。${NC}"
  echo -e "${YELLOW}  请按上面 Node.js 安装失败时的提示，重新手动安装 Node.js 22。${NC}"
  echo -e "${YELLOW}  验证 'node -v' 和 'npm -v' 都能显示版本号后，再运行 bash install.sh。${NC}"
  echo ""
  exit 1
fi

# 把 npm 所在目录加入 PATH，后续 npm 命令都能用
NPM_DIR="$(dirname "$NPM_CMD")"
export PATH="$NPM_DIR:$PATH"
hash -r 2>/dev/null || true

NPM_VERSION=$("$NPM_CMD" -v)
echo -e "${GREEN}  ✓ npm $NPM_VERSION${NC}"

# ==========================================
# 第3步：检测并安装 PM2
# ==========================================
echo ""
echo -e "${CYAN}[3/6] 检测 PM2 进程管理器...${NC}"
if ! command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}  PM2 未安装，正在全局安装...${NC}"
  npm install -g pm2
  hash -r 2>/dev/null || true
fi

if command -v pm2 &> /dev/null; then
  echo -e "${GREEN}  ✓ PM2 $(pm2 -v)${NC}"
else
  echo ""
  echo -e "${RED}  ✗ PM2 安装失败${NC}"
  echo ""
  echo -e "${YELLOW}  请手动安装 PM2：${NC}"
  echo ""
  echo "    $NPM_CMD install -g pm2"
  echo "    export PATH=\"$NPM_DIR:\$PATH\""
  echo ""
  echo -e "${YELLOW}  然后重新运行：bash install.sh${NC}"
  echo ""
  exit 1
fi

# ==========================================
# 第4步：检查前端资源
# ==========================================
echo ""
echo -e "${CYAN}[4/6] 检查前端资源...${NC}"
if [ -f "web/dist/index.html" ]; then
  echo -e "${GREEN}  ✓ 前端构建产物完整${NC}"
else
  echo -e "${RED}  ✗ 前端资源缺失（web/dist/index.html 不存在）${NC}"
  echo -e "${YELLOW}  请确认压缩包完整解压${NC}"
  exit 1
fi

# ==========================================
# 第5步：安装后端依赖
# ==========================================
echo ""
echo -e "${CYAN}[5/6] 安装后端依赖...${NC}"

# 切换国内镜像源（加速安装）
NPM_REGISTRY=$("$NPM_CMD" config get registry 2>/dev/null || echo "")
if [ -z "$NPM_REGISTRY" ] || echo "$NPM_REGISTRY" | grep -q "registry.npmjs.org"; then
  echo -e "${YELLOW}  切换 npm 国内镜像源以加速安装...${NC}"
  "$NPM_CMD" config set registry https://registry.npmmirror.com
fi

cd server
echo -e "${CYAN}  正在安装依赖（可能需要 1-3 分钟）...${NC}"
if "$NPM_CMD" install --production; then
  echo -e "${GREEN}  ✓ 后端依赖安装完成${NC}"
else
  echo ""
  echo -e "${RED}  ✗ 后端依赖安装失败${NC}"
  echo ""
  echo -e "${YELLOW}  可能原因：${NC}"
  echo -e "${YELLOW}  1. 网络问题，npm 镜像源访问失败${NC}"
  echo -e "${YELLOW}  2. 权限问题${NC}"
  echo ""
  echo -e "${YELLOW}  可尝试手动安装：${NC}"
  echo ""
  echo "    cd /www/wwwroot/asolica/server"
  echo "    $NPM_CMD install --production"
  echo ""
  exit 1
fi
cd "$SCRIPT_DIR"

# ==========================================
# 第6步：创建配置和目录
# ==========================================
echo ""
echo -e "${CYAN}[6/6] 创建配置文件和目录...${NC}"

# 创建 .env（如果不存在）
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
  else
    echo "JWT_SECRET=" > .env
    echo "PORT=3200" >> .env
    echo "NODE_ENV=production" >> .env
  fi
  echo -e "${GREEN}  ✓ 已创建 .env 配置文件${NC}"
else
  echo -e "${GREEN}  ✓ .env 已存在${NC}"
fi

# 创建运行时目录
mkdir -p server/data server/uploads server/logs server/backups
echo -e "${GREEN}  ✓ 已创建运行时目录${NC}"

# ==========================================
# 完成
# ==========================================
echo ""
echo "=========================================="
echo -e "${GREEN}  ✓ 安装完成！${NC}"
echo "=========================================="
echo ""
echo "下一步：启动服务"
echo ""
echo "  方式A - 直接启动（关掉终端就停）："
echo "    cd server && node src/app.js"
echo ""
echo "  方式B - 用 PM2 守护（推荐，关终端也不停）："
echo "    pm2 start ecosystem.config.cjs --env production"
echo "    pm2 save"
echo "    pm2 startup  # 设置开机自启"
echo ""
echo "  方式C - 用 PM2 命令行启动（等价于方式B）："
echo "    pm2 start server/src/app.js --name asolica-server"
echo ""
echo "  首次启动会自动："
echo "    - 生成随机 JWT_SECRET（写入 .env）"
echo "    - 创建数据库"
echo "    - 创建管理员账号（密码在启动日志里）"
echo ""
echo "  访问地址："
echo "    http://服务器IP:3200"
echo "    后台登录：http://服务器IP:3200/#/login"
echo ""
echo "  查看管理员密码："
echo "    pm2 logs asolica-server --lines 30"
echo ""
echo "=========================================="
