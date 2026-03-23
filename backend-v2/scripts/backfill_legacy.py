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

from app.core.database import SessionLocal, init_database
from app.services.bootstrap import seed_defaults
from app.services.legacy_backfill_service import run_legacy_backfill


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill legacy SQLite data into Smart Inspection V2.")
    parser.add_argument(
        "--source",
        default=str(ROOT_DIR / "data" / "surveillance.db"),
        help="Path to the legacy SQLite database file.",
    )
    parser.add_argument(
        "--source-root",
        default=str(ROOT_DIR),
        help="Root directory used to resolve legacy relative file paths.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist migrated data to the target V2 database. Default is dry-run.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    init_database()
    with SessionLocal() as db:
        seed_defaults(db)
        report = run_legacy_backfill(
            db,
            source_path=args.source,
            source_root=args.source_root,
            dry_run=not args.apply,
        )

    print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
