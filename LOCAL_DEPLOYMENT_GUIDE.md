# 🚀 智能巡检系统 - 本地部署指南（内网穿透版）

> **无需购买服务器，让其他人通过互联网访问你的本地服务**

## 📋 方案概述

使用 **Cloudflare Tunnel**（推荐）或其他内网穿透工具，将你的Mac电脑变成一台临时服务器，其他人可以通过公网链接访问。

### ✅ 优势
- 完全免费
- 无需购买服务器
- 无需域名和备案
- 一键启动，自动配置
- 支持HTTPS（飞书要求）

### ⚠️ 限制
- 需要保持电脑开机和联网
- 每次重启会获得新的公网地址（可配置固定地址）
- 受限于你的网络带宽

---

## 🛠️ 快速开始（3步搞定）

### 第1步：停止现有服务

先停止之前运行的服务，释放端口：

```bash
# 在项目目录下运行
./stop.sh
```

或者手动停止：
```bash
# 停止API服务器
pkill -f api_server.py

# 停止其他Python进程
pkill -f python
```

### 第2步：一键启动

```bash
# 在项目目录下运行
./start_with_tunnel.sh
```

你会看到菜单：
```
请选择内网穿透方式：

  1) Cloudflare Tunnel (推荐 - 免费、稳定)
  2) Ngrok (需要注册获取token)
  3) Cpolar (国内访问快)
  4) 仅本地访问 (不启用内网穿透)

请输入选项 (1-4):
```

**推荐选择 1**（Cloudflare Tunnel），完全免费且无需注册！

### 第3步：获取公网地址

选择1后，等待几秒钟，你会看到类似这样的输出：

```
═══════════════════════════════════════════════════
  ✅ 部署成功！
═══════════════════════════════════════════════════

🌐 公网访问地址：
   https://abc123def.trycloudflare.com

📱 飞书网页应用配置：
   1. 进入飞书开放平台
   2. 创建网页应用
   3. 移动端主页：https://abc123def.trycloudflare.com/feishu_webapp/
   4. 桌面端主页：https://abc123def.trycloudflare.com/feishu_webapp/

⚠️  注意：此地址有效期约24小时，重启后会变化
   如需固定地址，请使用 Cloudflare 固定隧道
```

**复制这个 `https://abc123def.trycloudflare.com` 地址，其他人就可以访问了！**

---

## 📱 配置飞书网页应用

### 1. 进入飞书开放平台
访问：https://open.feishu.cn/app

### 2. 创建网页应用
1. 点击「创建应用」
2. 选择「网页应用」
3. 填写应用名称（如：智能巡检系统）
4. 点击「确定创建」

### 3. 配置应用主页
在应用详情页，找到「网页应用配置」：

| 配置项 | 填写内容 |
|--------|----------|
| 移动端主页 | `https://abc123def.trycloudflare.com/feishu_webapp/` |
| 桌面端主页 | `https://abc123def.trycloudflare.com/feishu_webapp/` |

（将 `abc123def.trycloudflare.com` 替换为你实际的地址）

### 4. 发布应用
1. 点击「版本管理与发布」
2. 点击「创建版本」
3. 填写版本号（如：1.0.0）
4. 点击「保存并发布」
5. 申请发布

### 5. 使用应用
发布后，你可以在飞书客户端的「工作台」中找到并使用这个应用！

---

## 🔧 高级配置

### 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **Cloudflare Tunnel** | 免费、无需注册、自动HTTPS | 地址每次变化 | 临时测试、演示 |
| **Ngrok** | 稳定、功能丰富 | 需要注册、免费版有限制 | 长期开发测试 |
| **Cpolar** | 国内访问快 | 需要注册 | 国内用户使用 |
| **仅本地** | 最简单 | 只能本机访问 | 本地开发 |

### 固定公网地址（可选）

如果你希望地址固定不变，可以使用 Cloudflare 的固定隧道：

1. 注册 Cloudflare 账号：https://dash.cloudflare.com
2. 添加一个域名（可以使用免费域名如 .tk）
3. 创建固定隧道，绑定到 `localhost:5002`
4. 使用固定域名访问

详细教程：https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

---

## 🛑 停止服务

当你想停止服务时：

```bash
./stop.sh
```

或者按 `Ctrl+C` 停止启动脚本。

---

## ❓ 常见问题

### Q1: 提示 "Permission denied"
```bash
# 给脚本添加执行权限
chmod +x start_with_tunnel.sh stop.sh
```

### Q2: 端口被占用
```bash
# 查看占用5002端口的进程
lsof -i :5002

# 结束进程
kill -9 <PID>
```

### Q3: Cloudflare Tunnel 安装失败
```bash
# 手动安装
brew install cloudflared

# 或者下载安装包
# https://github.com/cloudflare/cloudflared/releases
```

### Q4: 其他人无法访问
1. 检查你的Mac是否联网
2. 检查防火墙设置（系统偏好设置 → 安全性与隐私 → 防火墙）
3. 尝试重启服务获取新的地址

### Q5: 飞书提示 "无法打开页面"
1. 确保地址以 `https://` 开头
2. 检查地址是否完整（包含 `/feishu_webapp/`）
3. 确认服务正在运行（查看终端输出）

---

## 📊 文件说明

```
surveillance_aily/
├── start_with_tunnel.sh    # 一键启动脚本（含内网穿透）
├── stop.sh                  # 停止服务脚本
├── api_server.py            # API服务器
├── feishu_webapp/
│   └── index.html          # 飞书网页应用
├── logs/                    # 日志目录
│   ├── api_server.log      # API日志
│   └── tunnel.log          # 隧道日志
└── LOCAL_DEPLOYMENT_GUIDE.md # 本指南
```

---

## 🎉 完成！

现在你可以：
1. ✅ 在本地运行智能巡检系统
2. ✅ 通过公网链接让其他人访问
3. ✅ 在飞书中使用网页应用
4. ✅ 拍照上传并触发Aily技能

**提示**：记得保持电脑开机和联网，否则服务会中断！

---

## 💡 建议

- **演示/测试**：使用 Cloudflare Tunnel（方案1）
- **长期使用**：建议购买云服务器（约30元/月）
- **团队协作**：考虑部署到阿里云/腾讯云

有任何问题随时问我！
