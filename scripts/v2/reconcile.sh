#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
require_cmd date
ensure_backend_env

SOURCE_PATH="${V2_RECONCILE_SOURCE_PATH:-${ROOT_DIR}/data/surveillance.db}"
SOURCE_ROOT="${V2_RECONCILE_SOURCE_ROOT:-${ROOT_DIR}}"
APPLY_MODE="false"
OUTPUT_DIR="${V2_RECONCILE_OUTPUT_DIR:-}"
deps_started="false"

print_usage() {
  cat <<'EOF'
Usage:
  ./scripts/v2/reconcile.sh [options]

Options:
  --source <path>      Legacy SQLite path for backfill/reconcile
  --source-root <dir>  Source root for resolving legacy relative files
  --apply              Run reconcile in apply mode (default is dry-run)
  --output-dir <dir>   Override output directory (default: data/reconcile-logs/<run_id>)
  --help               Show this message
EOF
}

cleanup() {
  set +e
  if [[ "${deps_started}" == "true" ]]; then
    make v2-deps-down >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_PATH="$2"
      shift 2
      ;;
    --source-root)
      SOURCE_ROOT="$2"
      shift 2
      ;;
    --apply)
      APPLY_MODE="true"
      shift
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --help)
      print_usage
      exit 0
      ;;
    *)
      echo "[v2-reconcile] unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

timestamp="$(date +%Y%m%d-%H%M%S)"
run_id="${V2_RUN_ID:-$(build_run_id "reconcile" "${timestamp}")}"
git_sha="$(git_current_sha)"
branch="$(git_current_branch)"
git_dirty="$(git_is_dirty)"
environment="$(resolve_v2_environment)"
if [[ -z "${OUTPUT_DIR}" ]]; then
  OUTPUT_DIR="${ROOT_DIR}/data/reconcile-logs/${run_id}"
fi
mkdir -p "${OUTPUT_DIR}"

started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
backfill_json="${OUTPUT_DIR}/backfill-report.json"
summary_json="${OUTPUT_DIR}/summary.json"
summary_md="${OUTPUT_DIR}/summary.md"

backfill_args=(--source "${SOURCE_PATH}" --source-root "${SOURCE_ROOT}")
if [[ "${APPLY_MODE}" == "true" ]]; then
  backfill_args+=(--apply)
fi

echo "[v2-reconcile] output dir: ${OUTPUT_DIR}"
echo "[v2-reconcile] run_id: ${run_id}"
make v2-deps-up >/dev/null
deps_started="true"
./scripts/v2/backfill.sh "${backfill_args[@]}" >"${backfill_json}"
require_readable_file "${backfill_json}" "reconcile backfill report"
finished_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

RUN_ID="${run_id}" \
GIT_SHA="${git_sha}" \
BRANCH="${branch}" \
GIT_DIRTY="${git_dirty}" \
STARTED_AT="${started_at}" \
FINISHED_AT="${finished_at}" \
ENVIRONMENT="${environment}" \
SOURCE_PATH_VALUE="${SOURCE_PATH}" \
SOURCE_ROOT_VALUE="${SOURCE_ROOT}" \
APPLY_MODE_VALUE="${APPLY_MODE}" \
BACKFILL_JSON="${backfill_json}" \
SUMMARY_JSON="${summary_json}" \
SUMMARY_MD="${summary_md}" \
python3 - <<'PY'
import json
import os
import sys
from pathlib import Path

backfill_json = Path(os.environ["BACKFILL_JSON"])
summary_json = Path(os.environ["SUMMARY_JSON"])
summary_md = Path(os.environ["SUMMARY_MD"])

report = json.loads(backfill_json.read_text(encoding="utf-8"))
missing_files = report.get("missing_files") or []
warnings = report.get("warnings") or []
result = "failed" if missing_files else "passed"

summary = {
    "run_id": os.environ["RUN_ID"],
    "git_sha": os.environ["GIT_SHA"],
    "branch": os.environ["BRANCH"],
    "git_dirty": os.environ["GIT_DIRTY"] == "true",
    "started_at": os.environ["STARTED_AT"],
    "finished_at": os.environ["FINISHED_AT"],
    "environment": os.environ["ENVIRONMENT"],
    "result": result,
    "parameter_summary": {
        "source": os.environ["SOURCE_PATH_VALUE"],
        "source_root": os.environ["SOURCE_ROOT_VALUE"],
        "apply_mode": os.environ["APPLY_MODE_VALUE"] == "true",
    },
    "backfill_report_path": str(backfill_json),
    "dry_run": bool(report.get("dry_run", True)),
    "warning_count": len(warnings),
    "missing_file_count": len(missing_files),
    "source_counts": report.get("source_counts") or {},
    "target_counts_before": report.get("target_counts_before") or {},
    "target_counts_after": report.get("target_counts_after") or {},
    "warnings": warnings,
    "missing_files": missing_files,
}
summary_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

lines = [
    "# 智能巡检系统 V2 对账摘要",
    "",
    f"- 结果: **{summary['result'].upper()}**",
    f"- run_id: {summary['run_id']}",
    f"- 干跑模式: {summary['dry_run']}",
    f"- 缺失文件数: {summary['missing_file_count']}",
    f"- warning 数: {summary['warning_count']}",
    "",
    f"- backfill report: {summary['backfill_report_path']}",
]
summary_md.write_text("\n".join(lines), encoding="utf-8")
print(f"[v2-reconcile] summary: {summary_json}")
print(f"[v2-reconcile] markdown: {summary_md}")
if result != "passed":
    print("[v2-reconcile] failed due to missing files:")
    for path in missing_files:
        print(f" - {path}")
    sys.exit(1)
PY

echo "[v2-reconcile] completed"
