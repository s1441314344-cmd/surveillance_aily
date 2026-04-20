from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

REQUIRED_PREFLIGHT_CHECKS = ("smoke", "perf", "soak")
EXPECTED_BACKFILL_WARNING_PATTERNS = (
    "legacy work_orders",
)


@dataclass
class ReleaseDrillReport:
    generated_at: str
    preflight_summary_path: str
    preflight_result: str
    preflight_checks: dict[str, str]
    preflight_scheduler_cycle: dict[str, object] | None
    backfill_report_path: str
    backfill_dry_run: bool
    source_counts: dict[str, int]
    target_counts_before: dict[str, int]
    target_counts_after: dict[str, int]
    entity_stats: dict[str, dict[str, int]]
    warning_count: int
    missing_file_count: int
    warnings: list[str]
    missing_files: list[str]
    blocking_issues: list[str]
    risks: list[str]
    gate_status: str

    def to_dict(self) -> dict:
        return asdict(self)


def build_release_drill_report(
    *,
    preflight_summary_path: str | Path,
    preflight_summary: dict,
    backfill_report_path: str | Path,
    backfill_report: dict,
) -> ReleaseDrillReport:
    checks_payload = preflight_summary.get("checks") or {}
    preflight_checks = {
        check_name: str((checks_payload.get(check_name) or {}).get("status") or "missing")
        for check_name in ("smoke", "perf", "soak", "e2e")
    }

    blocking_issues: list[str] = []
    risks: list[str] = []

    preflight_result = str(preflight_summary.get("result") or "unknown")
    if preflight_result != "passed":
        blocking_issues.append(f"Preflight result is {preflight_result}.")

    for check_name in REQUIRED_PREFLIGHT_CHECKS:
        if preflight_checks.get(check_name) != "passed":
            blocking_issues.append(f"Required preflight check `{check_name}` is {preflight_checks.get(check_name)}.")

    if preflight_checks.get("e2e") == "failed":
        blocking_issues.append("E2E check failed.")
    elif preflight_checks.get("e2e") in {"missing", "skipped"}:
        risks.append("E2E check is skipped; execute `make v2-e2e` before production cutover.")

    preflight_scheduler_cycle = _normalize_scheduler_cycle(preflight_summary.get("scheduler_cycle"))
    if preflight_scheduler_cycle is not None:
        observed_count = int(preflight_scheduler_cycle.get("observed_count", 0))
        latest_payload = preflight_scheduler_cycle.get("latest")
        if observed_count <= 0:
            risks.append("Scheduler cycle metrics are not observed in preflight logs; validate scheduler visibility.")
        if isinstance(latest_payload, dict):
            error_count = _safe_int(latest_payload.get("errors"), default=0)
            stale_recovered = _safe_int(latest_payload.get("stale_recovered"), default=0)
            if error_count > 0:
                blocking_issues.append(f"Scheduler cycle reported errors={error_count} during preflight.")
            if stale_recovered > 0:
                risks.append(
                    f"Scheduler cycle recovered stale in-flight jobs {stale_recovered} time(s); inspect queue latency."
                )

    warnings = list(backfill_report.get("warnings") or [])
    missing_files = list(backfill_report.get("missing_files") or [])
    warning_count = len(warnings)
    missing_file_count = len(missing_files)

    if missing_file_count > 0:
        blocking_issues.append(
            f"Backfill detected {missing_file_count} missing files; reconcile source storage before cutover."
        )
    unexpected_warnings = [item for item in warnings if not _is_expected_backfill_warning(item)]
    if unexpected_warnings:
        risks.append(f"Backfill produced {len(unexpected_warnings)} unexpected warning(s); manual review required.")

    backfill_dry_run = bool(backfill_report.get("dry_run", True))
    if backfill_dry_run:
        risks.append("Backfill ran in dry-run mode; final apply + reconciliation are still pending.")

    gate_status = "passed" if not blocking_issues else "failed"

    return ReleaseDrillReport(
        generated_at=datetime.now(timezone.utc).isoformat(),
        preflight_summary_path=str(Path(preflight_summary_path).expanduser().resolve()),
        preflight_result=preflight_result,
        preflight_checks=preflight_checks,
        preflight_scheduler_cycle=preflight_scheduler_cycle,
        backfill_report_path=str(Path(backfill_report_path).expanduser().resolve()),
        backfill_dry_run=backfill_dry_run,
        source_counts={k: int(v) for k, v in (backfill_report.get("source_counts") or {}).items()},
        target_counts_before={
            k: int(v) for k, v in (backfill_report.get("target_counts_before") or {}).items()
        },
        target_counts_after={
            k: int(v) for k, v in (backfill_report.get("target_counts_after") or {}).items()
        },
        entity_stats={
            k: {
                "created": int((v or {}).get("created", 0)),
                "updated": int((v or {}).get("updated", 0)),
                "skipped": int((v or {}).get("skipped", 0)),
            }
            for k, v in (backfill_report.get("entity_stats") or {}).items()
        },
        warning_count=warning_count,
        missing_file_count=missing_file_count,
        warnings=warnings,
        missing_files=missing_files,
        blocking_issues=blocking_issues,
        risks=risks,
        gate_status=gate_status,
    )


def _is_expected_backfill_warning(message: str) -> bool:
    normalized = message.lower()
    return any(pattern in normalized for pattern in EXPECTED_BACKFILL_WARNING_PATTERNS)


def _safe_int(value, *, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_scheduler_cycle(raw_payload: object) -> dict[str, object] | None:
    if not isinstance(raw_payload, dict):
        return None
    observed_count = _safe_int(raw_payload.get("observed_count"), default=0)
    latest = raw_payload.get("latest")
    normalized_latest = latest if isinstance(latest, dict) else None
    return {
        "observed_count": max(observed_count, 0),
        "latest": normalized_latest,
    }


def save_release_drill_report(report: ReleaseDrillReport, output_path: str | Path) -> Path:
    path = Path(output_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def render_release_drill_markdown(report: ReleaseDrillReport, *, title: str = "智能巡检系统 V2 上线演练报告") -> str:
    lines = [
        f"# {title}",
        "",
        f"- 生成时间（UTC）: {report.generated_at}",
        f"- 演练结论: **{report.gate_status.upper()}**",
        "",
        "## 1. Preflight 检查",
        "",
        f"- 结果: `{report.preflight_result}`",
        f"- 摘要文件: `{report.preflight_summary_path}`",
        "",
        "| 检查项 | 状态 |",
        "| --- | --- |",
    ]
    for check_name in ("smoke", "perf", "soak", "e2e"):
        lines.append(f"| {check_name} | {report.preflight_checks.get(check_name, 'missing')} |")

    if report.preflight_scheduler_cycle is not None:
        latest_payload = report.preflight_scheduler_cycle.get("latest")
        lines.extend(
            [
                "",
                "### Scheduler Cycle 指标",
                "",
                f"- 观测次数: `{report.preflight_scheduler_cycle.get('observed_count', 0)}`",
                f"- 最新周期: `{json.dumps(latest_payload, ensure_ascii=False) if isinstance(latest_payload, dict) else '-'}`",
            ]
        )

    lines.extend(
        [
            "",
            "## 2. 历史数据回填",
            "",
            f"- 回填报告: `{report.backfill_report_path}`",
            f"- 执行模式: `{'apply' if not report.backfill_dry_run else 'dry-run'}`",
            f"- 警告数: `{report.warning_count}`",
            f"- 缺失文件数: `{report.missing_file_count}`",
            "",
            "### Source Counts",
            "",
            "| 对象 | 数量 |",
            "| --- | --- |",
        ]
    )

    if report.source_counts:
        for key, value in sorted(report.source_counts.items()):
            lines.append(f"| {key} | {value} |")
    else:
        lines.append("| (none) | 0 |")

    lines.extend(
        [
            "",
            "## 3. 风险与阻断",
            "",
        ]
    )

    if report.blocking_issues:
        lines.append("### Blocking Issues")
        for issue in report.blocking_issues:
            lines.append(f"- {issue}")
    else:
        lines.append("### Blocking Issues")
        lines.append("- None")

    if report.risks:
        lines.append("")
        lines.append("### Risks")
        for risk in report.risks:
            lines.append(f"- {risk}")
    else:
        lines.append("")
        lines.append("### Risks")
        lines.append("- None")

    lines.extend(
        [
            "",
            "## 4. 标准回滚步骤",
            "",
            "1. 停止 V2 API / worker / scheduler 新写入。",
            "2. 流量切回 legacy 入口，并确认 legacy 健康检查通过。",
            "3. 恢复上一版配置与镜像版本，执行 smoke 验证。",
            "4. 保留 V2 数据库现场，不做覆盖写入，等待问题复盘。",
        ]
    )
    return "\n".join(lines)


def save_release_drill_markdown(
    report: ReleaseDrillReport,
    output_path: str | Path,
    *,
    title: str = "智能巡检系统 V2 上线演练报告",
) -> Path:
    path = Path(output_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_release_drill_markdown(report, title=title), encoding="utf-8")
    return path
