# 智能巡检系统 V2

V2 按“先统一基线与证据链，再推进工程骨架”的方式推进，当前仓库以冻结版需求基线、实施设计、追踪矩阵和验收清单作为唯一交付口径。

## 文档入口

当前代码结构、治理边界和验证口径以 `docs/architecture/智能巡检系统_V2_当前代码事实与治理边界说明.md` 为当前事实源；`docs/architecture/智能巡检系统_V2_终版综合分析报告.md` 保留作为历史分析参考，不直接代表当前代码现状。

- `docs/INDEX.md`（目录索引）
- `docs/product/智能巡检系统_需求规格与功能更新方案_v2.md`
- `docs/plan/智能巡检系统_V2_实施计划与功能设计方案.md`
- `docs/architecture/智能巡检系统_V2_技术架构搭建与功能清单整改方案.md`
- `docs/architecture/智能巡检系统_V2_当前代码事实与治理边界说明.md`
- `docs/architecture/智能巡检系统_V2_终版综合分析报告.md`
- `docs/plan/智能巡检系统_V2_Backlog与工程骨架方案.md`
- `docs/plan/智能巡检系统_V2_需求到验证追踪矩阵.md`
- `docs/plan/智能巡检系统_V2_协作与缺陷治理规范.md`
- `docs/testing/智能巡检系统_V2_全量验收清单.md`
- `docs/testing/智能巡检系统_V2_治理收敛提审单_2026-04-12.md`
- `docs/testing/智能巡检系统_V2_治理收敛复验记录单_2026-04-12.md`
- `docs/testing/智能巡检系统_V2_治理状态补充说明_2026-04-12.md`
- `docs/testing/智能巡检系统_V2_提审模板.md`
- `docs/testing/摄像头中心_抽帧触发规则配置说明与测试报告.md`

## 工程目录

- `frontend-v2`: React + TypeScript + Vite + Ant Design 前端骨架
- `backend-v2`: FastAPI + PostgreSQL + Redis + Celery 后端骨架
- `docker-compose.v2.yml`: 本地 PostgreSQL / Redis 依赖编排
- `Makefile` + `scripts/v2`: V2 本地联调命令入口

## 本地联调前置条件

- `docker` / `docker compose`
- `python3`
- `node` / `npm`

## 快速开始

查看可用命令：

```bash
make v2-help
```

准备本地环境：

```bash
make v2-setup
make v2-dev
```

分别启动核心进程：

```bash
make v2-api
make v2-worker
make v2-scheduler
make v2-frontend
```

## 推荐联调命令

先查看命令总览：

```bash
make v2-help
```

首次准备环境：

```bash
make v2-setup
```

启动依赖并准备联调：

```bash
make v2-dev
```

随后分别打开 4 个终端执行：

```bash
make v2-api
make v2-worker
make v2-scheduler
make v2-frontend
```

默认已放行 `5174-5178` 的本地前端端口，兼容 Vite 在端口占用时自动回退。

如需验证运行中的完整异步闭环：

```bash
make v2-smoke
```

该命令会基于正在运行的 API / worker / scheduler 执行上传任务、失败任务重试和定时任务的 smoke 验证。

如需执行前端 E2E 基线回归（登录 + 核心页面可达）：

```bash
make v2-e2e
```

首次使用 Playwright 时如需安装浏览器：

```bash
cd frontend-v2
npx playwright install chromium
```

如需做上传任务性能探测（并发提交 + 完成率 + 时延统计）：

```bash
make v2-perf
./scripts/v2/perf.sh --jobs 50 --concurrency 10 --files-per-job 2 --api-base http://127.0.0.1:8000
```

如需做多轮稳定性回归（检查任务是否出现长期未收敛）：

```bash
make v2-soak
./scripts/v2/soak.sh --rounds 5 --jobs-per-round 20 --concurrency 8 --poll-timeout-seconds 180
```

如需一键执行上线前核心检查（自动拉起本地进程并执行 smoke + perf + soak）：

```bash
make v2-preflight
./scripts/v2/preflight.sh --with-e2e
```

如需显式验证真实异步栈（PostgreSQL + Redis + API + worker + scheduler），而不是仅依赖轻量测试基座：

```bash
make v2-real-async-test
./scripts/v2/real-async-test.sh --with-e2e
```

正式发布默认口径为：

```bash
make v2-release-gate-final
```

`make v2-release-gate` 仍可用于非正式演练，但若使用 override / bypass 参数，产物会显式标记为 bypass run。

如需单独执行发布前安全验证与切换期对账：

```bash
make v2-security
make v2-reconcile
./scripts/v2/security.sh --output-dir /tmp/v2-security
./scripts/v2/reconcile.sh --output-dir /tmp/v2-reconcile
```

如需单独控制依赖：

```bash
make v2-deps-up
make v2-deps-down
```

如需先评估旧 SQLite 历史数据的迁移结果：

```bash
make v2-backfill
```

正式执行回填：

```bash
./scripts/v2/backfill.sh --apply
```

如需执行模型样本评估：

```bash
make v2-eval
./scripts/v2/evaluate.sh --target zhipu:glm-4v-plus --target openai:gpt-5-mini --repeats 3
./scripts/v2/evaluate.sh --output /tmp/eval.json --markdown-output /tmp/eval.md
./scripts/v2/evaluate.sh --decision-policy ./backend-v2/examples/model_eval_decision_policy.example.json --output /tmp/eval.json --markdown-output /tmp/eval.md
```

如需执行摄像头深度诊断：

```bash
make v2-camera-check
./scripts/v2/camera-check.sh --rtsp-url rtsp://mock/diag --name demo-camera
```

如需批量验证摄像头白名单：

```bash
make v2-camera-validate
./scripts/v2/camera-validate.sh --manifest ./backend-v2/examples/camera_whitelist_manifest.example.json --output /tmp/camera-whitelist.json --markdown-output /tmp/camera-whitelist.md
```

## 本地启动顺序

1. 启动依赖

```bash
docker compose -f docker-compose.v2.yml up -d postgres redis local-detector
```

2. 启动后端

```bash
cd backend-v2
cp .env.example .env
python3 -m pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8000
```

3. 启动 worker

```bash
cd backend-v2
python3 -m celery -A app.core.celery_app.celery_app worker --loglevel=info
```

4. 启动 scheduler

```bash
cd backend-v2
python3 -m app.schedulers.runner
```

5. 启动前端

```bash
cd frontend-v2
cp .env.example .env.local
npm install
npm run dev
```

- `frontend-v2/.env.example` 已提供推荐本地值：
  - `VITE_API_BASE_URL=http://localhost:8000`
  - `VITE_LOCAL_DETECTOR_BASE_URL=http://localhost:8091`
- 前端开发态未显式配置这两个变量时，代码仍会分别回落到 `http://localhost:8000` 和 `http://localhost:8091`
- 前端生产构建必须显式注入这两个 `VITE_*` 变量，缺失时会在初始化阶段直接报错

## 模块运行要点

### 后端

- 环境变量：`cp .env.example .env`（完整配置项见 `.env.example`）
- 依赖服务：`docker compose -f ../docker-compose.v2.yml up -d postgres redis local-detector`
- 关键进程：API / worker / scheduler 三个进程需要同时运行
- 本地检测健康检查：`curl http://localhost:8091/healthz`
- 常用环境变量：
  - `SCHEDULER_POLL_INTERVAL_SECONDS` / `SCHEDULER_CAMERA_STATUS_SWEEP_ENABLED`
  - `LOCAL_DETECTOR_BASE_URL` / `LOCAL_DETECTOR_TIMEOUT_SECONDS` / `LOCAL_DETECTOR_PERSON_THRESHOLD`
  - `FEEDBACK_TRAINING_ENABLED` / `FEEDBACK_TRAINING_CRON`
  - `ALERT_LARK_NOTIFY_ENABLED` / `ALERT_LARK_CLI_BIN` / `ALERT_LARK_CLI_TIMEOUT_SECONDS`
  - `ZHIPU_API_KEY` / `OPENAI_API_KEY` / `ARK_API_KEY`
- 告警通知路由（飞书 CLI）：`/api/alert-notification-routes` 系列接口，需开启 `ALERT_LARK_NOTIFY_ENABLED`

#### 策略输出格式

- `/api/strategies` 支持 `result_format`
- 可选值：`json_schema`、`json_object`、`auto`、`text`
- 推荐默认：`json_schema`

#### 异步执行链路

- `POST /api/jobs/uploads`：创建上传任务
- `POST /api/jobs/cameras/once`：创建摄像头单次任务
- worker 负责抓帧、模型调用、Schema 校验与记录写入
- scheduler 负责扫描 `job_schedules` 并创建到期任务
- 摄像头状态巡检由 scheduler 周期写入 `camera_status_logs`

### 前端

- 安装依赖：`npm install`
- 启动开发：`npm run dev`（默认端口 `5174`）
- 常用检查：`npm run lint` / `npm run test` / `npm run build`
- E2E 回归：`npx playwright install chromium` 后执行 `npm run e2e`

#### 当前包含

- 登录、会话状态与路由守卫
- 401 自动刷新 access token
- 基于角色的菜单过滤与页面级 RBAC 访问控制
- `shared/api` 顶层领域入口、`config-center/*` 内部子域和内部 helper 已分层收口；页层不再直接依赖 `@/shared/api/client`、`@/shared/api/baseUrl`，`getApiErrorMessage` 也已迁到 `@/shared/utils/apiErrorMessage`
- 摄像头中心状态聚合与异常高亮
- 任务中心、任务记录、人工反馈、看板分析、审计日志页面

## 当前阶段

- 已完成：V2 backlog 拆分、前后端基础骨架、核心路由占位、本地依赖编排、统一异步任务链路、独立 scheduler 进程、本地联调脚本、历史数据回填 dry-run / apply 工具
- 已补充：scheduler 摄像头状态后台巡检（周期写入状态日志，供摄像头监控页聚合展示）
- 已补充：OpenAI / 智谱 provider adapter 真实调用实现，开发环境可通过 `PROVIDER_MOCK_FALLBACK_ENABLED=true` 保持无密钥可联调
- 已补充：模型样本评估脚本、示例样本清单、价格表和指标汇总输出
- 已补充：RTSP 深度诊断 CLI / API、评估 Markdown 报告导出、迁移决策策略输出
- 已补充：摄像头白名单批量验证 CLI / Markdown 报告
- 已补充：前端 phase2 治理边界，`tasks / configCenter` retired barrel、`config-center/*` 内部子域、`shared/api/client`、`shared/api/baseUrl` 和已迁出的 `shared/api/errors` 都已进入 lint + AST 双重门禁
- 下一步建议：进入“联调与验证”小周期，优先完成真实摄像头白名单验证、真实业务样本报告沉淀和系统级回归
