#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import SessionLocal, init_database
from app.services.bootstrap import seed_defaults
from app.services.camera_validation_service import (
    load_camera_validation_manifest,
    save_camera_validation_markdown_report,
    save_camera_validation_report,
    validate_camera_manifest,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate a batch camera whitelist manifest for Smart Inspection V2.")
    parser.add_argument(
        "--manifest",
        required=True,
        help="Path to the camera whitelist manifest JSON.",
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=2,
        help="Maximum concurrent validation workers.",
    )
    parser.add_argument(
        "--no-save-snapshot",
        action="store_true",
        help="Do not save diagnostic snapshots.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional JSON report output path.",
    )
    parser.add_argument(
        "--markdown-output",
        default=None,
        help="Optional Markdown report output path.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.max_workers <= 0:
        raise SystemExit("--max-workers must be greater than 0")

    _, targets = load_camera_validation_manifest(args.manifest)
    requires_database = any(target.camera_id for target in targets)
    if requires_database:
        init_database()
        with SessionLocal() as db:
            seed_defaults(db)

    report = validate_camera_manifest(
        manifest_path=args.manifest,
        max_workers=args.max_workers,
        save_snapshot=not args.no_save_snapshot,
    )
    payload = {"summary": report.to_dict()["summary"]}
    if args.output:
        output_path = save_camera_validation_report(report, args.output)
        payload["report_path"] = str(output_path)
    if args.markdown_output:
        markdown_path = save_camera_validation_markdown_report(report, args.markdown_output)
        payload["markdown_report_path"] = str(markdown_path)

    if args.output or args.markdown_output:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))

    return 0 if report.summary.expectation_passed_count == report.summary.total_targets else 1


if __name__ == "__main__":
    raise SystemExit(main())
