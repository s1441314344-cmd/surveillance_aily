from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings

settings = get_settings()
database_url = make_url(settings.database_url)

engine_kwargs = {"future": True, "pool_pre_ping": True}
if database_url.get_backend_name().startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.database_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_database() -> None:
    import app.models  # noqa: F401
    from app.models.base import Base

    Base.metadata.create_all(bind=engine)
    ensure_runtime_schema_columns()


def ensure_runtime_schema_columns() -> None:
    runtime_schema_patches = {
        "jobs": {
            "schedule_id": "VARCHAR(36)",
            "celery_task_id": "VARCHAR(100)",
            "started_at": "TIMESTAMP",
            "finished_at": "TIMESTAMP",
        },
        "job_schedules": {
            "next_run_at": "TIMESTAMP",
            "last_run_at": "TIMESTAMP",
            "last_error": "TEXT",
        },
    }

    inspector = inspect(engine)
    with engine.begin() as connection:
        for table_name, columns in runtime_schema_patches.items():
            if table_name not in inspector.get_table_names():
                continue
            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_type in columns.items():
                if column_name in existing_columns:
                    continue
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))
