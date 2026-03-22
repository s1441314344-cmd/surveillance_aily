# 智能巡检系统 - 飞书小程序部署指南

## 📋 目录结构

```
feishu_miniapp/
├── app.js              # 小程序入口
├── app.json            # 全局配置
├── pages/
│   ├── index/          # 首页 - 巡检点位列表
│   │   ├── index.js
│   │   ├── index.ttml
│   │   └── index.ttss
│   ├── upload/         # 上传页面 - 拍照上传
│   │   ├── upload.js
│   │   ├── upload.ttml
│   │   └── upload.ttss
│   └── result/         # 结果页面 - 显示上传结果
│       ├── result.js
│       ├── result.ttml
│       └── result.ttss
└── images/             # 图标资源（需要自行添加）
    ├── home.png
    ├── home-active.png
    ├── upload.png
    └── upload-active.png
```

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
- **Encrypt Key** (用于消息加密)
- **Verification Token**

#### 1.3 配置服务器域名
在"开发配置" → "服务器域名"中添加：
```
request合法域名: https://your-server-domain.com
uploadFile合法域名: https://your-server-domain.com
```

### 2. 后端API部署

#### 2.1 部署 `api_server.py`
将 `api_server.py` 部署到服务器，确保：
- Python 3.9+ 环境
- 安装依赖：`pip install flask flask-cors`
- 配置 `config.ini` 文件
- 使用 HTTPS（飞书小程序要求）

#### 2.2 配置反向代理（Nginx示例）
```nginx
server {
    listen 443 ssl;
    server_name your-server-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /api {
        proxy_pass http://localhost:5002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. 小程序配置

#### 3.1 修改 `app.js`
更新 API 基础地址：
```javascript
globalData: {
    apiBaseUrl: 'https://your-server-domain.com/api',
    // ...
}
```

#### 3.2 配置 `app.json`
确保页面路径正确：
```json
{
  "pages": [
    "pages/index/index",
    "pages/upload/upload",
    "pages/result/result"
  ]
}
```

### 4. 飞书开放平台配置

#### 4.1 应用能力配置
在"应用能力"中开启：
- ✅ 网页应用
- ✅ 机器人
- ✅ 事件订阅（可选）

#### 4.2 权限配置
在"权限管理"中添加：
- `contact:user.base:readonly` - 获取用户基本信息
- `contact:user.employee_id:readonly` - 获取用户 employee_id
- `im:chat:readonly` - 读取群组信息（可选）

#### 4.3 登录配置
在"安全设置" → "登录配置"中：
- 添加登录回调地址
- 配置登录成功后的跳转页面

### 5. 发布小程序

#### 5.1 上传代码
使用飞书开发者工具：
1. 下载并安装 [飞书开发者工具](https://open.feishu.cn/document/uYjL24iN/ucDOzYjL3gzM24yN4MjN)
2. 导入项目（选择 `feishu_miniapp` 目录）
3. 填写 App ID
4. 点击"上传"按钮

#### 5.2 提交审核
在飞书开放平台：
1. 进入"版本管理与发布"
2. 创建新版本
3. 填写版本信息
4. 提交审核

#### 5.3 发布上线
审核通过后：
1. 点击"发布"
2. 选择可见范围（全员/部分成员）
3. 确认发布

## 🔧 功能说明

### 首页功能
- 显示巡检点位列表（从飞书多维表获取）
- 显示统计数据（点位数量、今日上传等）
- 快速拍照上传按钮
- 点击巡检点位进入上传页面

### 上传页面功能
- 选择巡检点位
- 选择检测类型（人员/车辆/全部）
- 选择上传模式（Aily技能/多维表格）
- 拍照或从相册选择图片
- 上传并显示结果

### 结果页面功能
- 显示上传成功信息
- 显示检测目标数量
- 显示Aily文件ID
- 返回首页或重新上传

## ⚙️ 配置说明

### 后端配置 (`config.ini`)
```ini
[aily]
app_id = cli_xxxxxxxxxx
app_secret = xxxxxxxxxxxx
use_aily = True
app = spring_xxxxxx
skill = skill_xxxxxx

[base]
token = xxxxxxxxxxxx
```

### 小程序配置 (`app.js`)
```javascript
globalData: {
    apiBaseUrl: 'https://your-server-domain.com/api',
    userInfo: null
}
```

## 🐛 常见问题

### Q1: 小程序无法连接后端API
**A:** 检查以下几点：
1. 后端API是否使用HTTPS
2. 域名是否已添加到飞书后台的"服务器域名"
3. `app.js` 中的 `apiBaseUrl` 是否正确

### Q2: 上传图片失败
**A:** 
1. 检查 `uploadFile` 域名配置
2. 检查后端API的 `/api/upload` 接口是否正常
3. 查看后端日志获取详细错误信息

### Q3: 无法获取巡检点位列表
**A:**
1. 检查飞书token是否有效
2. 检查多维表格权限
3. 检查 `camera_table_id` 配置

### Q4: Aily技能没有触发
**A:**
1. 检查 `app` 和 `skill` 配置是否正确
2. 检查Aily应用是否有权限
3. 查看Aily后台日志

## 📱 使用流程

1. **打开小程序** → 自动登录并加载巡检点位
2. **选择巡检点位** → 点击列表中的点位或快速上传
3. **配置检测参数** → 选择检测类型和上传模式
4. **拍照上传** → 拍照或选择相册图片
5. **查看结果** → 显示上传成功信息和检测结果

## 🔒 安全说明

- 所有API请求都需要携带token
- 后端需要验证飞书登录凭证
- 图片上传使用HTTPS加密传输
- 敏感信息（app_secret）不要存储在小程序端

## 📞 技术支持

如有问题，请联系：
- 飞书开放平台文档：https://open.feishu.cn/document/
- 小程序开发文档：https://open.feishu.cn/document/uYjL24iN/uMjNzUjLzMjM14yM2ITN

---

**部署完成后，用户可以在飞书工作台中找到并使用这个小程序！** 🎉
