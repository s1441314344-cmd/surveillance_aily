# Checklist - 智能巡检系统 v4.0 验收清单

## Phase 1: 数据库设计与实现

- [x] cameras表创建成功，包含所有必需字段
- [x] rules表创建成功，支持长文本提示词存储
- [x] detection_records表创建成功，支持JSON格式结果存储
- [x] 数据库连接模块可正常初始化

## Phase 2: 服务层实现

- [x] CameraService可正常CRUD摄像头
- [x] CameraService可测试RTSP连接
- [x] RuleService可正常CRUD规则
- [x] RuleService提示词模板可正常保存和加载
- [x] RecordService可正常CRUD记录
- [x] RecordService支持分页查询
- [x] LLMService可成功调用智谱API
- [x] LocalDetectService检测结果可保存到数据库

## Phase 3: API层实现

- [x] GET /api/cameras 返回摄像头列表
- [x] POST /api/cameras 可创建摄像头
- [x] PUT /api/cameras/<id> 可更新摄像头
- [x] DELETE /api/cameras/<id> 可删除摄像头
- [x] GET /api/rules 返回规则列表
- [x] POST /api/rules 可创建规则
- [x] PUT /api/rules/<id> 可更新规则
- [x] DELETE /api/rules/<id> 可删除规则
- [x] POST /api/detect 可上传图片并检测
- [x] GET /api/records 返回分页记录
- [x] GET /api/records/<id> 返回单条记录详情
- [x] GET /api/records/export 可导出CSV

## Phase 4: 前端实现

- [x] 摄像头管理页面可正常加载
- [x] 摄像头管理页面可CRUD摄像头
- [x] 规则管理页面可正常加载
- [x] 规则管理页面可CRUD规则
- [x] 图片检测页面可上传图片
- [x] 图片检测页面可调用大模型检测
- [x] 检测记录页面可查询记录
- [x] 检测记录页面支持分页

## Phase 5: 配置与部署

- [x] config.ini不再包含Aily相关配置
- [x] config.ini不再包含飞书多维表格配置
- [x] 数据库路径配置正确
- [x] 智谱API Key配置正确
- [x] 废弃服务已从api_server.py移除

## Phase 6: 测试验证

- [x] 数据库CRUD测试通过
- [x] API端点测试通过
- [x] 前端页面测试通过
- [x] 完整检测流程测试通过
- [x] 检测结果正确保存到数据库
- [x] 记录查询功能正常
- [x] 修复415错误（FormData上传问题）
- [x] 修复numpy数据类型JSON序列化问题

## 验收标准

所有checkbox项完成后，系统需满足：

1. **不依赖Aily** - 代码中无AilyService引用
2. **不依赖飞书多维表格** - 代码中无FeishuService/飞书API引用
3. **数据真实保存** - SQLite数据库包含所有数据
4. **请求真实** - 前端请求真实发送到服务器
5. **大模型真实调用** - 智谱API返回真实结果