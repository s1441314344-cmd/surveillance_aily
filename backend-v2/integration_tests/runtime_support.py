from __future__ import annotations

import shutil
import subprocess
import sys
import time
from collections.abc import MutableMapping
from dataclasses import dataclass
from pathlib import Path


class RuntimeReadinessError(RuntimeError):
    pass


@dataclass
class ManagedProcess:
    name: str
    process: subprocess.Popen[str]
    log_path: Path
    log_handle: object


def snapshot_cached_modules(
    prefixes: tuple[str, ...],
    *,
    modules: MutableMapping[str, object] | None = None,
) -> dict[str, object]:
    module_cache = sys.modules if modules is None else modules
    return {
        module_name: module
        for module_name, module in list(module_cache.items())
        if any(module_name == prefix or module_name.startswith(f"{prefix}.") for prefix in prefixes)
    }


def clear_cached_modules(
    prefixes: tuple[str, ...],
    *,
    modules: MutableMapping[str, object] | None = None,
) -> None:
    module_cache = sys.modules if modules is None else modules
    targets = [
        module_name
        for module_name in list(module_cache.keys())
        if any(module_name == prefix or module_name.startswith(f"{prefix}.") for prefix in prefixes)
    ]
    for module_name in targets:
        module_cache.pop(module_name, None)


def restore_cached_modules(
    prefixes: tuple[str, ...],
    snapshot: MutableMapping[str, object],
    *,
    modules: MutableMapping[str, object] | None = None,
) -> None:
    module_cache = sys.modules if modules is None else modules
    clear_cached_modules(prefixes, modules=module_cache)
    module_cache.update(snapshot)


def ensure_docker_available(*, which=shutil.which, run=subprocess.run) -> None:
    docker_bin = which("docker")
    if docker_bin is None:
        raise RuntimeReadinessError("docker is required for backend integration tests")
    result = run(
        [docker_bin, "info"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeReadinessError("docker daemon is not available for backend integration tests")


def start_process(
    *,
    name: str,
    command: list[str],
    cwd: Path,
    env: dict[str, str],
    log_path: Path,
) -> ManagedProcess:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_handle = log_path.open("w", encoding="utf-8")
    process = subprocess.Popen(
        command,
        cwd=str(cwd),
        env=env,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        text=True,
    )
    return ManagedProcess(
        name=name,
        process=process,
        log_path=log_path,
        log_handle=log_handle,
    )


def start_worker_process(*, backend_dir: Path, env: dict[str, str], log_dir: Path) -> ManagedProcess:
    return start_process(
        name="worker",
        command=[
            "python3",
            "-m",
            "celery",
            "-A",
            "app.core.celery_app.celery_app",
            "worker",
            "--pool=solo",
            "--loglevel=warning",
        ],
        cwd=backend_dir,
        env=env,
        log_path=log_dir / "worker.log",
    )


def start_scheduler_process(*, backend_dir: Path, env: dict[str, str], log_dir: Path) -> ManagedProcess:
    return start_process(
        name="scheduler",
        command=["python3", "-m", "app.schedulers.runner"],
        cwd=backend_dir,
        env=env,
        log_path=log_dir / "scheduler.log",
    )


def start_runtime_processes(
    *,
    backend_dir: Path,
    env: dict[str, str],
    log_dir: Path,
    worker: bool,
    scheduler: bool,
    start_worker_fn=None,
    wait_for_worker_ready_fn=None,
    start_scheduler_fn=None,
    wait_for_scheduler_ready_fn=None,
    terminate_process_fn=None,
) -> dict[str, ManagedProcess]:
    start_worker_fn = start_worker_fn or start_worker_process
    wait_for_worker_ready_fn = wait_for_worker_ready_fn or wait_for_worker_ready
    start_scheduler_fn = start_scheduler_fn or start_scheduler_process
    wait_for_scheduler_ready_fn = wait_for_scheduler_ready_fn or wait_for_scheduler_ready
    terminate_process_fn = terminate_process_fn or terminate_process
    processes: list[ManagedProcess] = []
    started: dict[str, ManagedProcess] = {}
    try:
        if worker:
            worker_process = start_worker_fn(
                backend_dir=backend_dir,
                env=env,
                log_dir=log_dir,
            )
            processes.append(worker_process)
            wait_for_worker_ready_fn(
                process=worker_process,
                backend_dir=backend_dir,
                env=env,
            )
            started["worker"] = worker_process
        if scheduler:
            scheduler_process = start_scheduler_fn(
                backend_dir=backend_dir,
                env=env,
                log_dir=log_dir,
            )
            processes.append(scheduler_process)
            wait_for_scheduler_ready_fn(process=scheduler_process)
            started["scheduler"] = scheduler_process
        return started
    except Exception:
        for process in reversed(processes):
            terminate_process_fn(process)
        raise


def terminate_process(process: ManagedProcess) -> None:
    if process.process.poll() is None:
        process.process.terminate()
        try:
            process.process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.process.kill()
            process.process.wait(timeout=10)
    if hasattr(process.log_handle, "close"):
        process.log_handle.close()


def wait_for_worker_ready(
    *,
    process: ManagedProcess,
    backend_dir: Path,
    env: dict[str, str],
    timeout_seconds: float = 30,
    inspect_command: list[str] | None = None,
    run=subprocess.run,
    time_fn=time.monotonic,
    sleep_fn=time.sleep,
) -> None:
    command = inspect_command or [
        "python3",
        "-m",
        "celery",
        "-A",
        "app.core.celery_app.celery_app",
        "inspect",
        "ping",
        "--timeout=1",
    ]
    deadline = time_fn() + timeout_seconds
    while time_fn() < deadline:
        if process.process.poll() is not None:
            raise RuntimeReadinessError(
                f"worker process exited before readiness check passed: {read_log_tail(process.log_path)}"
            )
        result = run(
            command,
            cwd=str(backend_dir),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        output = f"{result.stdout}\n{result.stderr}".lower()
        if result.returncode == 0 and "pong" in output:
            return
        sleep_fn(0.5)
    raise RuntimeReadinessError(f"worker readiness timed out: {read_log_tail(process.log_path)}")


def wait_for_scheduler_ready(
    *,
    process: ManagedProcess,
    timeout_seconds: float = 30,
    ready_marker: str = "scheduler started with poll interval=",
    time_fn=time.monotonic,
    sleep_fn=time.sleep,
) -> None:
    deadline = time_fn() + timeout_seconds
    while time_fn() < deadline:
        if process.process.poll() is not None:
            raise RuntimeReadinessError(
                f"scheduler process exited before readiness check passed: {read_log_tail(process.log_path)}"
            )
        if process.log_path.exists() and ready_marker in process.log_path.read_text(encoding="utf-8", errors="ignore"):
            return
        sleep_fn(0.5)
    raise RuntimeReadinessError(f"scheduler readiness timed out: {read_log_tail(process.log_path)}")


def read_log_tail(path: Path, *, max_chars: int = 400) -> str:
    if not path.exists():
        return "<log file not found>"
    content = path.read_text(encoding="utf-8", errors="ignore").strip()
    if not content:
        return "<log file empty>"
    return content[-max_chars:]
