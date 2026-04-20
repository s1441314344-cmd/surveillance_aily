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


def test_release_gate_summary_marks_bypass_runs_and_default_release_entrypoint(tmp_path: Path):
    output_dir = tmp_path / "release-gate"
    fake_uat_summary = tmp_path / "uat-summary.json"
    fake_uat_summary.write_text(
        json.dumps(
            {
                "result": "passed",
                "checks": {
                    "backend_pytest": {"status": "passed"},
                    "frontend_lint": {"status": "passed"},
                    "frontend_unit": {"status": "passed"},
                    "frontend_build": {"status": "passed"},
                    "e2e": {"status": "passed"},
                    "security": {"status": "passed"},
                    "reconcile": {"status": "passed"},
                    "release_drill": {"status": "skipped"},
                },
            }
        ),
        encoding="utf-8",
    )

    result = run_script(
        "./scripts/v2/release-gate.sh",
        "--skip-uat",
        "--without-release-drill",
        "--override-reason",
        "non-production verification run",
        "--uat-summary",
        str(fake_uat_summary),
        "--output-dir",
        str(output_dir),
    )

    assert result.returncode == 0, result.stderr
    summary = json.loads((output_dir / "gate-summary.json").read_text(encoding="utf-8"))
    assert summary["override"]["active"] is True
    assert summary["release_policy"] == {
        "default_entrypoint": "make v2-release-gate-final",
        "bypass_run": True,
        "override_reason_required": True,
    }
