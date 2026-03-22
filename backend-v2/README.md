# backend-v2

V2 后端工程骨架，采用 FastAPI + SQLAlchemy + Alembic + Redis + Celery。

## 本地启动

1. 安装依赖

```bash
pip install -r requirements.txt
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
uvicorn app.main:app --reload --port 8000
```

5. 启动 worker

```bash
celery -A app.core.celery_app.celery_app worker --loglevel=info
```

## 当前包含

- FastAPI 应用骨架
- JWT/RBAC 占位实现
- SQLAlchemy 模型骨架
- Alembic 骨架
- Celery/Redis 骨架
- Provider Adapter 骨架
- 健康检查和主要业务路由占位

## 当前 API 骨架范围

- `/api/auth`
- `/api/users`
- `/api/model-providers`
- `/api/strategies`
- `/api/cameras`
- `/api/jobs`
- `/api/job-schedules`
- `/api/task-records`
- `/api/feedback`
- `/api/dashboard`

## 默认开发账号

- 用户名：`admin`
- 密码：`admin123456`

首次启动会自动建表并写入默认角色、管理员、模型提供方与预置策略。
