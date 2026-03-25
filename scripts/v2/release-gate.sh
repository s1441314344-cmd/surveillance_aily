#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
require_cmd find
require_cmd sort
require_cmd tail
require_cmd date
require_cmd tee
ensure_backend_env

RUN_UAT="true"
WITH_RELEASE_DRILL="true"
RELEASE_DRILL_WITH_E2E="true"
RELEASE_DRILL_APPLY_BACKFILL="false"
ALLOW_WITHOUT_RELEASE_DRILL="false"
REQUIRE_DRILL_APPLY_BACKFILL="false"

UAT_SUMMARY_PATH="${V2_RELEASE_GATE_UAT_SUMMARY_PATH:-}"
RELEASE_DRILL_REPORT_PATH="${V2_RELEASE_GATE_DRILL_REPORT_PATH:-}"
OUTPUT_DIR="${V2_RELEASE_GATE_OUTPUT_DIR:-}"

print_usage() {
  cat <<'EOF'
Usage:
  ./scripts/v2/release-gate.sh [options]

Options:
  --skip-uat                    Skip running UAT; require existing summary artifacts
  --without-release-drill       Run UAT without release drill
  --without-drill-e2e           Keep release drill but skip e2e in preflight
  --release-drill-apply-backfill Run release drill backfill in apply mode
  --require-drill-apply-backfill Block final checklist when release drill is dry-run
  --allow-without-release-drill Allow checklist generation without release drill report
  --uat-summary <path>          Explicit UAT summary path
  --release-drill-report <path> Explicit release drill report path
  --output-dir <dir>            Output directory (default: data/release-gates/<timestamp>)
  --help                        Show this message
EOF
}

find_latest_file() {
  local root="$1"
  local filename="$2"
  if [[ ! -d "${root}" ]]; then
    return 1
  fi
  find "${root}" -type f -name "${filename}" -print 2>/dev/null | sort | tail -1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-uat)
      RUN_UAT="false"
      shift
      ;;
    --without-release-drill)
      WITH_RELEASE_DRILL="false"
      RELEASE_DRILL_WITH_E2E="false"
      shift
      ;;
    --without-drill-e2e)
      RELEASE_DRILL_WITH_E2E="false"
      shift
      ;;
    --release-drill-apply-backfill)
      RELEASE_DRILL_APPLY_BACKFILL="true"
      shift
      ;;
    --require-drill-apply-backfill)
      REQUIRE_DRILL_APPLY_BACKFILL="true"
      shift
      ;;
    --allow-without-release-drill)
      ALLOW_WITHOUT_RELEASE_DRILL="true"
      shift
      ;;
    --uat-summary)
      UAT_SUMMARY_PATH="$2"
      shift 2
      ;;
    --release-drill-report)
      RELEASE_DRILL_REPORT_PATH="$2"
      shift 2
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
      echo "[v2-release-gate] unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

timestamp="$(date +%Y%m%d-%H%M%S)"
if [[ -z "${OUTPUT_DIR}" ]]; then
  OUTPUT_DIR="${ROOT_DIR}/data/release-gates/${timestamp}"
fi
mkdir -p "${OUTPUT_DIR}"

uat_log="${OUTPUT_DIR}/uat.log"
checklist_log="${OUTPUT_DIR}/release-checklist.log"
gate_summary_json="${OUTPUT_DIR}/gate-summary.json"

if [[ "${RUN_UAT}" == "true" ]]; then
  echo "[v2-release-gate] running UAT"
  uat_args=(--output-dir "${OUTPUT_DIR}/uat")
  if [[ "${WITH_RELEASE_DRILL}" == "true" ]]; then
    uat_args+=(--with-release-drill)
    if [[ "${RELEASE_DRILL_WITH_E2E}" == "true" ]]; then
      uat_args+=(--release-drill-with-e2e)
    fi
    if [[ "${RELEASE_DRILL_APPLY_BACKFILL}" == "true" ]]; then
      uat_args+=(--release-drill-apply-backfill)
    fi
  fi
  ./scripts/v2/uat.sh "${uat_args[@]}" | tee "${uat_log}"
  UAT_SUMMARY_PATH="${OUTPUT_DIR}/uat/summary.json"

  if [[ -z "${RELEASE_DRILL_REPORT_PATH}" && -f "${UAT_SUMMARY_PATH}" ]]; then
    RELEASE_DRILL_REPORT_PATH="$(python3 - <<PY
import json
from pathlib import Path
path = Path("${UAT_SUMMARY_PATH}")
payload = json.loads(path.read_text(encoding="utf-8"))
print((payload.get("checks", {}).get("release_drill", {}).get("report_path")) or "")
PY
)"
  fi
else
  echo "[v2-release-gate] skipping UAT"
fi

if [[ -z "${UAT_SUMMARY_PATH}" ]]; then
  UAT_SUMMARY_PATH="$(find_latest_file "${ROOT_DIR}/data/uat-logs" "summary.json" || true)"
fi
if [[ -z "${RELEASE_DRILL_REPORT_PATH}" ]]; then
  RELEASE_DRILL_REPORT_PATH="$(find_latest_file "${ROOT_DIR}/data/release-drill-logs" "release-drill-report.json" || true)"
fi

if [[ -z "${UAT_SUMMARY_PATH}" ]]; then
  echo "[v2-release-gate] UAT summary not found, run make v2-uat or pass --uat-summary" >&2
  exit 2
fi

echo "[v2-release-gate] building release checklist"
checklist_args=(--uat-summary "${UAT_SUMMARY_PATH}" --output-dir "${OUTPUT_DIR}/checklist")
if [[ -n "${RELEASE_DRILL_REPORT_PATH}" ]]; then
  checklist_args+=(--release-drill-report "${RELEASE_DRILL_REPORT_PATH}")
fi
if [[ "${ALLOW_WITHOUT_RELEASE_DRILL}" == "true" ]]; then
  checklist_args+=(--allow-without-release-drill)
fi
if [[ "${REQUIRE_DRILL_APPLY_BACKFILL}" == "true" ]]; then
  checklist_args+=(--require-drill-apply-backfill)
fi
./scripts/v2/release-checklist.sh "${checklist_args[@]}" | tee "${checklist_log}"

checklist_json="${OUTPUT_DIR}/checklist/release-checklist.json"
if [[ ! -f "${checklist_json}" ]]; then
  echo "[v2-release-gate] checklist json not found: ${checklist_json}" >&2
  exit 2
fi

python3 - <<PY
import json
import sys
from pathlib import Path

checklist_path = Path("${checklist_json}")
checklist = json.loads(checklist_path.read_text(encoding="utf-8"))
ready = bool(checklist.get("ready_to_release"))
summary = {
    "ready_to_release": ready,
    "uat_summary_path": "${UAT_SUMMARY_PATH}",
    "release_drill_report_path": "${RELEASE_DRILL_REPORT_PATH}" or None,
    "checklist_path": str(checklist_path),
    "blockers": checklist.get("blockers", []),
    "notes": checklist.get("notes", []),
}
Path("${gate_summary_json}").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"[v2-release-gate] summary: ${gate_summary_json}")
if not ready:
    print("[v2-release-gate] blocked:")
    for item in checklist.get("blockers", []):
        print(f" - {item}")
    sys.exit(1)
print("[v2-release-gate] ready_to_release = true")
PY

echo "[v2-release-gate] done"
