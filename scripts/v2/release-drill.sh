#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
require_cmd grep
require_cmd tee
ensure_backend_env

WITH_E2E="false"
API_PORT="${V2_RELEASE_DRILL_API_PORT:-5810}"
SOURCE_PATH="${V2_RELEASE_DRILL_SOURCE_PATH:-${ROOT_DIR}/data/surveillance.db}"
SOURCE_ROOT="${V2_RELEASE_DRILL_SOURCE_ROOT:-${ROOT_DIR}}"
APPLY_BACKFILL="false"
OUTPUT_DIR="${V2_RELEASE_DRILL_OUTPUT_DIR:-}"
backfill_deps_started="false"

print_usage() {
  cat <<'EOF'
Usage:
  ./scripts/v2/release-drill.sh [options]

Options:
  --with-e2e          Include E2E in preflight checks
  --api-port <port>   API port used by preflight (default: 5810)
  --source <path>     Legacy SQLite path for backfill
  --source-root <dir> Source root for legacy relative files
  --apply-backfill    Persist backfill data (default is dry-run)
  --output-dir <dir>  Override release drill output directory
  --help              Show this message
EOF
}

cleanup() {
  set +e
  if [[ "${backfill_deps_started}" == "true" ]]; then
    make v2-deps-down >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help)
      print_usage
      exit 0
      ;;
    --with-e2e)
      WITH_E2E="true"
      shift
      ;;
    --api-port)
      API_PORT="$2"
      shift 2
      ;;
    --source)
      SOURCE_PATH="$2"
      shift 2
      ;;
    --source-root)
      SOURCE_ROOT="$2"
      shift 2
      ;;
    --apply-backfill)
      APPLY_BACKFILL="true"
      shift
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    *)
      echo "[v2-release-drill] unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

timestamp="$(date +%Y%m%d-%H%M%S)"
if [[ -z "${OUTPUT_DIR}" ]]; then
  OUTPUT_DIR="${ROOT_DIR}/data/release-drill-logs/${timestamp}"
fi

mkdir -p "${OUTPUT_DIR}"
preflight_log="${OUTPUT_DIR}/preflight.log"
backfill_json="${OUTPUT_DIR}/backfill.json"
report_json="${OUTPUT_DIR}/release-drill-report.json"
report_md="${OUTPUT_DIR}/release-drill-report.md"

echo "[v2-release-drill] output dir: ${OUTPUT_DIR}"
echo "[v2-release-drill] running preflight"
preflight_args=(--api-port "${API_PORT}")
if [[ "${WITH_E2E}" == "true" ]]; then
  preflight_args+=(--with-e2e)
fi
./scripts/v2/preflight.sh "${preflight_args[@]}" | tee "${preflight_log}"

preflight_summary_path="$(grep -E '^\[v2-preflight\] summary:' "${preflight_log}" | tail -1 | sed 's/^\[v2-preflight\] summary: //')"
if [[ -z "${preflight_summary_path}" || ! -f "${preflight_summary_path}" ]]; then
  echo "[v2-release-drill] failed to locate preflight summary from ${preflight_log}" >&2
  exit 2
fi

echo "[v2-release-drill] running backfill (${APPLY_BACKFILL})"
backfill_args=(--source "${SOURCE_PATH}" --source-root "${SOURCE_ROOT}")
if [[ "${APPLY_BACKFILL}" == "true" ]]; then
  backfill_args+=(--apply)
fi
make v2-deps-up >/dev/null
backfill_deps_started="true"
./scripts/v2/backfill.sh "${backfill_args[@]}" >"${backfill_json}"

echo "[v2-release-drill] building drill report"
python3 "${BACKEND_DIR}/scripts/build_release_drill_report.py" \
  --preflight-summary "${preflight_summary_path}" \
  --backfill-report "${backfill_json}" \
  --output "${report_json}" \
  --markdown-output "${report_md}"

python3 - <<PY
import json
import sys
from pathlib import Path

report = json.loads(Path("${report_json}").read_text(encoding="utf-8"))
gate_status = report.get("gate_status")
print(f"[v2-release-drill] gate status: {gate_status}")
if gate_status != "passed":
    print("[v2-release-drill] blocking issues:")
    for issue in report.get("blocking_issues", []):
        print(f" - {issue}")
    sys.exit(1)
PY

echo "[v2-release-drill] completed"
echo "[v2-release-drill] preflight summary: ${preflight_summary_path}"
echo "[v2-release-drill] backfill report: ${backfill_json}"
echo "[v2-release-drill] release drill report: ${report_json}"
echo "[v2-release-drill] release drill markdown: ${report_md}"
