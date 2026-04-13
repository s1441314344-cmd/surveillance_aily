from __future__ import annotations

import json
import sqlite3
import subprocess
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]


def run_script(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=ROOT_DIR,
        text=True,
        capture_output=True,
        check=False,
    )


def test_verify_summary_contains_metadata_when_all_stages_skipped(tmp_path: Path):
    output_dir = tmp_path / "verify"
    result = run_script(
        "./scripts/v2/verify.sh",
        "--skip-precheck",
        "--skip-preflight",
        "--skip-uat",
        "--output-dir",
        str(output_dir),
    )

    assert result.returncode == 0, result.stderr
    summary = json.loads((output_dir / "summary.json").read_text(encoding="utf-8"))
    assert summary["run_id"].startswith("verify-")
    assert summary["git_sha"]
    assert summary["branch"]
    assert "started_at" in summary
    assert "finished_at" in summary
    assert summary["environment"]
    assert summary["parameter_summary"] == {
        "run_precheck": False,
        "run_preflight": False,
        "run_uat": False,
        "preflight_with_e2e": False,
    }


def test_release_gate_requires_override_reason_for_skip_uat(tmp_path: Path):
    fake_summary = tmp_path / "uat-summary.json"
    fake_summary.write_text("{}", encoding="utf-8")

    result = run_script(
        "./scripts/v2/release-gate.sh",
        "--skip-uat",
        "--uat-summary",
        str(fake_summary),
    )

    assert result.returncode == 2
    assert "override flags require --override-reason" in result.stderr


def test_release_checklist_requires_explicit_uat_summary():
    result = run_script("./scripts/v2/release-checklist.sh")

    assert result.returncode == 2
    assert "UAT summary is required" in result.stderr


def test_common_sh_uses_safe_celery_pool_on_macos():
    result = run_script(
        "env",
        "OSTYPE=darwin23",
        "bash",
        "-lc",
        "source scripts/v2/common.sh && resolve_celery_pool",
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "solo"


def test_common_sh_honors_explicit_celery_pool_override():
    result = run_script(
        "env",
        "OSTYPE=darwin23",
        "V2_CELERY_POOL=threads",
        "bash",
        "-lc",
        "source scripts/v2/common.sh && resolve_celery_pool",
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "threads"


def test_smoke_script_cleans_up_created_schedules_and_cameras_on_exit():
    script = (ROOT_DIR / "scripts/v2/smoke.sh").read_text(encoding="utf-8")

    assert "cleanup_resources" in script
    assert "finally:" in script
    assert 'delete_json(f"/api/job-schedules/{schedule_id}"' in script
    assert 'delete_json(f"/api/cameras/{camera_id}"' in script


def test_security_script_uses_quoted_python_heredoc_and_filters_platform_noise():
    script = (ROOT_DIR / "scripts/v2/security.sh").read_text(encoding="utf-8")

    assert "python3 - <<'PY'" in script
    assert "is not supported on this platform" in script


def test_reconcile_script_starts_dependencies_and_uses_quoted_python_heredoc():
    script = (ROOT_DIR / "scripts/v2/reconcile.sh").read_text(encoding="utf-8")

    assert "make v2-deps-up" in script
    assert "python3 - <<'PY'" in script


def test_preflight_supports_failure_injection_modes():
    script = (ROOT_DIR / "scripts/v2/preflight.sh").read_text(encoding="utf-8")

    assert "--inject-deps-unready" in script
    assert "--inject-queue-down" in script
    assert "--inject-worker-unregistered" in script
    assert '"injection_mode": "${INJECTION_MODE}" or None' in script


def test_e2e_entrypoint_supports_group_selection_via_env():
    script = (ROOT_DIR / "scripts/v2/e2e-entrypoint.sh").read_text(encoding="utf-8")

    assert 'E2E_GROUP="${V2_E2E_GROUP:-}"' in script
    assert "npm run e2e:grouped" in script
    assert "npm run e2e:mainline" in script
    assert "npm run e2e:observability" in script
    assert "npm run e2e:regression" in script
    assert "unsupported V2_E2E_GROUP" in script


def test_preflight_deps_unready_injection_fails_fast_and_writes_summary(tmp_path: Path):
    output_dir = tmp_path / "preflight-injection"
    result = run_script(
        "./scripts/v2/preflight.sh",
        "--inject-deps-unready",
        "--output-dir",
        str(output_dir),
    )

    assert result.returncode == 2
    summary = json.loads((output_dir / "summary.json").read_text(encoding="utf-8"))
    assert summary["result"] == "failed"
    assert summary["parameter_summary"]["injection_mode"] == "deps-unready"
    assert summary["readiness"]["api"]["status"] == "failed"
    assert summary["readiness"]["worker"]["status"] == "skipped"
    assert summary["readiness"]["scheduler"]["status"] == "skipped"


def test_preflight_queue_down_injection_fails_fast_and_writes_summary(tmp_path: Path):
    output_dir = tmp_path / "preflight-queue-injection"
    result = run_script(
        "./scripts/v2/preflight.sh",
        "--inject-queue-down",
        "--output-dir",
        str(output_dir),
    )

    assert result.returncode == 2
    summary = json.loads((output_dir / "summary.json").read_text(encoding="utf-8"))
    assert summary["result"] == "failed"
    assert summary["parameter_summary"]["injection_mode"] == "queue-down"
    assert summary["readiness"]["api"]["status"] == "skipped"
    assert summary["readiness"]["worker"]["status"] == "failed"
    assert summary["readiness"]["scheduler"]["status"] == "skipped"


def test_preflight_worker_unregistered_injection_fails_fast_and_writes_summary(tmp_path: Path):
    output_dir = tmp_path / "preflight-worker-injection"
    result = run_script(
        "./scripts/v2/preflight.sh",
        "--inject-worker-unregistered",
        "--output-dir",
        str(output_dir),
    )

    assert result.returncode == 2
    summary = json.loads((output_dir / "summary.json").read_text(encoding="utf-8"))
    assert summary["result"] == "failed"
    assert summary["parameter_summary"]["injection_mode"] == "worker-unregistered"
    assert summary["readiness"]["api"]["status"] == "skipped"
    assert summary["readiness"]["worker"]["status"] == "failed"
    assert summary["readiness"]["scheduler"]["status"] == "skipped"


def test_legacy_reconcile_fixture_files_exist():
    source_db = ROOT_DIR / "data" / "surveillance.db"
    assert source_db.exists(), f"missing legacy source db: {source_db}"

    conn = sqlite3.connect(source_db)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            select image_path as raw_path from detection_records where image_path is not null and trim(image_path) <> ''
            union all
            select image_path_1 as raw_path from submit_tasks where image_path_1 is not null and trim(image_path_1) <> ''
            union all
            select image_path_2 as raw_path from submit_tasks where image_path_2 is not null and trim(image_path_2) <> ''
            """
        ).fetchall()
    finally:
        conn.close()

    missing_paths: list[str] = []
    for row in rows:
        raw_path = str(row["raw_path"]).strip()
        resolved_path = (ROOT_DIR / raw_path).resolve()
        if not resolved_path.exists():
            missing_paths.append(str(resolved_path))

    assert not missing_paths, (
        "legacy reconcile fixtures referenced by surveillance.db must stay in the repo: "
        + ", ".join(missing_paths)
    )
