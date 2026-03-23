#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import init_database
from app.services.bootstrap import seed_defaults
from app.services.model_evaluation_service import (
    build_migration_decisions,
    build_targets,
    evaluate_model_targets,
    load_decision_policy,
    load_pricing_table,
    save_evaluation_markdown_report,
    save_evaluation_report,
)
from app.core.database import SessionLocal


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate OpenAI/Zhipu vision models on a local dataset.")
    parser.add_argument(
        "--dataset",
        default=str(BACKEND_DIR / "data" / "model_eval_dataset.example.json"),
        help="Path to evaluation dataset JSON.",
    )
    parser.add_argument(
        "--target",
        action="append",
        default=[],
        help="Target provider/model in provider:model format. Can be repeated.",
    )
    parser.add_argument(
        "--repeats",
        type=int,
        default=1,
        help="How many repeated runs to execute per sample and target.",
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=2,
        help="Maximum concurrent evaluation workers.",
    )
    parser.add_argument(
        "--pricing",
        default=None,
        help="Optional pricing JSON file for estimated cost calculation.",
    )
    parser.add_argument(
        "--decision-policy",
        default=None,
        help="Optional decision policy JSON for migration recommendation.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional output path for the generated JSON report.",
    )
    parser.add_argument(
        "--markdown-output",
        default=None,
        help="Optional output path for the generated Markdown report.",
    )
    parser.add_argument(
        "--report-title",
        default="智能巡检系统 V2 模型评估报告",
        help="Markdown report title when --markdown-output is provided.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.repeats <= 0:
        raise SystemExit("--repeats must be greater than 0")
    if args.max_workers <= 0:
        raise SystemExit("--max-workers must be greater than 0")

    init_database()
    with SessionLocal() as db:
        seed_defaults(db)

    targets = build_targets(args.target)
    if not targets:
        raise SystemExit("No active targets available. Pass --target provider:model or activate providers in DB.")

    pricing_table = load_pricing_table(args.pricing)
    report = evaluate_model_targets(
        dataset_path=args.dataset,
        targets=targets,
        repeats=args.repeats,
        max_workers=args.max_workers,
        pricing_table=pricing_table,
    )
    report.pricing_path = str(Path(args.pricing).expanduser().resolve()) if args.pricing else None
    if args.decision_policy:
        decision_policy = load_decision_policy(args.decision_policy)
        report.decisions = build_migration_decisions(report, decision_policy)

    payload = {"summary": report.to_dict()["summaries"]}
    if report.decisions:
        payload["decisions"] = report.to_dict()["decisions"]
    if args.output:
        output_path = save_evaluation_report(report, args.output)
        payload["report_path"] = str(output_path)
    if args.markdown_output:
        markdown_path = save_evaluation_markdown_report(report, args.markdown_output, title=args.report_title)
        payload["markdown_report_path"] = str(markdown_path)

    if args.output or args.markdown_output:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
