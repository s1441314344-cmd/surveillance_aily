from app.services.release_checklist_service import (
    build_release_checklist,
    render_release_checklist_markdown,
)


def test_release_checklist_ready_when_uat_and_drill_passed():
    checklist = build_release_checklist(
        uat_summary_path="/tmp/uat-summary.json",
        uat_summary={
            "result": "passed",
            "checks": {
                "backend_pytest": {"status": "passed"},
                "frontend_lint": {"status": "passed"},
                "frontend_unit": {"status": "passed"},
                "frontend_build": {"status": "passed"},
                "e2e": {"status": "passed"},
            },
        },
        release_drill_report_path="/tmp/release-drill-report.json",
        release_drill_report={
            "gate_status": "passed",
            "preflight_result": "passed",
            "blocking_issues": [],
            "risks": ["dry-run only"],
        },
    )

    assert checklist.ready_to_release is True
    assert checklist.blockers == []
    assert checklist.release_drill_gate == "passed"
    assert any("dry-run only" in item for item in checklist.notes)


def test_release_checklist_blocked_when_required_check_fails():
    checklist = build_release_checklist(
        uat_summary_path="/tmp/uat-summary.json",
        uat_summary={
            "result": "failed",
            "checks": {
                "backend_pytest": {"status": "passed"},
                "frontend_lint": {"status": "failed"},
                "frontend_unit": {"status": "passed"},
                "frontend_build": {"status": "passed"},
                "e2e": {"status": "passed"},
            },
        },
        release_drill_report_path="/tmp/release-drill-report.json",
        release_drill_report={
            "gate_status": "failed",
            "preflight_result": "failed",
            "blocking_issues": ["smoke failed"],
            "risks": [],
        },
    )

    assert checklist.ready_to_release is False
    assert any("UAT result is failed" in item for item in checklist.blockers)
    assert any("frontend_lint" in item for item in checklist.blockers)
    assert any("Release drill gate status is failed" in item for item in checklist.blockers)
    assert any("smoke failed" in item for item in checklist.blockers)


def test_release_checklist_allow_without_release_drill():
    checklist = build_release_checklist(
        uat_summary_path="/tmp/uat-summary.json",
        uat_summary={
            "result": "passed",
            "checks": {
                "backend_pytest": {"status": "passed"},
                "frontend_lint": {"status": "passed"},
                "frontend_unit": {"status": "passed"},
                "frontend_build": {"status": "passed"},
                "e2e": {"status": "passed"},
            },
        },
        allow_without_release_drill=True,
    )

    assert checklist.ready_to_release is True
    assert checklist.release_drill_gate == "missing"
    assert checklist.release_drill_report_path is None
    assert any("allowed by --allow-without-release-drill" in item for item in checklist.notes)


def test_release_checklist_markdown_contains_sections():
    checklist = build_release_checklist(
        uat_summary_path="/tmp/uat-summary.json",
        uat_summary={
            "result": "passed",
            "checks": {
                "backend_pytest": {"status": "passed"},
                "frontend_lint": {"status": "passed"},
                "frontend_unit": {"status": "passed"},
                "frontend_build": {"status": "passed"},
                "e2e": {"status": "passed"},
            },
        },
        allow_without_release_drill=True,
    )
    markdown = render_release_checklist_markdown(checklist, title="测试发布清单")
    assert "# 测试发布清单" in markdown
    assert "## 1. 验收检查项" in markdown
    assert "| backend_pytest | passed |" in markdown
    assert "## 4. 发布步骤（建议）" in markdown


def test_release_checklist_blocks_when_backfill_apply_is_required_but_dry_run():
    checklist = build_release_checklist(
        uat_summary_path="/tmp/uat-summary.json",
        uat_summary={
            "result": "passed",
            "checks": {
                "backend_pytest": {"status": "passed"},
                "frontend_lint": {"status": "passed"},
                "frontend_unit": {"status": "passed"},
                "frontend_build": {"status": "passed"},
                "e2e": {"status": "passed"},
            },
        },
        release_drill_report_path="/tmp/release-drill-report.json",
        release_drill_report={
            "gate_status": "passed",
            "preflight_result": "passed",
            "backfill_dry_run": True,
            "blocking_issues": [],
            "risks": [],
        },
        require_release_drill_apply_backfill=True,
    )

    assert checklist.ready_to_release is False
    assert any("dry-run" in item for item in checklist.blockers)
