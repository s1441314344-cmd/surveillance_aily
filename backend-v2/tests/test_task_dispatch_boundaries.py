from datetime import datetime, timezone
from types import SimpleNamespace

from app.core.database import SessionLocal
from app.models.camera_signal import CameraSignalMonitorConfig
from app.models.job import Job
from app.services import job_service, scheduler_service, scheduler_signal_monitor_sweep_service, task_dispatcher


def test_queue_job_processing_delegates_to_task_dispatcher(monkeypatch):
    dispatched_job_ids: list[str] = []

    def fake_dispatch_job_processing(*, job_id: str) -> str:
        dispatched_job_ids.append(job_id)
        return "celery-task-123"

    monkeypatch.setattr(job_service.settings, "celery_enabled", True)
    monkeypatch.setattr("app.workers.tasks.process_job.delay", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(job_service, "dispatch_job_processing", fake_dispatch_job_processing, raising=False)

    with SessionLocal() as db:
        job = Job(
            id="job-dispatch-1",
            job_type="camera_once",
            trigger_mode="manual",
            strategy_id="preset-fire",
            strategy_name="Fire Detect",
            camera_id="cam-1",
            schedule_id=None,
            model_provider="mock",
            model_name="mock-v1",
            status="queued",
            total_items=1,
            completed_items=0,
            failed_items=0,
            error_message=None,
            payload={},
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        job_service._queue_job_processing(db, job, dispatch=True)
        db.refresh(job)

    assert dispatched_job_ids == ["job-dispatch-1"]
    assert job.celery_task_id == "celery-task-123"


def test_signal_monitor_sweep_delegates_dispatch_to_task_dispatcher(monkeypatch):
    dispatched_cycles: list[tuple[str, bool]] = []
    monitor_config = SimpleNamespace(
        id="monitor-1",
        camera_id="cam-monitor-1",
        strict_local_gate=False,
        last_error=None,
    )

    def fake_dispatch_signal_monitor_cycle(*, db, camera_id: str, dispatch: bool) -> None:
        dispatched_cycles.append((camera_id, dispatch))

    monkeypatch.setattr(scheduler_service.settings, "celery_enabled", True)
    monkeypatch.setattr("app.workers.tasks.process_camera_cycle.delay", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        scheduler_service,
        "list_due_monitor_configs",
        lambda db, now: [monitor_config],
    )
    monkeypatch.setattr(
        scheduler_service,
        "advance_monitor_schedule",
        lambda config, now: None,
    )
    monkeypatch.setattr(
        scheduler_service,
        "dispatch_signal_monitor_cycle",
        fake_dispatch_signal_monitor_cycle,
        raising=False,
    )

    with SessionLocal() as db:
        processed_camera_ids = scheduler_service.run_due_signal_monitors_once_with_db(
            db,
            now=datetime.now(timezone.utc),
            dispatch_jobs=True,
        )

    assert processed_camera_ids == ["cam-monitor-1"]
    assert dispatched_cycles == [("cam-monitor-1", True)]


def test_dispatch_signal_monitor_cycle_runs_inline_pipeline_when_dispatch_disabled(monkeypatch):
    captured: dict[str, object] = {}

    def fake_process_camera_signal_cycle(db, *, camera_id: str, trigger_source: str):
        captured["db"] = db
        captured["camera_id"] = camera_id
        captured["trigger_source"] = trigger_source
        return None

    monkeypatch.setattr(
        "app.services.camera_signal_pipeline_service.process_camera_signal_cycle",
        fake_process_camera_signal_cycle,
    )

    sentinel_db = object()
    task_dispatcher.dispatch_signal_monitor_cycle(
        db=sentinel_db,
        camera_id="cam-inline-1",
        dispatch=False,
    )

    assert captured == {
        "db": sentinel_db,
        "camera_id": "cam-inline-1",
        "trigger_source": "signal_monitor_inline",
    }


def test_process_due_monitor_config_rolls_back_and_marks_error_on_dispatch_failure():
    now = datetime.now(timezone.utc)
    marked_errors: list[tuple[str, str]] = []

    with SessionLocal() as db:
        config = CameraSignalMonitorConfig(
            id="monitor-rollback-1",
            camera_id="cam-rollback-1",
            enabled=True,
            runtime_mode="daemon",
            signal_strategy_id=None,
            strict_local_gate=False,
            monitor_interval_seconds=30,
            schedule_type=None,
            schedule_value=None,
            manual_until=None,
            roi_enabled=False,
            roi_x=None,
            roi_y=None,
            roi_width=None,
            roi_height=None,
            roi_shape="rect",
            roi_points=None,
            next_run_at=now,
            last_run_at=None,
            last_error=None,
        )
        db.add(config)
        db.commit()
        db.refresh(config)

        processed = scheduler_signal_monitor_sweep_service.process_due_monitor_config(
            db=db,
            config=config,
            current_time=now,
            should_dispatch=True,
            run_local_gate=lambda **_kwargs: (_ for _ in ()).throw(AssertionError("local gate should not run")),
            advance_schedule=lambda active_config, now: setattr(active_config, "last_run_at", now),
            mark_error=lambda active_config, error_message, now: (
                marked_errors.append((active_config.id, error_message)),
                setattr(active_config, "last_error", f"marked:{error_message}"),
            ),
            dispatch_cycle=lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("dispatch boom")),
        )
        db.expire_all()
        persisted = db.get(CameraSignalMonitorConfig, config.id)

    assert processed is False
    assert marked_errors == [("monitor-rollback-1", "dispatch boom")]
    assert persisted is not None
    assert persisted.last_error == "marked:dispatch boom"
