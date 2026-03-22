# 智能巡检系统 - 飞书网页应用部署指南

## 📋 与小妹应用的主要区别

| 特性 | 小程序 | 网页应用 |
|------|--------|----------|
| **开发技术** | TTML/TTSS/JS | HTML/CSS/JS |
| **部署方式** | 上传到飞书平台 | 部署到自己的服务器 |
| **访问方式** | 飞书工作台 | 飞书内嵌H5或浏览器 |
| **功能限制** | 受小程序API限制 | 标准Web功能 |
| **审核要求** | 需要飞书审核 | 配置即可使用 |

## 🚀 部署步骤

### 1. 准备工作

#### 1.1 注册飞书开发者账号
- 访问 [飞书开放平台](https://open.feishu.cn/)
- 注册开发者账号
- 创建企业自建应用

#### 1.2 获取应用凭证
在应用管理后台获取：
- **App ID** (cli_xxxxxxxx)
- **App Secret**

### 2. 部署后端API服务器

#### 2.1 部署 `api_server.py`
将后端API部署到服务器，确保：
- Python 3.9+ 环境
- 安装依赖：`pip install flask flask-cors`
- 配置 `config.ini` 文件
- 使用 HTTPS（飞书要求）

#### 2.2 配置Nginx反向代理
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # 前端静态文件
    location / {
        root /path/to/feishu_webapp;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # API接口
    location /api {
        proxy_pass http://localhost:5002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 允许跨域
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
    }
}
```

### 3. 部署前端网页应用

#### 3.1 修改配置
编辑 `index.html` 第481-484行：
```javascript
const CONFIG = {
    API_BASE_URL: 'https://your-domain.com/api',  // 替换为你的域名
    FEISHU_APP_ID: 'cli_xxxxxxxxxx'  // 替换为你的App ID
};
```

#### 3.2 上传文件到服务器
将 `feishu_webapp/index.html` 上传到服务器：
```bash
# 示例：上传到Nginx目录
scp index.html root@your-server:/var/www/html/
```

### 4. 飞书开放平台配置

#### 4.1 开启网页应用能力
1. 进入飞书开放平台 → 你的应用
2. 点击"应用能力" → "添加应用能力"
3. 选择"网页应用"
4. 填写配置：
   - **桌面端主页地址**: `https://your-domain.com`
   - **移动端主页地址**: `https://your-domain.com`
   - **PC端自定义尺寸**: 建议 1200x800

#### 4.2 配置安全域名
在"安全设置" → "重定向URL"中添加：
```
https://your-domain.com
```

#### 4.3 配置权限
在"权限管理"中添加：
- `contact:user.base:readonly` - 获取用户基本信息

### 5. 发布应用

#### 5.1 创建版本
1. 进入"版本管理与发布"
2. 点击"创建版本"
3. 填写版本信息
4. 选择可见范围

#### 5.2 发布
点击"发布"即可，**无需审核**！

## 🔧 功能说明

### 网页应用功能

| 功能模块 | 说明 |
|---------|------|
| **统计卡片** | 显示巡检点位数量、今日上传数、待处理数 |
| **巡检点位选择** | 从飞书多维表加载，点击选择 |
| **检测配置** | 选择检测类型（人员/车辆/全部）和上传模式 |
| **图片上传** | 支持拍照、相册选择、拖拽上传 |
| **结果展示** | 显示上传成功信息、检测目标数、Aily文件ID |
| **操作日志** | 实时显示操作记录和错误信息 |

### 飞书JS-SDK功能

网页应用集成了飞书JS-SDK，支持：
- ✅ 获取当前用户信息
- ✅ 调用飞书原生能力
- ✅ 适配飞书主题

## 📱 使用方式

### 方式1：飞书工作台
1. 打开飞书 → 工作台
2. 找到"智能巡检系统"应用
3. 点击即可在飞书内打开

### 方式2：浏览器直接访问
直接访问 `https://your-domain.com` 即可使用

## 🔒 安全说明

1. **HTTPS必须** - 飞书要求网页应用必须使用HTTPS
2. **域名白名单** - 需要在飞书后台配置安全域名
3. **用户鉴权** - 可通过飞书JS-SDK获取用户身份

## 🐛 常见问题

### Q1: 网页应用无法打开
**A:** 检查以下几点：
1. 是否使用HTTPS
2. 域名是否已添加到飞书后台的"重定向URL"
3. 网页应用能力是否已开启

### Q2: API请求失败
**A:** 
1. 检查 `API_BASE_URL` 配置是否正确
2. 检查后端API是否正常运行
3. 检查跨域配置是否正确

### Q3: 无法获取用户信息
**A:**
1. 检查是否已申请 `contact:user.base:readonly` 权限
2. 检查用户是否已授权

### Q4: 图片上传失败
**A:**
1. 检查后端 `/api/upload` 接口
2. 检查文件大小限制
3. 查看浏览器控制台错误信息

## 📞 技术支持

- 飞书开放平台文档：https://open.feishu.cn/document/
- 飞书JS-SDK文档：https://open.feishu.cn/document/uYjL24iN/uYjM24iN

---

**部署完成后，用户可以在飞书工作台或浏览器中直接使用这个网页应用！** 🎉
