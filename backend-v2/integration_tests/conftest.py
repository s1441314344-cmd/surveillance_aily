from __future__ import annotations

import importlib
import os
import shutil
import sys
import time
import warnings
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from requests import RequestsDependencyWarning

from .runtime_support import (
    clear_cached_modules,
    ensure_docker_available,
    restore_cached_modules,
    snapshot_cached_modules,
    start_scheduler_process,
    start_runtime_processes,
    start_worker_process,
    terminate_process,
    wait_for_scheduler_ready,
    wait_for_worker_ready,
)

warnings.filterwarnings("ignore", category=RequestsDependencyWarning)


@pytest.fixture(scope="session")
def runtime_environment(tmp_path_factory):
    ensure_docker_available()
    os.environ.setdefault("TESTCONTAINERS_RYUK_DISABLED", "true")

    from sqlalchemy import create_engine, text
    from testcontainers.core.container import DockerContainer
    from testcontainers.postgres import PostgresContainer
    import redis as redis_client

    repo_root = Path(__file__).resolve().parents[2]
    backend_dir = repo_root / "backend-v2"
    runtime_root = tmp_path_factory.mktemp("backend-integration")
    storage_root = runtime_root / "storage"
    storage_root.mkdir(parents=True, exist_ok=True)

    postgres = PostgresContainer(
        "postgres:16",
        username="postgres",
        password="postgres",
        dbname="surveillance_v2",
    )
    redis_container = DockerContainer("redis:7-alpine").with_exposed_ports(6379)

    postgres.start()
    redis_container.start()

    database_url = (
        "postgresql+psycopg://postgres:postgres@"
        f"{postgres.get_container_host_ip()}:{postgres.get_exposed_port(5432)}/surveillance_v2"
    )

    engine = create_engine(database_url, future=True)
    db_deadline = time.monotonic() + 30
    while True:
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            break
        except Exception:
            if time.monotonic() > db_deadline:
                raise
            time.sleep(0.5)

    redis_host = redis_container.get_container_host_ip()
    redis_port = redis_container.get_exposed_port(6379)
    redis_url = f"redis://{redis_host}:{redis_port}/0"
    redis_deadline = time.monotonic() + 30
    redis_conn = redis_client.Redis.from_url(redis_url)
    while True:
        try:
            if redis_conn.ping():
                break
        except Exception:
            if time.monotonic() > redis_deadline:
                raise
            time.sleep(0.5)

    env = os.environ.copy()
    env.update(
        {
            "APP_ENV": "test",
            "APP_DEBUG": "false",
            "DATABASE_URL": database_url,
            "REDIS_URL": redis_url,
            "CELERY_ENABLED": "true",
            "SCHEDULER_POLL_INTERVAL_SECONDS": "1",
            "SCHEDULER_CAMERA_STATUS_SWEEP_ENABLED": "false",
            "FEEDBACK_TRAINING_ENABLED": "false",
            "LOCAL_DETECTOR_ENABLED": "false",
            "PROVIDER_MOCK_FALLBACK_ENABLED": "true",
            "STORAGE_ROOT": str(storage_root),
            "SECRET_KEY": "integration-secret-key",
            "BOOTSTRAP_ADMIN_USERNAME": "admin",
            "BOOTSTRAP_ADMIN_PASSWORD": "admin123456",
            "BOOTSTRAP_ADMIN_DISPLAY_NAME": "集成测试管理员",
            "PYTHONPATH": str(backend_dir)
            if not env.get("PYTHONPATH")
            else f"{backend_dir}{os.pathsep}{env['PYTHONPATH']}",
        }
    )

    previous_env = os.environ.copy()
    os.environ.update(env)

    try:
        yield {
            "repo_root": repo_root,
            "backend_dir": backend_dir,
            "runtime_root": runtime_root,
            "storage_root": storage_root,
            "env": env,
        }
    finally:
        os.environ.clear()
        os.environ.update(previous_env)
        redis_container.stop()
        postgres.stop()


@pytest.fixture(scope="module")
def app_modules(runtime_environment):
    backend_dir = runtime_environment["backend_dir"]
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    original_app_modules = snapshot_cached_modules(("app",))
    clear_cached_modules(("app",))
    config_module = importlib.import_module("app.core.config")
    config_module.get_settings.cache_clear()

    database_module = importlib.import_module("app.core.database")
    models_base_module = importlib.import_module("app.models.base")
    bootstrap_module = importlib.import_module("app.services.bootstrap")
    job_models_module = importlib.import_module("app.models.job")
    task_record_models_module = importlib.import_module("app.models.task_record")
    app_main_module = importlib.import_module("app.main")

    yield {
        "app": app_main_module.app,
        "Base": models_base_module.Base,
        "SessionLocal": database_module.SessionLocal,
        "engine": database_module.engine,
        "init_database": database_module.init_database,
        "seed_defaults": bootstrap_module.seed_defaults,
        "Job": job_models_module.Job,
        "JobSchedule": job_models_module.JobSchedule,
        "TaskRecord": task_record_models_module.TaskRecord,
    }

    restore_cached_modules(("app",), original_app_modules)


@pytest.fixture(autouse=True)
def reset_database(app_modules, runtime_environment):
    shutil.rmtree(runtime_environment["storage_root"], ignore_errors=True)
    runtime_environment["storage_root"].mkdir(parents=True, exist_ok=True)

    app_modules["Base"].metadata.drop_all(bind=app_modules["engine"])
    app_modules["init_database"]()
    with app_modules["SessionLocal"]() as db:
        app_modules["seed_defaults"](db)
    yield


@pytest.fixture()
def client(app_modules):
    with TestClient(app_modules["app"]) as test_client:
        yield test_client


@pytest.fixture()
def db_session(app_modules):
    with app_modules["SessionLocal"]() as db:
        yield db


@pytest.fixture()
def admin_headers(client):
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123456"},
    )
    assert response.status_code == 200
    access_token = response.json()["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture()
def runtime_process_manager(runtime_environment, tmp_path):
    processes = []
    log_dir = tmp_path / "runtime-logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    def start(*, worker: bool, scheduler: bool):
        started = start_runtime_processes(
            backend_dir=runtime_environment["backend_dir"],
            env=runtime_environment["env"],
            log_dir=log_dir,
            worker=worker,
            scheduler=scheduler,
            start_worker_fn=start_worker_process,
            wait_for_worker_ready_fn=wait_for_worker_ready,
            start_scheduler_fn=start_scheduler_process,
            wait_for_scheduler_ready_fn=wait_for_scheduler_ready,
            terminate_process_fn=terminate_process,
        )
        for process in started.values():
            processes.append(process)
        return started

    yield start

    for process in reversed(processes):
        terminate_process(process)
