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
docker compose -f ../docker-compose.v2.yml up -d postgres redis
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

默认 `CORS_ORIGINS` 已覆盖 `localhost/127.0.0.1` 的 `5174-5178` 端口，兼容 Vite 开发端口回退。

`make v2-smoke` 会对运行中的栈执行一次“上传异步链路 + 失败任务重试链路 + 定时调度链路”的冒烟验收。

`make v2-backend-test` 会执行后端 `pytest` 全量用例；`make v2-frontend-test` 会执行前端 `vitest` 单元测试。

`make v2-verify` 会按“模块单测 -> 联调 preflight -> 最终 UAT”顺序串行执行完整验证流水线，并输出统一摘要。

`make v2-e2e` 会执行 Playwright 基线回归（登录 + 核心页面导航）。

`make v2-perf` 会执行上传任务并发探测并输出创建时延、任务完成率和吞吐摘要。

`make v2-soak` 会执行多轮任务提交稳定性回归，重点检测未收敛任务、失败任务和提交异常。

`make v2-preflight` 会自动拉起本地依赖和核心进程，并串行执行 smoke + perf + soak（可选 `--with-e2e`）。

`make v2-backfill` 会对旧版 `SQLite` 数据执行一次 dry-run 回填评估，输出将要迁移的 cameras / strategies / schedules / jobs / task_records / file_assets 数量，以及缺失文件和未纳入核心迁移的 legacy 提示。

`PROVIDER_MOCK_FALLBACK_ENABLED=true` 时，如果模型提供方未配置可用密钥，adapter 会回退到本地 mock 输出，方便开发和测试；生产环境建议关闭该开关，并在“模型提供方管理”中配置真实 API Key。

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
- scheduler 进程会按配置周期执行摄像头状态巡检，批量写入 `camera_status_logs`，供监控页面读取。
- `task_records`、`feedback`、`dashboard` 继续复用统一的任务闭环。

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

输出目录默认在 `data/release-checklists/<timestamp>/`，包含：

- `release-checklist.json`
- `release-checklist.md`

## 一键发布闸门

默认执行（自动跑 UAT，再生成发布清单并给出最终闸门结论）：

```bash
make v2-release-gate
```

复用已有 UAT / release drill 产物进行快速判定：

```bash
./scripts/v2/release-gate.sh \
  --skip-uat \
  --uat-summary ./data/uat-logs/<timestamp>/summary.json \
  --release-drill-report ./data/release-drill-logs/<timestamp>/release-drill-report.json
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
- OpenAI / 智谱真实 provider adapter（缺少可用密钥时可按配置回退 mock）
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
