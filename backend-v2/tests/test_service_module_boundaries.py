import ast
from pathlib import Path

from app.services import job_service, scheduler_service
from app.services.alert_delivery_service import run_due_alert_webhook_deliveries_once
from app.services.camera_status_sweep_service import (
    run_camera_status_sweep_once,
    run_camera_status_sweep_once_with_db,
)
from app.services.job_command_service import cancel_job, retry_job, run_job_inline
from app.services.job_creation_service import (
    create_camera_once_job,
    create_camera_schedule_job,
    create_camera_snapshot_upload_job,
    create_upload_job,
    create_version_recognition_upload_job,
)
from app.services.job_queries import get_job_or_404, list_jobs, serialize_job
from app.services.schedule_dispatch_service import (
    run_due_job_schedules_once,
    run_due_job_schedules_once_report,
    run_due_job_schedules_once_with_db,
    run_due_job_schedules_once_with_db_report,
)
from app.services.signal_monitor_orchestrator import (
    run_due_signal_monitors_once,
    run_due_signal_monitors_once_with_db,
)


BACKEND_DIR = Path(__file__).resolve().parents[1]
SERVICES_DIR = BACKEND_DIR / "app" / "services"


def _module_path(*parts: str) -> Path:
    return BACKEND_DIR.joinpath(*parts)


def _read_module_ast(*parts: str) -> ast.Module:
    return ast.parse(_module_path(*parts).read_text(encoding="utf-8"))


def _imported_modules(*parts: str) -> set[str]:
    imported_modules: set[str] = set()
    for node in ast.walk(_read_module_ast(*parts)):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported_modules.add(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported_modules.add(node.module)
    return imported_modules


def test_job_service_reexports_split_modules():
    assert job_service.serialize_job is serialize_job
    assert job_service.list_jobs is list_jobs
    assert job_service.get_job_or_404 is get_job_or_404
    assert job_service.create_upload_job is create_upload_job
    assert job_service.create_version_recognition_upload_job is create_version_recognition_upload_job
    assert job_service.create_camera_snapshot_upload_job is create_camera_snapshot_upload_job
    assert job_service.create_camera_once_job is create_camera_once_job
    assert job_service.create_camera_schedule_job is create_camera_schedule_job
    assert job_service.cancel_job is cancel_job
    assert job_service.retry_job is retry_job
    assert job_service.run_job_inline is run_job_inline


def test_scheduler_service_reexports_split_modules():
    assert scheduler_service.run_due_job_schedules_once is run_due_job_schedules_once
    assert scheduler_service.run_due_job_schedules_once_report is run_due_job_schedules_once_report
    assert scheduler_service.run_due_job_schedules_once_with_db is run_due_job_schedules_once_with_db
    assert scheduler_service.run_due_job_schedules_once_with_db_report is run_due_job_schedules_once_with_db_report
    assert scheduler_service.run_camera_status_sweep_once is run_camera_status_sweep_once
    assert scheduler_service.run_camera_status_sweep_once_with_db is run_camera_status_sweep_once_with_db
    assert scheduler_service.run_due_signal_monitors_once is run_due_signal_monitors_once
    assert scheduler_service.run_due_signal_monitors_once_with_db is run_due_signal_monitors_once_with_db
    assert scheduler_service.run_due_alert_webhook_deliveries_once is run_due_alert_webhook_deliveries_once


def test_service_layer_worker_dispatch_imports_only_exist_in_task_dispatcher():
    violating_files: list[str] = []
    for path in sorted(SERVICES_DIR.glob("*.py")):
        if path.name in {"__init__.py", "task_dispatcher.py"}:
            continue
        content = path.read_text(encoding="utf-8")
        if "app.workers.tasks" in content:
            violating_files.append(path.name)

    assert violating_files == []


def test_job_execution_service_delegates_version_recognition_pipeline():
    imported = _imported_modules("app", "services", "job_execution_service.py")
    assert "app.services.version_recognition_pipeline_service" in imported

    module_ast = _read_module_ast("app", "services", "job_execution_service.py")
    target = next(
        (
            node
            for node in module_ast.body
            if isinstance(node, ast.FunctionDef) and node.name == "_process_version_recognition_job"
        ),
        None,
    )
    assert target is not None
    assert any(
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "process_version_recognition_job"
        for node in ast.walk(target)
    )


def test_jobs_route_imports_split_job_services_directly():
    imported = _imported_modules("app", "api", "routes", "jobs.py")

    assert "app.services.job_service" not in imported
    assert "app.services.scheduler_service" not in imported
    assert {
        "app.services.job_command_service",
        "app.services.job_creation_service",
        "app.services.job_queries",
    }.issubset(imported)


def test_job_schedules_route_imports_split_services_directly():
    imported = _imported_modules("app", "api", "routes", "job_schedules.py")

    assert "app.services.job_service" not in imported
    assert "app.services.scheduler_service" not in imported
    assert {
        "app.services.job_creation_service",
        "app.services.job_schedule_service",
    }.issubset(imported)


def test_scheduler_runner_imports_split_scheduler_services_directly():
    imported = _imported_modules("app", "schedulers", "runner.py")

    assert "app.services.scheduler_service" not in imported
    assert {
        "app.services.alert_delivery_service",
        "app.services.camera_status_sweep_service",
        "app.services.schedule_dispatch_service",
        "app.services.signal_monitor_orchestrator",
    }.issubset(imported)


def test_compatibility_service_facades_remain_reexport_only_shims():
    for relative_path in (
        ("app", "services", "job_service.py"),
        ("app", "services", "scheduler_service.py"),
    ):
        module_ast = _read_module_ast(*relative_path)
        for node in module_ast.body:
            if isinstance(node, ast.ImportFrom):
                continue
            if isinstance(node, ast.Assign):
                assert len(node.targets) == 1
                assert isinstance(node.targets[0], ast.Name)
                assert node.targets[0].id == "__all__"
                continue
            raise AssertionError(f"{'/'.join(relative_path)} must stay a pure re-export shim")
