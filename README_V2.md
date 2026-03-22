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

## 本地启动顺序

1. 启动依赖

```bash
docker compose -f docker-compose.v2.yml up -d postgres redis
```

2. 启动后端

```bash
cd backend-v2
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

3. 启动 worker

```bash
cd backend-v2
celery -A app.core.celery_app.celery_app worker --loglevel=info
```

4. 启动前端

```bash
cd frontend-v2
npm install
npm run dev
```

## 当前阶段

- 已完成：V2 backlog 拆分、前后端基础骨架、核心路由占位、本地依赖编排
- 下一步建议：优先进入 Phase 1 实做，先完成认证/RBAC、模型提供方、分析策略、摄像头配置四条基础能力
