from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path


REQUIRED_UAT_CHECKS = (
    "backend_pytest",
    "frontend_lint",
    "frontend_unit",
    "frontend_build",
    "e2e",
    "security",
    "reconcile",
)
UAT_CHECKLIST_REPORT_ITEMS = (*REQUIRED_UAT_CHECKS, "release_drill")


@dataclass
class ReleaseChecklist:
    generated_at: str
    uat_summary_path: str
    release_drill_report_path: str | None
    uat_result: str
    uat_checks: dict[str, str]
    release_drill_gate: str
    release_drill_result: str
    ready_to_release: bool
    blockers: list[str]
    notes: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


def build_release_checklist(
    *,
    uat_summary_path: str | Path,
    uat_summary: dict,
    release_drill_report_path: str | Path | None = None,
    release_drill_report: dict | None = None,
    allow_without_release_drill: bool = False,
    require_release_drill_apply_backfill: bool = False,
) -> ReleaseChecklist:
    blockers: list[str] = []
    notes: list[str] = []

    uat_result = str(uat_summary.get("result") or "unknown")
    uat_checks_payload = uat_summary.get("checks") or {}
    uat_checks = {
        check_name: str((uat_checks_payload.get(check_name) or {}).get("status") or "missing")
        for check_name in UAT_CHECKLIST_REPORT_ITEMS
    }

    if uat_result != "passed":
        blockers.append(f"UAT result is {uat_result}.")

    for check_name in REQUIRED_UAT_CHECKS:
        if uat_checks.get(check_name) != "passed":
            blockers.append(f"UAT check `{check_name}` is {uat_checks.get(check_name)}.")

    release_drill_gate = "missing"
    release_drill_result = "missing"
    resolved_release_drill_path: str | None = None

    if release_drill_report is not None and release_drill_report_path is not None:
        resolved_release_drill_path = str(Path(release_drill_report_path).expanduser().resolve())
        release_drill_gate = str(release_drill_report.get("gate_status") or "missing")
        release_drill_result = str(release_drill_report.get("preflight_result") or "missing")
        if release_drill_gate != "passed":
            blockers.append(f"Release drill gate status is {release_drill_gate}.")
        if release_drill_result != "passed":
            blockers.append(f"Release drill preflight result is {release_drill_result}.")

        for issue in release_drill_report.get("blocking_issues") or []:
            blockers.append(f"Release drill blocking issue: {issue}")

        if require_release_drill_apply_backfill:
            if bool(release_drill_report.get("backfill_dry_run", True)):
                blockers.append(
                    "Release drill backfill is still dry-run; rerun with apply mode before final release."
                )

        for risk in release_drill_report.get("risks") or []:
            notes.append(f"Release drill risk: {risk}")
    elif allow_without_release_drill:
        notes.append("Release drill report is missing; allowed by --allow-without-release-drill.")
    else:
        blockers.append("Release drill report is missing.")

    ready_to_release = not blockers

    return ReleaseChecklist(
        generated_at=datetime.now(timezone.utc).isoformat(),
        uat_summary_path=str(Path(uat_summary_path).expanduser().resolve()),
        release_drill_report_path=resolved_release_drill_path,
        uat_result=uat_result,
        uat_checks=uat_checks,
        release_drill_gate=release_drill_gate,
        release_drill_result=release_drill_result,
        ready_to_release=ready_to_release,
        blockers=blockers,
        notes=notes,
    )


def save_release_checklist(checklist: ReleaseChecklist, output_path: str | Path) -> Path:
    path = Path(output_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(checklist.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def render_release_checklist_markdown(
    checklist: ReleaseChecklist, *, title: str = "智能巡检系统 V2 发布清单"
) -> str:
    lines = [
        f"# {title}",
        "",
        f"- 生成时间（UTC）: {checklist.generated_at}",
        f"- 就绪结论: **{'READY' if checklist.ready_to_release else 'BLOCKED'}**",
        f"- UAT 摘要: `{checklist.uat_summary_path}`",
        f"- Release Drill 报告: `{checklist.release_drill_report_path or 'N/A'}`",
        "",
        "## 1. 验收检查项",
        "",
        f"- UAT 结果: `{checklist.uat_result}`",
        f"- Release Drill Gate: `{checklist.release_drill_gate}`",
        f"- Release Drill Result: `{checklist.release_drill_result}`",
        "",
        "| 检查项 | 状态 |",
        "| --- | --- |",
    ]

    for check_name in UAT_CHECKLIST_REPORT_ITEMS:
        lines.append(f"| {check_name} | {checklist.uat_checks.get(check_name, 'missing')} |")

    lines.extend(["", "## 2. 阻断项", ""])
    if checklist.blockers:
        for item in checklist.blockers:
            lines.append(f"- {item}")
    else:
        lines.append("- None")

    lines.extend(["", "## 3. 注意事项", ""])
    if checklist.notes:
        for item in checklist.notes:
            lines.append(f"- {item}")
    else:
        lines.append("- None")

    lines.extend(
        [
            "",
            "## 4. 发布步骤（建议）",
            "",
            "1. 核对 UAT 与 release drill 均通过。",
            "2. 冻结变更并备份配置。",
            "3. 发布 V2 服务并执行 smoke。",
            "4. 观察关键指标与错误日志。",
            "5. 若异常，按 release drill 报告中的回滚步骤执行。",
        ]
    )
    return "\n".join(lines)


def save_release_checklist_markdown(
    checklist: ReleaseChecklist,
    output_path: str | Path,
    *,
    title: str = "智能巡检系统 V2 发布清单",
) -> Path:
    path = Path(output_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_release_checklist_markdown(checklist, title=title), encoding="utf-8")
    return path
