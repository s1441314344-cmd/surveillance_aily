from __future__ import annotations

from pathlib import Path

import pytest

from integration_tests.runtime_support import (
    ManagedProcess,
    RuntimeReadinessError,
    clear_cached_modules,
    ensure_docker_available,
    restore_cached_modules,
    snapshot_cached_modules,
    start_runtime_processes,
    wait_for_scheduler_ready,
    wait_for_worker_ready,
)


class _FakeProcess:
    def __init__(self, poll_results):
        self._poll_results = list(poll_results)
        self.returncode = None if not self._poll_results else self._poll_results[-1]

    def poll(self):
        if self._poll_results:
            return self._poll_results.pop(0)
        return self.returncode


class _FakeLogHandle:
    def close(self):
        return None


def test_runtime_support_requires_docker_binary():
    with pytest.raises(RuntimeReadinessError, match="docker is required"):
        ensure_docker_available(which=lambda _name: None)


def test_worker_readiness_times_out_when_process_never_becomes_ready(tmp_path):
    worker_process = ManagedProcess(
        name="worker",
        process=_FakeProcess([None, None, None]),
        log_path=tmp_path / "worker.log",
        log_handle=_FakeLogHandle(),
    )
    worker_process.log_path.write_text("worker booting", encoding="utf-8")
    time_points = iter([0.0, 0.4, 0.8, 1.2])

    class _Result:
        returncode = 1
        stdout = ""
        stderr = ""

    with pytest.raises(RuntimeReadinessError, match="worker readiness timed out"):
        wait_for_worker_ready(
            process=worker_process,
            backend_dir=Path(tmp_path),
            env={},
            timeout_seconds=1,
            inspect_command=["false"],
            run=lambda *args, **kwargs: _Result(),
            time_fn=lambda: next(time_points),
            sleep_fn=lambda _seconds: None,
        )


def test_scheduler_readiness_fails_when_process_exits_early(tmp_path):
    log_path = tmp_path / "scheduler.log"
    log_path.write_text("scheduler booting", encoding="utf-8")
    scheduler_process = ManagedProcess(
        name="scheduler",
        process=_FakeProcess([1]),
        log_path=log_path,
        log_handle=_FakeLogHandle(),
    )

    with pytest.raises(RuntimeReadinessError, match="scheduler process exited before readiness check passed"):
        wait_for_scheduler_ready(
            process=scheduler_process,
            timeout_seconds=1,
            time_fn=lambda: 0.0,
            sleep_fn=lambda _seconds: None,
        )


def test_start_runtime_processes_terminates_started_processes_when_scheduler_readiness_fails(tmp_path):
    worker_process = ManagedProcess(
        name="worker",
        process=_FakeProcess([None]),
        log_path=tmp_path / "worker.log",
        log_handle=_FakeLogHandle(),
    )
    scheduler_process = ManagedProcess(
        name="scheduler",
        process=_FakeProcess([None]),
        log_path=tmp_path / "scheduler.log",
        log_handle=_FakeLogHandle(),
    )
    terminated = []

    with pytest.raises(RuntimeReadinessError, match="scheduler readiness timed out"):
        start_runtime_processes(
            backend_dir=tmp_path,
            env={},
            log_dir=tmp_path,
            worker=True,
            scheduler=True,
            start_worker_fn=lambda **_kwargs: worker_process,
            wait_for_worker_ready_fn=lambda **_kwargs: None,
            start_scheduler_fn=lambda **_kwargs: scheduler_process,
            wait_for_scheduler_ready_fn=lambda **_kwargs: (_ for _ in ()).throw(
                RuntimeReadinessError("scheduler readiness timed out")
            ),
            terminate_process_fn=lambda process: terminated.append(process.name),
        )

    assert terminated == ["scheduler", "worker"]


def test_clear_cached_modules_removes_targeted_prefixes_only():
    modules = {
        "app": object(),
        "app.main": object(),
        "app.core.database": object(),
        "integration_tests.conftest": object(),
        "other.module": object(),
    }

    clear_cached_modules(("app",), modules=modules)

    assert "app" not in modules
    assert "app.main" not in modules
    assert "app.core.database" not in modules
    assert "integration_tests.conftest" in modules
    assert "other.module" in modules


def test_restore_cached_modules_reinstates_original_snapshot():
    original_app = object()
    original_main = object()
    replacement_app = object()
    modules = {
        "app": original_app,
        "app.main": original_main,
        "other.module": object(),
    }

    snapshot = snapshot_cached_modules(("app",), modules=modules)
    modules["app"] = replacement_app
    modules["app.worker"] = object()

    restore_cached_modules(("app",), snapshot, modules=modules)

    assert modules["app"] is original_app
    assert modules["app.main"] is original_main
    assert "app.worker" not in modules
    assert "other.module" in modules
