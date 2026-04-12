#!/bin/bash

# ============================================
# 智能巡检系统 - 自动启动脚本（Cloudflare Tunnel）
# ============================================

# 添加本地bin到PATH
export PATH="$HOME/.local/bin:$PATH"

echo "🚀 正在启动智能巡检系统..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo -e "${RED}❌ 错误：未找到虚拟环境 venv${NC}"
    echo "请先创建虚拟环境并安装依赖："
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -r requirements.txt"
    exit 1
fi

# 激活虚拟环境
source venv/bin/activate

# 检查必要的Python包
echo -e "${BLUE}📦 检查依赖...${NC}"
pip list | grep -i flask > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  正在安装依赖...${NC}"
    pip install -r requirements.txt
fi

# 创建日志目录
mkdir -p logs

# 启动API服务器
echo -e "${GREEN}🌐 启动API服务器...${NC}"
nohup arch -arm64 venv/bin/python api_server.py > logs/api_server.log 2>&1 &
API_PID=$!
echo $API_PID > .api_pid
echo -e "${GREEN}✅ API服务器已启动 (PID: $API_PID)${NC}"
echo -e "${BLUE}   本地地址: http://localhost:5002${NC}"

# 等待API启动
echo -e "${YELLOW}⏳ 等待API启动...${NC}"
sleep 5

# 检查API是否正常
curl -s http://localhost:5002/api/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ API健康检查通过${NC}"
else
    echo -e "${YELLOW}⚠️  API可能还在启动中...${NC}"
fi

echo ""
echo -e "${BLUE}☁️  使用 Cloudflare Tunnel...${NC}"

# 检查是否安装了cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo -e "${YELLOW}📥 正在安装 Cloudflare Tunnel...${NC}"

    # 下载并安装 cloudflared
    if [[ $(uname -m) == "arm64" ]]; then
        # Apple Silicon
        curl -L --output /tmp/cloudflared.tgz https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz 2>/dev/null
        tar -xzf /tmp/cloudflared.tgz -C /tmp 2>/dev/null
        mkdir -p $HOME/.local/bin
        mv /tmp/cloudflared $HOME/.local/bin/
        rm -f /tmp/cloudflared.tgz
    else
        # Intel Mac
        curl -L --output /tmp/cloudflared.tgz https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz 2>/dev/null
        tar -xzf /tmp/cloudflared.tgz -C /tmp 2>/dev/null
        mkdir -p $HOME/.local/bin
        mv /tmp/cloudflared $HOME/.local/bin/
        rm -f /tmp/cloudflared.tgz
    fi
fi

# 检查是否安装成功
if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}❌ Cloudflare Tunnel 安装失败${NC}"
    echo "请手动安装:"
    echo "  mkdir -p ~/.local/bin"
    echo "  curl -L -o ~/.local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64"
    echo "  chmod +x ~/.local/bin/cloudflared"
    exit 1
fi

echo -e "${GREEN}✅ Cloudflare Tunnel 已就绪${NC}"
echo -e "${GREEN}🌐 启动 Cloudflare Tunnel...${NC}"
echo -e "${YELLOW}⏳ 正在创建临时隧道，请稍候（约10-30秒）...${NC}"

# 启动tunnel并捕获URL
rm -f logs/tunnel.log
nohup cloudflared tunnel --url http://localhost:5002 > logs/tunnel.log 2>&1 &
TUNNEL_PID=$!
echo $TUNNEL_PID > .tunnel_pid

# 等待并提取URL（最多等待60秒）
TUNNEL_URL=""
for i in {1..60}; do
    sleep 1
    TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' logs/tunnel.log 2>/dev/null | head -1)
    if [ -n "$TUNNEL_URL" ]; then
        break
    fi
    if [ $((i % 10)) -eq 0 ]; then
        echo -n "."
    fi
done
echo ""

if [ -n "$TUNNEL_URL" ]; then
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ 部署成功！${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BLUE}🌐 公网访问地址：${NC}"
    echo -e "${GREEN}   $TUNNEL_URL${NC}"
    echo ""
    echo -e "${BLUE}📱 飞书网页应用配置：${NC}"
    echo -e "   移动端主页：${GREEN}$TUNNEL_URL/feishu_webapp/${NC}"
    echo -e "   桌面端主页：${GREEN}$TUNNEL_URL/feishu_webapp/${NC}"
    echo ""
    echo -e "${BLUE}🔗 直接访问测试：${NC}"
    echo -e "   ${GREEN}$TUNNEL_URL/feishu_webapp/${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  注意：此地址有效期约24小时，重启后会变化${NC}"
    echo ""
    echo -e "${BLUE}📊 服务状态:${NC}"
    echo "   API日志: tail -f logs/api_server.log"
    echo "   隧道日志: tail -f logs/tunnel.log"
    echo ""
    echo -e "${YELLOW}按 Ctrl+C 停止服务，或在另一个终端运行 ./stop.sh${NC}"
else
    echo -e "${YELLOW}⏳ 隧道正在建立中...${NC}"
    echo -e "${BLUE}   请查看日志: tail -f logs/tunnel.log${NC}"
    echo ""
    echo -e "${YELLOW}按 Ctrl+C 停止服务${NC}"
fi

# 保持脚本运行
wait
