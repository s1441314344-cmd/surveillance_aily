# backend-v2

智能巡检系统 V2 后端，采用 FastAPI + SQLAlchemy + Redis + Celery，并通过独立 scheduler 进程触发定时任务。

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

6. 启动 scheduler

```bash
python -m app.schedulers.runner
```

## 推荐联调方式

仓库根目录已经提供轻量命令入口，适合日常开发：

```bash
make v2-help
make v2-dev
make v2-api
make v2-worker
make v2-scheduler
make v2-frontend
```

`make v2-dev` 只负责启动依赖并给出下一步提示，不会一次性拉起过多后台进程，便于分别观察 API、worker、scheduler 和前端日志。

## 异步执行说明

- `POST /api/jobs/uploads` 只负责校验、保存上传文件并创建 `queued` 状态的 Job。
- `POST /api/jobs/cameras/once` 只负责校验输入并创建 `queued` 状态的 Job。
- Celery worker 通过 `jobs.process(job_id)` 执行抓帧、模型调用、Schema 校验和记录写入。
- scheduler 进程负责扫描到期的 `job_schedules`，创建 `camera_schedule` Job，并派发到 worker。
- `task_records`、`feedback`、`dashboard` 继续复用统一的任务闭环。

## 当前包含

- FastAPI 应用骨架
- JWT/RBAC 占位实现
- SQLAlchemy 模型骨架
- Alembic 骨架
- Celery/Redis 骨架
- APScheduler 独立调度进程
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
