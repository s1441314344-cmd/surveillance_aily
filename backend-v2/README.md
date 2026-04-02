# backend-v2

智能巡检系统 V2 后端，采用 FastAPI + SQLAlchemy + Redis + Celery，并通过独立 scheduler 进程触发定时任务。

## 本地启动

1. 安装依赖

```bash
python3 -m pip install -r requirements.txt
```

2. 复制环境变量

```bash
cp .env.example .env
```

3. 启动本地依赖

```bash
docker compose -f ../docker-compose.v2.yml up -d postgres redis local-detector
```

4. 启动 API

```bash
python3 -m uvicorn app.main:app --reload --port 8000
```

5. 启动 worker

```bash
python3 -m celery -A app.core.celery_app.celery_app worker --loglevel=info
```

6. 启动 scheduler

```bash
python -m app.schedulers.runner
```

可选环境变量（默认值见 `.env.example`）：

- `SCHEDULER_POLL_INTERVAL_SECONDS`：定时任务扫描周期（秒）
- `SCHEDULER_CAMERA_STATUS_SWEEP_ENABLED`：是否启用摄像头状态后台巡检
- `SCHEDULER_CAMERA_STATUS_SWEEP_INTERVAL_SECONDS`：摄像头状态巡检周期（秒）
- `LOCAL_DETECTOR_BASE_URL`：本地检测服务地址（默认 `http://localhost:8091`）
- `LOCAL_DETECTOR_TIMEOUT_SECONDS`：本地检测请求超时时间（秒）
- `LOCAL_DETECTOR_PERSON_THRESHOLD`：本地人员硬门控阈值
- `LOCAL_DETECTOR_STRICT_BLOCK`：本地检测不可用时是否严格阻断（默认 `true`）
- `FEEDBACK_TRAINING_ENABLED`：是否开启复核回流训练定时流水线
- `FEEDBACK_TRAINING_CRON`：复核回流训练 Cron（UTC）
- `FEEDBACK_TRAINING_MIN_SAMPLES`：单策略最小回流样本门槛
- `FEEDBACK_TRAINING_POSITIVE_RATIO`：`correct` 抽样比例（相对 `incorrect`）
- `FEEDBACK_TRAINING_MAX_SAMPLES_PER_STRATEGY`：单策略最大样本数
- `FEEDBACK_TRAINING_ROUTE_DEFAULT`：默认训练路由（`finetune` / `prompt_enhance`）
- `ZHIPU_API_KEY` / `OPENAI_API_KEY` / `ARK_API_KEY`：可选，首次启动时自动写入对应 provider（加密存储）

## 推荐联调方式

仓库根目录已经提供轻量命令入口，适合日常开发：

```bash
make v2-help
make v2-setup
make v2-dev
make v2-api
make v2-worker
make v2-scheduler
make v2-frontend
make v2-backend-test
make v2-frontend-test
make v2-verify
make v2-smoke
make v2-e2e
make v2-perf
make v2-soak
make v2-preflight
make v2-backfill
make v2-eval
make v2-camera-check
make v2-camera-validate
make v2-release-drill
make v2-uat
make v2-release-checklist
make v2-release-gate
```

`make v2-dev` 只负责启动依赖并给出下一步提示，不会一次性拉起过多后台进程，便于分别观察 API、worker、scheduler 和前端日志。

本地检测微服务健康检查：

```bash
curl http://localhost:8091/healthz
```

默认 `CORS_ORIGINS` 已覆盖 `localhost/127.0.0.1` 的 `5173-5180` 端口，兼容 Vite 开发端口回退。

`make v2-smoke` 会对运行中的栈执行一次“上传异步链路 + 失败任务重试链路 + 定时调度链路”的冒烟验收。

`make v2-backend-test` 会执行后端 `pytest` 全量用例；`make v2-frontend-test` 会执行前端 `vitest` 单元测试。

`make v2-verify` 会按“模块单测 -> 联调 preflight -> 最终 UAT”顺序串行执行完整验证流水线，并输出统一摘要。

`make v2-e2e` 会执行 Playwright 基线回归（登录 + 核心页面导航）。

`make v2-perf` 会执行上传任务并发探测并输出创建时延、任务完成率和吞吐摘要。

`make v2-soak` 会执行多轮任务提交稳定性回归，重点检测未收敛任务、失败任务和提交异常。

`make v2-preflight` 会自动拉起本地依赖和核心进程，并串行执行 smoke + perf + soak（可选 `--with-e2e`）。

`make v2-backfill` 会对旧版 `SQLite` 数据执行一次 dry-run 回填评估，输出将要迁移的 cameras / strategies / schedules / jobs / task_records / file_assets 数量，以及缺失文件和未纳入核心迁移的 legacy 提示。

`PROVIDER_MOCK_FALLBACK_ENABLED=true` 时，如果模型提供方未配置可用密钥，adapter 会回退到本地 mock 输出，方便开发和测试；生产环境建议关闭该开关，并在“模型提供方管理”中配置真实 API Key。

### 火山方舟（Ark）接入提示

- 推荐提供方主键使用 `ark`，接口也兼容别名 `doubao / volcengine / huoshan`（会自动归一到 `ark`）。
- `base_url` 建议保持：`https://ark.cn-beijing.volces.com/api/v3/chat/completions`。
- `model` 建议使用方舟控制台分配的 endpoint id（通常 `ep-` 开头）。
- 如果调试请求附带图片而模型不支持视觉输入，服务端会返回带排查建议的 400 详情（包括方舟原始错误 message）。

## 策略输出格式配置

`/api/strategies` 新增 `result_format`，可选值：

- `json_schema`：强约束结构化输出（默认），会严格校验 `response_schema`
- `json_object`：要求 JSON 对象但不强制匹配固定 schema
- `auto`：优先 JSON，对象解析失败时回退为文本结论
- `text`：纯文本结论（会在 `normalized_json.raw_text` 中保留）

示例（文本模式）：

```json
{
  "name": "现场巡检文本结论",
  "scene_description": "快速输出巡检结论",
  "prompt_template": "请给出一行巡检结论与建议",
  "model_provider": "ark",
  "model_name": "your-endpoint-id",
  "result_format": "text",
  "response_schema": {},
  "status": "active"
}
```

`make v2-eval` 会读取样本集清单，按 provider/model 执行多轮评估，输出准确率、结构化成功率、稳定性、平均时延和成本估算。

`make v2-camera-check` 会执行深度摄像头诊断，尝试真实抓帧并输出时延、图片大小、像素尺寸、错误信息和诊断快照路径。

`make v2-camera-validate` 会按白名单清单批量执行摄像头诊断，输出 JSON / Markdown 报告，并根据期望门槛给出通过/失败结果。

`make v2-release-drill` 会串行执行 `preflight + backfill + 演练报告生成`，输出一份可用于上线评审的 JSON / Markdown 报告，并包含标准回滚步骤提示。

`make v2-uat` 会串行执行 `backend pytest + frontend lint + frontend vitest + frontend build + e2e`，并输出一份 JSON 验收摘要；可选追加 release drill。

`make v2-release-checklist` 会读取最近一次 UAT 与 release drill 产物，生成最终发布清单（JSON/Markdown）。

`make v2-release-gate` 会一键串行执行 UAT（可选）+ 发布清单生成，并输出最终放行结论（`ready_to_release`）和阻塞项摘要。

## 异步执行说明

- `POST /api/jobs/uploads` 只负责校验、保存上传文件并创建 `queued` 状态的 Job。
- `POST /api/jobs/cameras/once` 只负责校验输入并创建 `queued` 状态的 Job。
- Celery worker 通过 `jobs.process(job_id)` 执行抓帧、模型调用、Schema 校验和记录写入。
- scheduler 进程负责扫描到期的 `job_schedules`，创建 `camera_schedule` Job，并派发到 worker。
- 若计划配置了 `precheck_strategy_id`，scheduler 会先调用本地检测微服务做前置门控；未通过则不会创建 Job，也不会调用大模型。
- 摄像头监测（signal monitor）在 `strict_local_gate=true` 时同样先走本地门控，未通过则不会进入模型分析链路。
- scheduler 进程会按配置周期执行摄像头状态巡检，批量写入 `camera_status_logs`，供监控页面读取。
- 管理端可通过 `POST /api/cameras/check-all` 手动触发全量或指定摄像头的状态巡检。
- 管理端可通过 `POST /api/job-schedules/{id}/run-now` 对某个计划进行一次立即触发（仍按 `camera_schedule` 入队）。
- `task_records`、`feedback`、`dashboard` 继续复用统一的任务闭环。

## 告警通知路由（飞书 CLI）

告警中心支持在 Webhook 之外，按策略/事件/摄像头/严重级别路由到飞书用户或群组。

环境变量：

- `ALERT_LARK_NOTIFY_ENABLED`：是否启用飞书通知路由发送（默认 `false`）
- `ALERT_LARK_CLI_BIN`：飞书 CLI 命令名（默认 `lark-cli`）
- `ALERT_LARK_CLI_TIMEOUT_SECONDS`：单次发送超时（秒，默认 `15`）

路由管理接口：

- `GET /api/alert-notification-routes`
- `POST /api/alert-notification-routes`
- `PATCH /api/alert-notification-routes/{route_id}`

匹配与发送规则：

- 仅匹配 `enabled=true` 的路由，按 `priority ASC -> created_at ASC -> id ASC` 依次处理
- 支持按 `strategy_id`、`event_key`、`camera_id`、`severity` 组合过滤
- 命中后调用 `lark-cli im +messages-send --as bot` 发送到 `user` 或 `chat`
- `cooldown_seconds` 生效时，同一路由在冷却窗口内不会重复发送
- 发送成功会刷新 `last_delivered_at`，失败会写入 `last_error`

联调前置条件：

- 本机可执行 `lark-cli`，并已完成登录授权（例如 `lark-cli auth login`）
- 发送主体为 bot（代码固定 `--as bot`），需具备 IM 发送权限
- 若发送到群组，bot 需在目标群内；若发送到用户，目标用户需在应用可见范围

最小联调步骤：

1. 在 `backend-v2/.env` 设置 `ALERT_LARK_NOTIFY_ENABLED=true`
2. 重启 API 服务
3. 在前端「告警中心 -> 通知路由（飞书）」新增一条路由（可绑定策略）
4. 触发一条命中规则的告警（如 trigger rule `debug-live`）
5. 检查飞书收信结果与路由字段 `last_delivered_at / last_error`

## 复核回流训练

- 管理接口：
  - `GET /api/training/overview`
  - `POST /api/training/pipeline/run`
  - `GET /api/training/datasets`
  - `GET /api/training/runs`
  - `GET /api/training/runs/{id}`
  - `POST /api/training/runs/{id}/approve`
  - `POST /api/training/runs/{id}/reject`
- 样本规则：
  - 仅纳入已复核（`correct` / `incorrect`）记录
  - `incorrect` 全量入池
  - `correct` 按比例抽样（`FEEDBACK_TRAINING_POSITIVE_RATIO`）
- 发布规则：
  - 训练完成后仅生成候选版本与审批单
  - 未审批不会切换策略
  - 审批通过后才更新策略版本

## 历史数据回填

默认脚本入口：

```bash
make v2-backfill
```

手工指定并真正落库：

```bash
cd ../
./scripts/v2/backfill.sh --apply
```

也可以直接运行 Python 脚本：

```bash
cd backend-v2
python3 ./scripts/backfill_legacy.py --source ../data/surveillance.db --source-root .. --apply
```

回填策略说明：

- 旧版 `rules + prompt_templates` 会收敛为 V2 `analysis_strategies`
- 旧版 `inspection_tasks` 会收敛为 V2 `job_schedules`
- 旧版 `detection_records` 和 `submit_tasks` 会生成历史 `jobs + task_records`
- `work_orders` 暂不进入 V2 核心表，仅在报告中提示保留在 legacy DB
- 脚本默认是 dry-run，适合先做对账和缺失文件扫描

## 模型评估

默认示例：

```bash
make v2-eval
```

指定目标模型并运行 3 轮重复评估：

```bash
./scripts/v2/evaluate.sh --target zhipu:glm-4v-plus --target openai:gpt-5-mini --repeats 3
```

输出报告到文件并带上价格表：

```bash
./scripts/v2/evaluate.sh \
  --dataset ./data/model_eval_dataset.example.json \
  --pricing ./data/model_pricing.example.json \
  --target zhipu:glm-4v-plus \
  --target openai:gpt-5-mini \
  --output ./data/eval-report.json \
  --markdown-output ./data/eval-report.md
```

带迁移判定策略的评估示例：

```bash
./scripts/v2/evaluate.sh \
  --dataset ./data/model_eval_dataset.example.json \
  --pricing ./data/model_pricing.example.json \
  --decision-policy ./examples/model_eval_decision_policy.example.json \
  --target zhipu:glm-4v-plus \
  --target openai:gpt-5-mini \
  --output ./data/eval-report.json \
  --markdown-output ./data/eval-report.md
```

数据文件说明：

- 样本清单示例：[model_eval_dataset.example.json](/Users/shaopeng/Downloads/surveillance_aily/backend-v2/data/model_eval_dataset.example.json)
- 价格表示例：[model_pricing.example.json](/Users/shaopeng/Downloads/surveillance_aily/backend-v2/data/model_pricing.example.json)
- 迁移判定策略示例：[model_eval_decision_policy.example.json](/Users/shaopeng/Downloads/surveillance_aily/backend-v2/examples/model_eval_decision_policy.example.json)
- 指标默认包括：请求成功率、结构化成功率、准确率、稳定性、平均时延、Token 用量、成本估算

判定输出说明：

- `switch_primary_to_challenger`: 候选模型达到切主门槛
- `keep_dual_stack`: 候选模型值得继续灰度，但暂不切主
- `keep_baseline_primary`: 候选模型未达到核心门槛
- `insufficient_data`: 缺少必要评估结果，无法形成判定

## 摄像头深度诊断

检查一个 ad-hoc RTSP 地址：

```bash
./scripts/v2/camera-check.sh --rtsp-url rtsp://mock/diag --name demo-camera
```

检查已配置的摄像头：

```bash
./scripts/v2/camera-check.sh --camera-id <camera-id>
```

诊断输出内容包括：

- 是否抓帧成功
- 诊断时延
- 图片大小和像素尺寸
- 已脱敏的 RTSP 地址
- 诊断快照保存路径
- 失败时的错误信息

## 摄像头白名单验证

验证示例清单：

```bash
make v2-camera-validate
```

手工指定清单并导出报告：

```bash
./scripts/v2/camera-validate.sh \
  --manifest ./examples/camera_whitelist_manifest.example.json \
  --output ./data/camera-whitelist.json \
  --markdown-output ./data/camera-whitelist.md
```

说明：

- 纯 `rtsp_url` 清单可直接运行，不强依赖数据库
- 如果清单使用 `camera_id` 引用已配置摄像头，则需要先启动数据库并完成初始化
- 示例清单见：[camera_whitelist_manifest.example.json](/Users/shaopeng/Downloads/surveillance_aily/backend-v2/examples/camera_whitelist_manifest.example.json)

## 上线演练与回滚报告

默认执行（含 preflight + backfill dry-run）：

```bash
make v2-release-drill
```

包含 e2e 的演练：

```bash
./scripts/v2/release-drill.sh --with-e2e
```

执行真实回填并生成演练报告：

```bash
./scripts/v2/release-drill.sh --apply-backfill
```

输出目录默认在 `data/release-drill-logs/<timestamp>/`，包含：

- `preflight.log`
- `backfill.json`
- `release-drill-report.json`
- `release-drill-report.md`

## UAT 验收脚本

默认执行基线验收（后端测试 + 前端 lint + vitest + build + e2e）：

```bash
make v2-uat
```

验收后追加 release drill：

```bash
./scripts/v2/uat.sh --with-release-drill
```

release drill 同时带 e2e：

```bash
./scripts/v2/uat.sh --with-release-drill --release-drill-with-e2e
```

release drill 使用真实回填 apply：

```bash
./scripts/v2/uat.sh --with-release-drill --release-drill-apply-backfill
```

输出目录默认在 `data/uat-logs/<timestamp>/`，包含每一步日志、`summary.json` 和可直接评审的 `summary.md`。

## 全流程验证流水线

默认执行三段校验：`precheck(backend/frontend unit)` -> `integration preflight` -> `final UAT`：

```bash
make v2-verify
```

跳过集成 preflight（仅跑单测 + UAT）：

```bash
./scripts/v2/verify.sh --skip-preflight
```

输出目录默认在 `data/verify-logs/<timestamp>/`，包含：

- `backend-test.log`
- `frontend-test.log`
- `preflight.log`
- `uat.log`
- `summary.json`
- `summary.md`

## 发布清单生成

基于最近一次 UAT + release drill 自动生成发布清单：

```bash
make v2-release-checklist
```

只基于 UAT 生成（临时放行，无 release drill）：

```bash
./scripts/v2/release-checklist.sh --allow-without-release-drill
```

强制要求 release drill 不是 dry-run：

```bash
./scripts/v2/release-checklist.sh --require-drill-apply-backfill
```

输出目录默认在 `data/release-checklists/<timestamp>/`，包含：

- `release-checklist.json`
- `release-checklist.md`

## 一键发布闸门

默认执行（自动跑 UAT，再生成发布清单并给出最终闸门结论）：

```bash
make v2-release-gate
```

最终放行模式（强制 release drill 使用 apply-backfill 且禁止 dry-run）：

```bash
make v2-release-gate-final
```

复用已有 UAT / release drill 产物进行快速判定：

```bash
./scripts/v2/release-gate.sh \
  --skip-uat \
  --uat-summary ./data/uat-logs/<timestamp>/summary.json \
  --release-drill-report ./data/release-drill-logs/<timestamp>/release-drill-report.json
```

执行强制 apply 的闸门判定：

```bash
./scripts/v2/release-gate.sh --release-drill-apply-backfill --require-drill-apply-backfill
```

输出目录默认在 `data/release-gates/<timestamp>/`，包含：

- `uat.log`（如果执行了 UAT）
- `release-checklist.log`
- `checklist/release-checklist.json`
- `checklist/release-checklist.md`
- `gate-summary.json`

## 当前包含

- FastAPI 应用骨架
- JWT/RBAC 与角色权限控制
- SQLAlchemy 数据模型与迁移
- Celery/Redis 骨架
- APScheduler 独立调度进程
- OpenAI / 智谱 / 火山方舟（Ark）provider adapter（缺少可用密钥时可按配置回退 mock）
- 健康检查与核心业务路由

## 当前 API 骨架范围

- `/api/auth`
- `/api/audit-logs`
- `/api/users`
- `/api/model-providers`
- `/api/strategies`
- `/api/cameras`
- `/api/cameras/statuses`
- `/api/cameras/{id}/diagnose`
- `/api/jobs`
- `/api/job-schedules`
- `/api/task-records`
- `/api/feedback`
- `/api/dashboard`

## 默认开发账号

- 用户名：`admin`
- 密码：`admin123456`

首次启动会自动建表并写入默认角色、管理员、模型提供方与预置策略。
