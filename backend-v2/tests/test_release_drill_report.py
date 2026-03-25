from app.services.release_drill_report_service import (
    build_release_drill_report,
    render_release_drill_markdown,
)


def test_build_release_drill_report_passes_with_preflight_green_and_no_missing_files():
    preflight_summary = {
        "result": "passed",
        "checks": {
            "smoke": {"status": "passed"},
            "perf": {"status": "passed"},
            "soak": {"status": "passed"},
            "e2e": {"status": "passed"},
        },
    }
    backfill_report = {
        "dry_run": True,
        "source_counts": {"cameras": 2, "rules": 3},
        "target_counts_before": {"cameras": 1},
        "target_counts_after": {"cameras": 3},
        "entity_stats": {"cameras": {"created": 2, "updated": 0, "skipped": 0}},
        "warnings": [],
        "missing_files": [],
    }

    report = build_release_drill_report(
        preflight_summary_path="/tmp/preflight-summary.json",
        preflight_summary=preflight_summary,
        backfill_report_path="/tmp/backfill.json",
        backfill_report=backfill_report,
    )

    assert report.gate_status == "passed"
    assert report.blocking_issues == []
    assert report.preflight_checks["smoke"] == "passed"
    assert report.preflight_checks["e2e"] == "passed"
    assert report.missing_file_count == 0
    assert any("dry-run mode" in item for item in report.risks)


def test_build_release_drill_report_fails_when_required_checks_or_files_are_blocking():
    preflight_summary = {
        "result": "failed",
        "checks": {
            "smoke": {"status": "failed"},
            "perf": {"status": "passed"},
            "soak": {"status": "passed"},
            "e2e": {"status": "failed"},
        },
    }
    backfill_report = {
        "dry_run": False,
        "warnings": ["legacy work_orders skipped"],
        "missing_files": ["missing/image-1.jpg", "missing/image-2.jpg"],
    }

    report = build_release_drill_report(
        preflight_summary_path="/tmp/preflight-summary.json",
        preflight_summary=preflight_summary,
        backfill_report_path="/tmp/backfill.json",
        backfill_report=backfill_report,
    )

    assert report.gate_status == "failed"
    assert report.warning_count == 1
    assert report.missing_file_count == 2
    assert any("Preflight result is failed" in issue for issue in report.blocking_issues)
    assert any("smoke" in issue for issue in report.blocking_issues)
    assert any("E2E check failed" in issue for issue in report.blocking_issues)
    assert any("missing files" in issue for issue in report.blocking_issues)


def test_render_release_drill_markdown_contains_core_sections():
    report = build_release_drill_report(
        preflight_summary_path="/tmp/preflight-summary.json",
        preflight_summary={
            "result": "passed",
            "checks": {
                "smoke": {"status": "passed"},
                "perf": {"status": "passed"},
                "soak": {"status": "passed"},
                "e2e": {"status": "skipped"},
            },
        },
        backfill_report_path="/tmp/backfill.json",
        backfill_report={
            "dry_run": True,
            "source_counts": {"cameras": 1},
            "warnings": [],
            "missing_files": [],
        },
    )

    markdown = render_release_drill_markdown(report, title="测试演练报告")
    assert "# 测试演练报告" in markdown
    assert "## 1. Preflight 检查" in markdown
    assert "| smoke | passed |" in markdown
    assert "## 4. 标准回滚步骤" in markdown
    assert "流量切回 legacy 入口" in markdown


def test_release_drill_report_ignores_expected_work_order_warning_in_risk():
    report = build_release_drill_report(
        preflight_summary_path="/tmp/preflight-summary.json",
        preflight_summary={
            "result": "passed",
            "checks": {
                "smoke": {"status": "passed"},
                "perf": {"status": "passed"},
                "soak": {"status": "passed"},
                "e2e": {"status": "passed"},
            },
        },
        backfill_report_path="/tmp/backfill.json",
        backfill_report={
            "dry_run": False,
            "warnings": [
                "Skipped 2 legacy work_orders from core migration; keep them in the legacy database."
            ],
            "missing_files": [],
        },
    )

    assert report.gate_status == "passed"
    assert report.warning_count == 1
    assert report.risks == []


def test_release_drill_report_keeps_unexpected_warning_as_risk():
    report = build_release_drill_report(
        preflight_summary_path="/tmp/preflight-summary.json",
        preflight_summary={
            "result": "passed",
            "checks": {
                "smoke": {"status": "passed"},
                "perf": {"status": "passed"},
                "soak": {"status": "passed"},
                "e2e": {"status": "passed"},
            },
        },
        backfill_report_path="/tmp/backfill.json",
        backfill_report={
            "dry_run": False,
            "warnings": ["camera mapping conflicted with existing records"],
            "missing_files": [],
        },
    )

    assert report.gate_status == "passed"
    assert report.warning_count == 1
    assert any("unexpected warning" in item for item in report.risks)
