#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
require_cmd date

UAT_SUMMARY_PATH="${V2_RELEASE_CHECKLIST_UAT_SUMMARY_PATH:-}"
RELEASE_DRILL_REPORT_PATH="${V2_RELEASE_CHECKLIST_DRILL_REPORT_PATH:-}"
ALLOW_WITHOUT_RELEASE_DRILL="false"
REQUIRE_DRILL_APPLY_BACKFILL="false"
OUTPUT_DIR="${V2_RELEASE_CHECKLIST_OUTPUT_DIR:-}"

print_usage() {
  cat <<'EOF'
Usage:
  ./scripts/v2/release-checklist.sh [options]

Options:
  --uat-summary <path>            Explicit UAT summary.json path
  --release-drill-report <path>   Explicit release drill report JSON path
  --allow-without-release-drill   Allow generating checklist without release drill report
  --require-drill-apply-backfill  Require release drill to use non-dry-run backfill apply mode
  --output-dir <dir>              Output directory (default: data/release-checklists/<timestamp>)
  --help                          Show this message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --uat-summary)
      UAT_SUMMARY_PATH="$2"
      shift 2
      ;;
    --release-drill-report)
      RELEASE_DRILL_REPORT_PATH="$2"
      shift 2
      ;;
    --allow-without-release-drill)
      ALLOW_WITHOUT_RELEASE_DRILL="true"
      shift
      ;;
    --require-drill-apply-backfill)
      REQUIRE_DRILL_APPLY_BACKFILL="true"
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
      echo "[v2-release-checklist] unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "${UAT_SUMMARY_PATH}" ]]; then
  echo "[v2-release-checklist] UAT summary is required, pass --uat-summary explicitly" >&2
  exit 2
fi
if [[ -z "${RELEASE_DRILL_REPORT_PATH}" && "${ALLOW_WITHOUT_RELEASE_DRILL}" != "true" ]]; then
  echo "[v2-release-checklist] release drill report is required unless --allow-without-release-drill is set" >&2
  exit 2
fi
require_readable_file "${UAT_SUMMARY_PATH}" "UAT summary"
if [[ -n "${RELEASE_DRILL_REPORT_PATH}" ]]; then
  require_readable_file "${RELEASE_DRILL_REPORT_PATH}" "release drill report"
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
if [[ -z "${OUTPUT_DIR}" ]]; then
  OUTPUT_DIR="${ROOT_DIR}/data/release-checklists/${timestamp}"
fi
mkdir -p "${OUTPUT_DIR}"

checklist_json="${OUTPUT_DIR}/release-checklist.json"
checklist_md="${OUTPUT_DIR}/release-checklist.md"

cmd=(
  python3 "${BACKEND_DIR}/scripts/build_release_checklist.py"
  --uat-summary "${UAT_SUMMARY_PATH}"
  --output "${checklist_json}"
  --markdown-output "${checklist_md}"
)
if [[ -n "${RELEASE_DRILL_REPORT_PATH}" ]]; then
  cmd+=(--release-drill-report "${RELEASE_DRILL_REPORT_PATH}")
fi
if [[ "${ALLOW_WITHOUT_RELEASE_DRILL}" == "true" ]]; then
  cmd+=(--allow-without-release-drill)
fi
if [[ "${REQUIRE_DRILL_APPLY_BACKFILL}" == "true" ]]; then
  cmd+=(--require-drill-apply-backfill)
fi

"${cmd[@]}"

echo "[v2-release-checklist] uat summary: ${UAT_SUMMARY_PATH}"
echo "[v2-release-checklist] release drill report: ${RELEASE_DRILL_REPORT_PATH:-N/A}"
echo "[v2-release-checklist] checklist json: ${checklist_json}"
echo "[v2-release-checklist] checklist markdown: ${checklist_md}"
