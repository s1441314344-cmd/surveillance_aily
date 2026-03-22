# 智能巡检系统 v4.1 - 新功能需求规格说明书

**项目名称**: 智能巡检系统 v4.1
**版本**: 4.1
**创建日期**: 2026-03-22
**文档类型**: 需求规格说明书
**状态**: 正式版

---

## 1. 项目概述

### 1.1 项目背景

基于现有智能巡检系统 v4.0，本次迭代主要完善以下功能：

1. **检测结果标准格式输出** - 提供结构化、一致的结果格式
2. **自动抽帧功能** - 支持摄像头定时抽帧和自动检测
3. **预设提示词模板** - 建立可管理的模板库，支持智能优化和推荐
4. **明确无用户认证** - 确认不开发登录、权限管理等功能

### 1.2 项目目标

- 提供**标准化、结构化**的检测结果输出格式
- 实现**自动化的摄像头抽帧检测**功能
- 建立**可管理、可优化**的提示词模板系统
- 保持**无用户认证**的设计原则

---

## 2. 功能需求详细分析

### FR-001: 标准格式输出功能

| 属性 | 值 |
|------|-----|
| **需求ID** | FR-001 |
| **需求名称** | 标准格式输出 |
| **优先级** | Must Have |
| **描述** | 系统 SHALL 提供标准化、结构化的检测结果输出格式 |

#### 功能详情

**输出格式结构（严格遵循）：**

```json
{
    "结果": "具体的检测结果数值及状态",
    "描述": "对检测结果的详细说明，包括分析依据、适用场景等",
    "违规原因": "如存在异常或违规情况，需详细列出具体原因；若无违规，填写\"无\"",
    "总结": "对检测结果的综合评价或结论性说明"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 结果 | string | 是 | 检测结果的简明描述，例如："正常"、"发现2人未佩戴安全帽"、"检测通过" |
| 描述 | string | 是 | 详细的分析说明，包括：分析方法、使用的规则、检测到的具体内容等 |
| 违规原因 | string | 是 | 如存在违规，列出具体原因；无违规时填写"无" |
| 总结 | string | 是 | 综合评价，例如："本次检测结果正常，无违规行为"、"建议立即整改" |

#### 业务场景

**场景1：正常检测结果**

```json
{
    "结果": "检测通过",
    "描述": "使用安全帽检测规则分析图片，所有人员均正确佩戴安全帽，佩戴规范，未发现违规行为。",
    "违规原因": "无",
    "总结": "本次检测结果正常，符合安全规范要求。"
}
```

**场景2：存在违规的检测结果**

```json
{
    "结果": "发现3人未佩戴安全帽",
    "描述": "使用安全帽检测规则分析图片，共检测到5人，其中3人未佩戴安全帽，2人佩戴规范。",
    "违规原因": "1. 左侧穿蓝色上衣人员未佩戴安全帽；2. 中间穿黄色工服人员未佩戴安全帽；3. 右侧穿灰色上衣人员未佩戴安全帽",
    "总结": "发现违规行为，建议立即整改并进行安全培训。"
}
```

**实现要求：**

1. **规则配置扩展**
   - 在 `rules` 表中增加 `output_format` 字段
   - 支持自定义输出格式模板

2. **LLM响应解析**
   - 从LLM返回的原始文本中提取关键信息
   - 自动填充标准格式的四个字段

3. **API响应格式**
   - `/api/detect` 接口返回标准格式
   - 保留原始 `llm_result` 字段用于调试

---

### FR-002: 自动抽帧功能

| 属性 | 值 |
|------|-----|
| **需求ID** | FR-002 |
| **需求名称** | 自动抽帧功能 |
| **优先级** | Should Have |
| **描述** | 系统 SHALL 提供摄像头自动抽帧检测功能 |

#### 功能详情

**抽帧配置参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `frequency_seconds` | int | 60 | 抽帧频率（秒），最小10秒，最大3600秒 |
| `resolution` | string | "original" | 抽帧分辨率：original/720p/1080p/4k |
| `quality` | int | 80 | JPEG压缩质量，范围1-100 |
| `storage_path` | string | "./data/frames/" | 抽帧存储路径 |
| `max_frames` | int | 1000 | 最大保留帧数，超过自动清理 |

**功能模块：**

1. **抽帧任务管理（inspection_tasks表）**
   ```
   - id: 主键
   - name: 任务名称
   - camera_id: 关联摄像头
   - rule_id: 关联检测规则
   - frequency_seconds: 抽帧频率
   - resolution: 分辨率设置
   - quality: 质量设置
   - storage_path: 存储路径
   - status: active/inactive
   - last_run_time: 上次运行时间
   - next_run_time: 下次运行时间
   - last_record_id: 最后生成的记录ID
   - last_error: 最后错误信息
   ```

2. **抽帧进度显示**
   - 当前进度百分比
   - 已处理帧数
   - 预计剩余时间
   - 实时状态（运行中/暂停/错误）

3. **异常处理机制**
   - RTSP连接失败自动重试（最多3次）
   - 抽帧失败记录错误日志
   - 任务异常自动暂停并告警
   - 超过最大失败次数自动禁用任务

4. **自动清理机制**
   - 超过 `max_frames` 自动删除最旧的帧
   - 支持按时间自动清理（可选）
   - 存储空间不足告警

**API接口：**

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/inspection-tasks` | GET | 获取任务列表 |
| `/api/inspection-tasks` | POST | 创建任务 |
| `/api/inspection-tasks/<id>` | GET | 获取任务详情 |
| `/api/inspection-tasks/<id>` | PUT | 更新任务 |
| `/api/inspection-tasks/<id>` | DELETE | 删除任务 |
| `/api/inspection-tasks/<id>/start` | POST | 启动任务 |
| `/api/inspection-tasks/<id>/stop` | POST | 停止任务 |
| `/api/inspection-tasks/<id>/status` | GET | 获取任务状态 |

---

### FR-003: 预设提示词模板功能

| 属性 | 值 |
|------|-----|
| **需求ID** | FR-003 |
| **需求名称** | 预设提示词模板功能 |
| **优先级** | Should Have |
| **描述** | 系统 SHALL 提供可管理的提示词模板库，支持智能优化和推荐 |

#### 功能详情

**模板库管理：**

```
数据模型：prompt_templates
- id: 主键
- code: 模板编码（唯一）
- name: 模板名称
- category: 分类（安全/质量/设备/消防/其他）
- prompt_content: 提示词内容
- description: 描述
- usage_count: 使用次数
- success_rate: 成功率（0-100）
- is_system: 是否系统预设模板
- status: active/inactive
- created_at: 创建时间
- updated_at: 更新时间
```

**功能模块：**

1. **模板CRUD操作**
   - 创建/编辑/删除模板
   - 系统预设模板不可删除（仅禁用）

2. **分类管理**
   - 支持自定义分类
   - 分类树状结构
   - 快速分类筛选

3. **快速检索**
   - 按名称搜索
   - 按分类筛选
   - 按使用频率排序
   - 按成功率排序

4. **模板智能优化机制**
   ```
   优化算法：
   1. 收集历史使用数据（成功率、用户反馈）
   2. 分析成功案例的提示词模式
   3. 识别高成功率的关键表述
   4. 自动生成优化建议
   5. 支持一键应用优化
   ```

5. **模板推荐系统**
   - 基于历史使用推荐常用模板
   - 基于场景推荐相关模板
   - 新用户推荐系统预设模板

6. **模板导出/导入**
   - 导出为JSON格式
   - 导入JSON模板文件
   - 支持批量导入
   - 导入时自动去重

**API接口：**

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/prompt-templates` | GET | 获取模板列表 |
| `/api/prompt-templates` | POST | 创建模板 |
| `/api/prompt-templates/<id>` | GET | 获取模板详情 |
| `/api/prompt-templates/<id>` | PUT | 更新模板 |
| `/api/prompt-templates/<id>` | DELETE | 删除模板 |
| `/api/prompt-templates/categories` | GET | 获取分类列表 |
| `/api/prompt-templates/recommend` | GET | 获取推荐模板 |
| `/api/prompt-templates/optimize` | POST | 生成优化建议 |
| `/api/prompt-templates/export` | GET | 导出模板 |
| `/api/prompt-templates/import` | POST | 导入模板 |

---

### FR-004: 无用户认证确认

| 属性 | 值 |
|------|-----|
| **需求ID** | FR-004 |
| **需求名称** | 无用户认证功能 |
| **优先级** | Must Have（明确排除） |
| **描述** | 系统 SHALL NOT 提供用户认证功能 |

#### 明确排除的功能

以下功能**不开发**：

- ❌ 用户登录/注册
- ❌ 用户权限管理（RBAC）
- ❌ 多用户隔离
- ❌ 会话管理
- ❌ 密码重置
- ❌ OAuth集成
- ❌ 操作审计日志（仅系统日志）

**设计原则：**

1. **单用户模式**
   - 所有数据共享
   - 无用户隔离
   - 简化配置

2. **安全性替代方案**
   - 网络隔离部署
   - VPN访问控制
   - 防火墙规则
   - API Key保护（可选）

3. **访问控制**
   - 通过网络层控制访问
   - 不在应用层实现认证

---

## 3. 非功能需求

### 3.1 性能需求

| 需求ID | 需求名称 | 目标值 | 说明 |
|--------|----------|--------|------|
| NFR-001 | 抽帧启动时间 | < 5秒 | 从任务启动到第一帧捕获 |
| NFR-002 | 模板推荐响应 | < 200ms | 推荐模板查询 |
| NFR-003 | 模板优化计算 | < 10秒 | 基于1000条历史数据 |
| NFR-004 | 并发抽帧任务 | 支持5个 | 同时运行的抽帧任务数 |

### 3.2 可靠性需求

| 需求ID | 需求名称 | 要求 |
|--------|----------|------|
| NFR-005 | 抽帧任务可靠性 | 失败自动重试3次 |
| NFR-006 | 数据完整性 | 模板数据持久化100% |
| NFR-007 | 任务恢复 | 服务重启后任务自动恢复 |

### 3.3 可扩展性需求

| 需求ID | 需求名称 | 要求 |
|--------|----------|------|
| NFR-008 | 模板分类 | 支持自定义扩展分类 |
| NFR-009 | 抽帧分辨率 | 支持新增分辨率选项 |
| NFR-010 | 优化算法 | 支持替换优化策略 |

---

## 4. 数据模型设计

### 4.1 新增数据表

#### prompt_templates表

```sql
CREATE TABLE IF NOT EXISTS prompt_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    prompt_content TEXT NOT NULL,
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0,
    is_system INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pt_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_pt_usage ON prompt_templates(usage_count);
CREATE INDEX IF NOT EXISTS idx_pt_success ON prompt_templates(success_rate);
```

#### inspection_tasks表（已存在，扩展字段）

```sql
-- 已有字段保持不变
-- 新增字段：
ALTER TABLE inspection_tasks ADD COLUMN resolution TEXT DEFAULT 'original';
ALTER TABLE inspection_tasks ADD COLUMN quality INTEGER DEFAULT 80;
ALTER TABLE inspection_tasks ADD COLUMN storage_path TEXT;
ALTER TABLE inspection_tasks ADD COLUMN max_frames INTEGER DEFAULT 1000;
```

#### rules表（已存在，扩展字段）

```sql
-- 已有字段保持不变
-- 新增字段：
ALTER TABLE rules ADD COLUMN output_format TEXT;
ALTER TABLE rules ADD COLUMN template_id INTEGER;
```

### 4.2 系统预设模板

```python
SYSTEM_TEMPLATES = [
    {
        "code": "safety_helmet",
        "name": "安全帽检测",
        "category": "安全",
        "prompt_content": "请分析图片中人员是否佩戴安全帽...",
        "description": "检测人员安全帽佩戴规范",
        "is_system": 1
    },
    {
        "code": "fire_safety",
        "name": "消防安全检查",
        "category": "消防",
        "prompt_content": "请检查消防设施是否完好...",
        "description": "检查消防设施和安全通道",
        "is_system": 1
    },
    {
        "code": "equipment_status",
        "name": "设备状态检查",
        "category": "设备",
        "prompt_content": "请分析设备运行状态...",
        "description": "检查设备外观和运行状态",
        "is_system": 1
    }
]
```

---

## 5. API接口设计

### 5.1 提示词模板管理

**GET /api/prompt-templates**

```
请求参数：
- category: string (可选) - 分类筛选
- search: string (可选) - 关键词搜索
- sort: string (可选) - 排序字段（name/usage_count/success_rate）
- order: string (可选) - 排序方向（asc/desc）
- page: int (可选) - 页码
- page_size: int (可选) - 每页数量

响应：
{
    "success": true,
    "count": 10,
    "data": [...]
}
```

**POST /api/prompt-templates**

```
请求体：
{
    "code": "custom_template_001",
    "name": "自定义模板",
    "category": "安全",
    "prompt_content": "提示词内容...",
    "description": "描述"
}

响应：
{
    "success": true,
    "data": {"id": 10, ...}
}
```

### 5.2 巡检任务管理

**GET /api/inspection-tasks**

```
响应：
{
    "success": true,
    "count": 3,
    "data": [
        {
            "id": 1,
            "name": "工地门口巡检",
            "status": "active",
            "progress": 75,
            "last_run_time": "2026-03-22 10:00:00",
            "next_run_time": "2026-03-22 10:01:00"
        }
    ]
}
```

**POST /api/inspection-tasks/<id>/start**

```
响应：
{
    "success": true,
    "message": "任务已启动"
}
```

---

## 6. 用户界面设计

### 6.1 提示词模板管理页面

```
┌─────────────────────────────────────────────────────────────┐
│  📝 提示词模板库                    [新增模板] [导入] [导出] │
├─────────────────────────────────────────────────────────────┤
│  分类：[全部 ▼]  搜索：[___________]  排序：[使用次数 ▼] │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  模板列表                                           │   │
│  │  ┌──┬──────────┬────────┬────────┬─────────┬──────┐ │   │
│  │  │ID│ 模板名称   │ 分类  │使用次数│成功率  │操作   │ │   │
│  │  ├──┼──────────┼────────┼────────┼─────────┼──────┤ │   │
│  │  │1 │安全帽检测  │安全    │  1250  │  92%   │[编辑]│ │   │
│  │  │2 │消防安全检查│消防    │   890  │  88%   │[编辑]│ │   │
│  │  │3 │设备状态检查│设备    │   654  │  95%   │[编辑]│ │   │
│  │  └──┴──────────┴────────┴────────┴─────────┴──────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│  [← 1 2 3 4 →]  共 50 个模板                          │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 巡检任务管理页面

```
┌─────────────────────────────────────────────────────────────┐
│  ⏰ 自动抽帧任务                    [新增任务]              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  任务列表                                           │   │
│  │  ┌──┬──────────┬──────┬────────┬──────────┬──────┐ │   │
│  │  │ID│ 任务名称   │ 状态 │ 进度   │下次运行   │操作   │ │   │
│  │  ├──┼──────────┼──────┼────────┼──────────┼──────┤ │   │
│  │  │1 │工地门口巡检│运行中│ 75%    │10:01:00  │[停止]│ │   │
│  │  │2 │车间A巡检  │已停止│ -      │-         │[启动]│ │   │
│  │  └──┴──────────┴──────┴────────┴──────────┴──────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 技术实现要点

### 7.1 后台调度器

使用 `APScheduler` 实现定时任务：

```python
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()
scheduler.start()

# 动态添加任务
def add_inspection_task(task_id, frequency):
    scheduler.add_job(
        run_inspection,
        'interval',
        seconds=frequency,
        id=f'inspection_task_{task_id}',
        args=[task_id]
    )
```

### 7.2 模板优化算法

```python
class TemplateOptimizer:
    @staticmethod
    def analyze_usage(template_id):
        """分析使用历史，提取成功模式"""
        records = get_successful_records(template_id)
        patterns = extract_patterns(records)
        return patterns

    @staticmethod
    def generate_suggestion(template_id):
        """生成优化建议"""
        patterns = analyze_usage(template_id)
        suggestions = build_suggestions(patterns)
        return suggestions
```

---

## 8. 验收标准

### 功能验收

| 验收ID | 需求 | 验收条件 |
|--------|------|----------|
| AC-001 | FR-001 | 检测结果严格按四字段格式输出 |
| AC-002 | FR-002 | 抽帧任务可按配置频率运行 |
| AC-003 | FR-003 | 模板CRUD操作正常 |
| AC-004 | FR-004 | 确认无任何用户认证功能 |

### 性能验收

| 验收ID | 需求 | 验收条件 |
|--------|------|----------|
| AC-005 | NFR-001 | 抽帧任务启动<5秒 |
| AC-006 | NFR-002 | 模板推荐响应<200ms |

---

## 9. 附录

### 9.1 系统预设模板清单

| 编码 | 名称 | 分类 | 描述 |
|------|------|------|------|
| safety_helmet | 安全帽检测 | 安全 | 检测人员安全帽佩戴 |
| fire_safety | 消防安全检查 | 消防 | 检查消防设施 |
| equipment_status | 设备状态检查 | 设备 | 检查设备状态 |
| ... | ... | ... | ... |

### 9.2 版本历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| 4.1 | 2026-03-22 | AI | 初始版本，新增4个功能 |

---

*文档结束*
