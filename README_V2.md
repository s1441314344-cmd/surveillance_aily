# 智能巡检系统 V2

V2 按“先拆 backlog，再建工程骨架”的方式推进，当前仓库已经补齐需求基线、实施设计、执行分工和 Phase 1 工程骨架。

## 文档入口

- `docs/智能巡检系统_需求规格与功能更新方案_v2.md`
- `docs/智能巡检系统_V2_实施计划与功能设计方案.md`
- `docs/智能巡检系统_V2_技术架构搭建与功能清单整改方案.md`
- `docs/智能巡检系统_V2_Backlog与工程骨架方案.md`

## 工程目录

- `frontend-v2`: React + TypeScript + Vite + Ant Design 前端骨架
- `backend-v2`: FastAPI + PostgreSQL + Redis + Celery 后端骨架
- `docker-compose.v2.yml`: 本地 PostgreSQL / Redis 依赖编排
- `Makefile` + `scripts/v2`: V2 本地联调命令入口

## 本地联调前置条件

- `docker` / `docker compose`
- `python3`
- `node` / `npm`

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

该命令会基于正在运行的 API / worker / scheduler 执行上传任务和定时任务的 smoke 验证。

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

## 本地启动顺序

1. 启动依赖

```bash
docker compose -f docker-compose.v2.yml up -d postgres redis
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

4. 启动前端

```bash
cd frontend-v2
npm install
npm run dev
```

## 当前阶段

- 已完成：V2 backlog 拆分、前后端基础骨架、核心路由占位、本地依赖编排、统一异步任务链路、独立 scheduler 进程、本地联调脚本、历史数据回填 dry-run / apply 工具
- 已补充：OpenAI / 智谱 provider adapter 真实调用实现，开发环境可通过 `PROVIDER_MOCK_FALLBACK_ENABLED=true` 保持无密钥可联调
- 下一步建议：进入“联调与验证”小周期，优先完成 RTSP 真流验证、回填对账、真实模型样本评估和系统级回归
