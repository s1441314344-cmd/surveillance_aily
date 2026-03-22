# Tasks - 智能巡检系统 v4.0 开发任务

## Phase 1: 数据库设计与实现

- [x] Task 1.1: 创建SQLite数据库表结构
  - [x] SubTask 1.1.1: 创建cameras表
  - [x] SubTask 1.1.2: 创建rules表
  - [x] SubTask 1.1.3: 创建detection_records表
  - [x] SubTask 1.1.4: 初始化数据库连接模块

- [x] Task 1.2: 创建数据库操作模块 (db.py)
  - [x] SubTask 1.2.1: 实现数据库初始化函数
  - [x] SubTask 1.2.2: 实现基础CRUD操作
  - [x] SubTask 1.2.3: 实现数据库迁移脚本

## Phase 2: 服务层实现

- [x] Task 2.1: 重写CameraService（本地版本）
  - [x] SubTask 2.1.1: 实现摄像头的CRUD
  - [x] SubTask 2.1.2: 实现RTSP连接测试
  - [x] SubTask 2.1.3: 实现抽帧功能

- [x] Task 2.2: 重写RuleService（本地版本）
  - [x] SubTask 2.2.1: 实现规则的CRUD
  - [x] SubTask 2.2.2: 实现提示词模板管理
  - [x] SubTask 2.2.3: 实现规则与点位的关联

- [x] Task 2.3: 实现RecordService（检测记录服务）
  - [x] SubTask 2.3.1: 实现记录的CRUD
  - [x] SubTask 2.3.2: 实现分页查询
  - [x] SubTask 2.3.3: 实现记录导出功能

- [x] Task 2.4: 完善LLMService（已存在，需适配）
  - [x] SubTask 2.4.1: 确保API端点正确
  - [x] SubTask 2.4.2: 实现结果解析

- [x] Task 2.5: 完善LocalDetectService（已存在，需适配）
  - [x] SubTask 2.5.1: 对接新的RecordService
  - [x] SubTask 2.5.2: 实现图片保存

## Phase 3: API层实现

- [x] Task 3.1: 重构api_server.py
  - [x] SubTask 3.1.1: 添加数据库初始化
  - [x] SubTask 3.1.2: 添加摄像头管理API
  - [x] SubTask 3.1.3: 添加规则管理API
  - [x] SubTask 3.1.4: 添加检测记录API
  - [x] SubTask 3.1.5: 添加图片上传接口

## Phase 4: 前端实现

- [x] Task 4.1: 创建新版前端页面
  - [x] SubTask 4.1.1: 摄像头配置管理页面
  - [x] SubTask 4.1.2: 巡检规则管理页面
  - [x] SubTask 4.1.3: 图片上传检测页面
  - [x] SubTask 4.1.4: 检测记录查询页面

## Phase 5: 配置与部署

- [x] Task 5.1: 更新配置文件
  - [x] SubTask 5.1.1: 更新config.ini，移除Aily/飞书配置
  - [x] SubTask 5.1.2: 添加数据库路径配置

- [x] Task 5.2: 清理废弃代码
  - [x] SubTask 5.2.1: 移除AilyService引用
  - [x] SubTask 5.2.2: 移除FeishuService引用
  - [x] SubTask 5.2.3: 移除旧版飞书API端点

## Phase 6: 测试验证

- [x] Task 6.1: 单元测试
  - [x] SubTask 6.1.1: 测试数据库CRUD
  - [x] SubTask 6.1.2: 测试摄像头管理API
  - [x] SubTask 6.1.3: 测试规则管理API
  - [x] SubTask 6.1.4: 测试检测API

- [x] Task 6.2: 集成测试
  - [x] SubTask 6.2.1: 完整检测流程测试
  - [x] SubTask 6.2.2: 大模型调用测试
  - [x] SubTask 6.2.3: 数据持久化验证

## Task Dependencies

```
Phase 1 (数据库) → Phase 2 (服务层) → Phase 3 (API层) → Phase 4 (前端) → Phase 5 (配置) → Phase 6 (测试)
```

## Validation

每个Phase完成后需要验证：
1. 数据库表正确创建
2. API返回正确数据
3. 前端页面正常访问
4. 完整流程可运行