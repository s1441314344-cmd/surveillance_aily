# 智能巡检系统仓库说明

这个仓库当前以 V2 为主线。新版需求入口已经切到 `/prd`，历史 `docs/product`、`docs/plan`、`docs/architecture` 继续保留，但不再作为唯一需求口径。

## 事实源优先级

1. 当前代码
   - `frontend-v2/`
   - `backend-v2/`
   - `local-detector/`
2. 新版 PRD
   - `prd/需求总览.md`
   - `prd/modules/*.md`
3. 变更归档
   - `docs/requirements_log.md`
4. 运行与联调说明
   - `README_V2.md`
5. 历史方案与分析
   - `docs/product/`
   - `docs/plan/`
   - `docs/architecture/`

如果旧文档和当前代码冲突，以“当前代码 + `/prd`”为准。

## 新 PRD 入口

- 总览 PRD：
  - `prd/需求总览.md`
- 模块 PRD：
  - `prd/modules/auth-login.md`
  - `prd/modules/dashboard-overview.md`
  - `prd/modules/dashboards-config.md`
  - `prd/modules/strategies-center.md`
  - `prd/modules/cameras-索引.md`
  - `prd/modules/cameras-devices.md`
  - `prd/modules/cameras-monitoring.md`
  - `prd/modules/cameras-media.md`
  - `prd/modules/cameras-diagnostics.md`
  - `prd/modules/alerts-center.md`
  - `prd/modules/jobs-center.md`
  - `prd/modules/records-center.md`
  - `prd/modules/feedback-center.md`
  - `prd/modules/settings-model-system.md`
  - `prd/modules/users-and-permissions.md`
  - `prd/modules/audit-logs.md`
  - `prd/modules/local-detector.md`
- 目录说明：
  - `prd/README.md`

## 阅读顺序

1. 先读 `prd/需求总览.md`
2. 再读目标页面对应的 `prd/modules/*.md`
3. 如果是摄像头域，先读 `prd/modules/cameras-索引.md`
4. 如果要看需求原始输入和变更上下文，再读 `docs/requirements_log.md`
5. 如果要查运行方式、脚本和历史治理背景，再读 `README_V2.md`

## 工程目录

- `frontend-v2`
  - React 19 + TypeScript + Vite + Ant Design 前端工作台
- `backend-v2`
  - FastAPI + PostgreSQL + Redis + Celery + APScheduler 后端主服务
- `local-detector`
  - 本地检测侧车服务
- `scripts/v2`
  - 本地联调、回归、发布前检查脚本
- `docs`
  - 历史需求、计划、架构和测试文档，以及需求归档日志
- `prd`
  - 当前生效的新版 PRD

## Demo 实现范围

当前仓库不是纯原型。已经有可运行前端、真实后端主线和本地检测服务。

主交付面：

- `frontend-v2`
- `backend-v2`
- `local-detector`
- `scripts/v2`

页面级实现状态以各模块 PRD 开头的 `Demo 实现状态` 表为准。

## 本地启动命令

先看命令总览：

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

分别启动核心进程：

```bash
make v2-api
make v2-worker
make v2-scheduler
make v2-frontend
```

前端首次联调前，建议先准备环境变量文件：

```bash
cd frontend-v2
cp .env.example .env.local
```

## 常用验证命令

前端单测：

```bash
cd frontend-v2
npm test
```

前端 lint：

```bash
cd frontend-v2
npm run lint
```

前端构建：

```bash
cd frontend-v2
npm run build
```

最小 E2E：

```bash
cd frontend-v2
npm run e2e:mainline
```

后端测试：

```bash
cd backend-v2
pytest
```

异步主链 smoke：

```bash
make v2-smoke
```

冻结交付说明：

- `docs/testing/冻结交付说明_2026-04-20.md`

## 当前状态

- 新版 PRD 已经按模块拆分回写到 `/prd`
- `/records` 权限、route registry、任务域 API 拆分和首批页面 controller 收口已经落到代码
- `jobs / records / feedback / dashboard / local-detector` 已改为优先依赖领域 API 入口，而不是直接依赖 `configCenter` 总 barrel
- `alerts / settings / strategies / dashboards / cameras` 也已改为按领域 API 入口导入，前端页面层已经不再直接依赖 `configCenter` 总 barrel
- `shared/api` 顶层公开入口已经补齐 `@prd` 追溯约束；当前 `frontend-v2` 源码里没有 live `TODO[接入]` 落点，retired compatibility barrel 和内部子域边界由 targeted tests 持续守住
- `tasks / configCenter` compatibility barrel 已经退场；生产代码既不能重新导入这两个 legacy alias，也不能直接跳过 facade 去导入 `@/shared/api/config-center/*` 内部子域。这三层限制都已经落到 lint 和项目级 allowlist 扫描
- `frontend-v2/.env.example` 已补齐，明确 `VITE_API_BASE_URL` 和 `VITE_LOCAL_DETECTOR_BASE_URL` 的本地默认值；开发态可以继续 fallback，但联调文档不再只靠口头说明
- `@/shared/api/client` 和 `@/shared/api/baseUrl` 现在被明确收口为 `shared/api` 内部 helper；`getApiErrorMessage` 也已经迁到 `@/shared/utils/apiErrorMessage`，页层不再依赖 `shared/api` 的非领域 helper
- `frontend-v2` 当前已通过 `lint / vitest / build`
- `frontend-v2` 主链最小 E2E 已通过
- `backend-v2: pytest` 已通过，当前结果为 `192 passed`
- 后端这轮收敛的关键修复点是 integration tests 对 `app.*` 模块缓存的污染恢复，避免普通测试在旧模块对象和新模块对象之间分叉
