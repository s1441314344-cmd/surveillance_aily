#!/bin/bash

# ============================================
# 智能巡检系统 - LocalTunnel 启动脚本
# ============================================

echo "🚀 正在启动智能巡检系统..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo -e "${RED}❌ 错误：未找到虚拟环境 venv${NC}"
    exit 1
fi

# 激活虚拟环境
source venv/bin/activate

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
echo -e "${BLUE}🌍 使用 LocalTunnel...${NC}"
echo -e "${YELLOW}⏳ 正在创建隧道，请稍候...${NC}"

# 启动LocalTunnel
rm -f logs/localtunnel.log
nohup lt --port 5002 > logs/localtunnel.log 2>&1 &
LT_PID=$!
echo $LT_PID > .localtunnel_pid

# 等待并提取URL（最多等待30秒）
TUNNEL_URL=""
for i in {1..30}; do
    sleep 1
    TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.loca\.lt' logs/localtunnel.log 2>/dev/null | head -1)
    if [ -n "$TUNNEL_URL" ]; then
        break
    fi
    if [ $((i % 5)) -eq 0 ]; then
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
    echo -e "${YELLOW}⚠️  注意：${NC}"
    echo -e "   1. 首次访问需要输入验证码（查看下方日志）"
    echo -e "   2. 地址有效期约24小时"
    echo ""
    echo -e "${BLUE}📊 服务状态:${NC}"
    echo "   API日志: tail -f logs/api_server.log"
    echo "   隧道日志: tail -f logs/localtunnel.log"
    echo ""
    echo -e "${YELLOW}按 Ctrl+C 停止服务，或在另一个终端运行 ./stop.sh${NC}"

    # 显示LocalTunnel日志以便查看验证码
    echo ""
    echo -e "${BLUE}📝 LocalTunnel 日志（查看验证码）:${NC}"
    sleep 2
    tail -20 logs/localtunnel.log
else
    echo -e "${YELLOW}⏳ 隧道正在建立中...${NC}"
    echo -e "${BLUE}   请查看日志: tail -f logs/localtunnel.log${NC}"
fi

# 保持脚本运行
wait
