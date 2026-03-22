# 智能巡检系统 v4.0 规格说明书

## Why

当前基于飞书Aily和多维表格的智能巡检系统存在以下问题：

* 依赖第三方平台，架构复杂

* 调试困难，排查问题耗时

* 数据分散，难以统一管理

需要设计一套**独立运行的智能巡检系统**，不依赖Aily和多维表格，实现完整的本地化智能巡检功能。

## What Changes

### 核心变化

* **完全脱离Aily**：使用智谱GLM-4V作为图像分析引擎

* **完全脱离多维表格**：使用SQLite本地数据库存储所有数据

* **独立部署**：单服务器部署，无需外部依赖

### 新增功能模块

1. **摄像头配置管理** - 管理摄像头RTSP地址、抽帧参数
2. **巡检规则配置** - 管理提示词模板，动态调整
3. **本地图片测试** - 上传图片模拟摄像头抽帧
4. **检测记录存储** - SQLite数据库持久化
5. **大模型集成** - 智谱GLM-4V图像分析

## Impact

### 废弃的组件

* ~~AilyService~~ - 不再使用

* ~~FeishuService~~ - 不再使用

* ~~飞书多维表格API~~ - 不再使用

* ~~RuleService (飞书版)~~ - 重写为本地版本

* ~~PointService (飞书版)~~ - 重写为本地版本

### 新增的组件

* CameraService - 摄像头本地管理

* RuleService (本地版) - 巡检规则本地CRUD

* PromptService - 提示词模板管理

* LLMService - 智谱大模型调用

* LocalDetectService - 本地检测服务

* SQLite数据库 - 数据持久化

### 保留的组件

* api\_server.py - Flask API服务（需改造）

* 前端页面 - 重写为本地版本

## ADDED Requirements

### Requirement: 摄像头配置管理

系统 SHALL 提供摄像头的完整配置管理功能。

#### Scenario: 添加新摄像头

* **WHEN** 管理员添加新摄像头

* **THEN** 系统保存摄像头信息到SQLite数据库，并返回摄像头ID

#### Scenario: 配置抽帧参数

* **WHEN** 管理员配置摄像头抽帧频率

* **THEN** 系统保存频率配置，支持按时间间隔或定时任务抽帧

### Requirement: 巡检规则管理

系统 SHALL 提供巡检规则的完整CRUD操作。

#### Scenario: 创建巡检规则

* **WHEN** 管理员创建新巡检规则

* **THEN** 系统保存规则到SQLite，包含规则名称、提示词内容、关联点位

#### Scenario: 更新规则提示词

* **WHEN** 管理员修改规则的提示词

* **THEN** 系统更新数据库中的提示词内容

### Requirement: 图片检测

系统 SHALL 支持上传图片并调用大模型进行分析。

#### Scenario: 上传图片进行检测

* **WHEN** 用户上传图片并选择巡检规则

* **THEN** 系统调用智谱GLM-4V分析图片，返回结构化结果

#### Scenario: 检测结果保存

* **WHEN** 检测完成

* **THEN** 系统将检测结果保存到SQLite数据库

### Requirement: 检测记录查询

系统 SHALL 提供检测记录的查询和导出功能。

#### Scenario: 分页查询记录

* **WHEN** 用户查询检测记录

* **THEN** 系统返回分页的检测记录列表

#### Scenario: 按条件筛选

* **WHEN** 用户指定筛选条件（时间范围、点位、规则）

* **THEN** 系统返回符合条件的记录

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Web 前端 (Vue3/原生JS)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ 摄像头管理 │ │ 规则管理  │ │ 图片检测  │ │ 记录查询  │      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │
└───────┼─────────────┼─────────────┼─────────────┼───────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             │ HTTP/REST
┌────────────────────────────┴────────────────────────────────┐
│                    Flask API Server (v4.0)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ 摄像头API │ │ 规则API  │ │ 检测API  │ │ 记录API  │     │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │
└───────┼─────────────┼─────────────┼─────────────┼────────────┘
        │             │             │             │
        ▼             ▼             ▼             ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│    SQLite     │ │   智谱GLM-4V   │ │   本地文件    │
│   Database    │ │   大模型API    │ │   存储       │
│               │ │               │ │              │
└───────────────┘ └───────────────┘ └───────────────┘
```

## Data Models

### Camera (摄像头)

```python
{
    "id": int,              # 主键
    "code": str,            # 编码
    "name": str,            # 名称
    "rtsp_url": str,       # RTSP地址
    "location": str,        # 位置描述
    "frequency": int,      # 抽帧频率（秒）
    "status": str,          # active/inactive
    "created_at": datetime,
    "updated_at": datetime
}
```

### Rule (巡检规则)

```python
{
    "id": int,              # 主键
    "code": str,            # 编码
    "name": str,            # 规则名称
    "prompt_content": str,   # 提示词内容
    "description": str,      # 描述
    "status": str,          # active/inactive
    "created_at": datetime,
    "updated_at": datetime
}
```

### DetectionRecord (检测记录)

```python
{
    "id": int,              # 主键
    "camera_id": int,       # 摄像头ID
    "rule_id": int,         # 规则ID
    "image_path": str,      # 原始图片路径
    "result_image_path": str,# 结果图片路径
    "llm_result": str,      # LLM分析结果(JSON)
    "has_violation": bool,  # 是否违规
    "detect_time": datetime,
    "created_at": datetime
}
```

## API Endpoints

### 摄像头管理

* `GET /api/cameras` - 获取摄像头列表

* `GET /api/cameras/<id>` - 获取摄像头详情

* `POST /api/cameras` - 创建摄像头

* `PUT /api/cameras/<id>` - 更新摄像头

* `DELETE /api/cameras/<id>` - 删除摄像头

### 巡检规则管理

* `GET /api/rules` - 获取规则列表

* `GET /api/rules/<id>` - 获取规则详情

* `POST /api/rules` - 创建规则

* `PUT /api/rules/<id>` - 更新规则

* `DELETE /api/rules/<id>` - 删除规则

### 检测功能

* `POST /api/detect` - 图片检测（上传图片+选择规则）

* `POST /api/detect/camera/<id>` - 摄像头抽帧检测

### 记录查询

* `GET /api/records` - 获取检测记录（分页+筛选）

* `GET /api/records/<id>` - 获取记录详情

* `GET /api/records/export` - 导出记录(CSV/Excel)

## Technical Stack

| 组件   | 技术选型         | 说明          |
| ---- | ------------ | ----------- |
| 后端   | Python Flask | 轻量级API服务    |
| 数据库  | SQLite       | 本地持久化存储     |
| 大模型  | 智谱GLM-4V     | 图像分析引擎      |
| 前端   | HTML/CSS/JS  | 响应式Web界面    |
| 图像处理 | OpenCV       | RTSP连接、图像处理 |

