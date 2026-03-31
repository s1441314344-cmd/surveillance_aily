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
        "analysis_strategies": {
            "result_format": "VARCHAR(30) DEFAULT 'json_schema'",
            "is_signal_strategy": "BOOLEAN DEFAULT false",
            "signal_mapping": "JSON",
        },
        "jobs": {
            "schedule_id": "VARCHAR(36)",
            "celery_task_id": "VARCHAR(100)",
            "started_at": "TIMESTAMP",
            "finished_at": "TIMESTAMP",
        },
        "job_schedules": {
            "precheck_strategy_id": "VARCHAR(36)",
            "next_run_at": "TIMESTAMP",
            "last_run_at": "TIMESTAMP",
            "last_error": "TEXT",
        },
        "camera_media": {
            "related_job_id": "VARCHAR(36)",
        },
        "camera_trigger_rules": {
            "match_mode": "VARCHAR(20) DEFAULT 'simple'",
            "expression_json": "JSON",
            "priority": "INTEGER DEFAULT 100",
            "action_policy_json": "JSON",
        },
        "camera_signal_monitor_configs": {
            "enabled": "BOOLEAN DEFAULT 0",
            "runtime_mode": "VARCHAR(20) DEFAULT 'daemon'",
            "signal_strategy_id": "VARCHAR(36)",
            "monitor_interval_seconds": "INTEGER DEFAULT 30",
            "schedule_type": "VARCHAR(30)",
            "schedule_value": "VARCHAR(100)",
            "manual_until": "TIMESTAMP",
            "next_run_at": "TIMESTAMP",
            "last_run_at": "TIMESTAMP",
            "last_error": "TEXT",
        },
        "camera_signal_states": {
            "last_confidence": "FLOAT DEFAULT 0",
            "consecutive_hits": "INTEGER DEFAULT 0",
            "last_seen_at": "TIMESTAMP",
        },
        "camera_rule_hit_logs": {
            "signals": "JSON",
            "expression_result": "JSON",
            "media_id": "VARCHAR(36)",
            "alert_event_id": "VARCHAR(36)",
        },
        "alert_events": {
            "status": "VARCHAR(20) DEFAULT 'open'",
            "message": "TEXT",
            "media_id": "VARCHAR(36)",
            "payload": "JSON",
            "occurred_at": "TIMESTAMP",
            "acked_at": "TIMESTAMP",
            "resolved_at": "TIMESTAMP",
        },
        "alert_webhook_endpoints": {
            "secret": "VARCHAR(255)",
            "status": "VARCHAR(20) DEFAULT 'active'",
            "timeout_seconds": "INTEGER DEFAULT 5",
        },
        "alert_webhook_deliveries": {
            "attempt_count": "INTEGER DEFAULT 0",
            "response_code": "INTEGER",
            "response_body": "TEXT",
            "last_error": "TEXT",
            "next_retry_at": "TIMESTAMP",
            "last_attempt_at": "TIMESTAMP",
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

        # Backfill data for newly added runtime columns.
        if "analysis_strategies" in inspector.get_table_names():
            connection.execute(
                text(
                    "UPDATE analysis_strategies "
                    "SET result_format = 'json_schema' "
                    "WHERE result_format IS NULL OR result_format = ''"
                )
            )
            connection.execute(
                text(
                    "UPDATE analysis_strategies "
                    "SET is_signal_strategy = false "
                    "WHERE is_signal_strategy IS NULL"
                )
            )

        if "camera_trigger_rules" in inspector.get_table_names():
            connection.execute(
                text(
                    "UPDATE camera_trigger_rules "
                    "SET match_mode = 'simple' "
                    "WHERE match_mode IS NULL OR match_mode = ''"
                )
            )
            connection.execute(
                text(
                    "UPDATE camera_trigger_rules "
                    "SET priority = 100 "
                    "WHERE priority IS NULL"
                )
            )

        if "camera_signal_monitor_configs" in inspector.get_table_names():
            connection.execute(
                text(
                    "UPDATE camera_signal_monitor_configs "
                    "SET runtime_mode = 'daemon' "
                    "WHERE runtime_mode IS NULL OR runtime_mode = ''"
                )
            )
            connection.execute(
                text(
                    "UPDATE camera_signal_monitor_configs "
                    "SET monitor_interval_seconds = 30 "
                    "WHERE monitor_interval_seconds IS NULL OR monitor_interval_seconds <= 0"
                )
            )

        if "alert_events" in inspector.get_table_names():
            connection.execute(
                text(
                    "UPDATE alert_events "
                    "SET status = 'open' "
                    "WHERE status IS NULL OR status = ''"
                )
            )

        if "alert_webhook_endpoints" in inspector.get_table_names():
            connection.execute(
                text(
                    "UPDATE alert_webhook_endpoints "
                    "SET status = 'active' "
                    "WHERE status IS NULL OR status = ''"
                )
            )
            connection.execute(
                text(
                    "UPDATE alert_webhook_endpoints "
                    "SET timeout_seconds = 5 "
                    "WHERE timeout_seconds IS NULL OR timeout_seconds <= 0"
                )
            )
