from __future__ import annotations

import json
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
