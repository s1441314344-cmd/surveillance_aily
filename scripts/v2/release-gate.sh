#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
require_cmd date
require_cmd tee
ensure_backend_env

RUN_UAT="true"
WITH_RELEASE_DRILL="true"
RELEASE_DRILL_WITH_E2E="true"
RELEASE_DRILL_APPLY_BACKFILL="false"
ALLOW_WITHOUT_RELEASE_DRILL="false"
REQUIRE_DRILL_APPLY_BACKFILL="false"
OVERRIDE_REASON="${V2_RELEASE_GATE_OVERRIDE_REASON:-}"

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
  --override-reason <text>      Required when using any bypass/override flag
  --uat-summary <path>          Explicit UAT summary path
  --release-drill-report <path> Explicit release drill report path
  --output-dir <dir>            Output directory (default: data/release-gates/<run_id>)
  --help                        Show this message
EOF
}

override_flags=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-uat)
      RUN_UAT="false"
      override_flags+=("--skip-uat")
      shift
      ;;
    --without-release-drill)
      WITH_RELEASE_DRILL="false"
      RELEASE_DRILL_WITH_E2E="false"
      ALLOW_WITHOUT_RELEASE_DRILL="true"
      override_flags+=("--without-release-drill")
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
      override_flags+=("--allow-without-release-drill")
      shift
      ;;
    --override-reason)
      OVERRIDE_REASON="$2"
      shift 2
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
run_id="${V2_RUN_ID:-$(build_run_id "release-gate" "${timestamp}")}"
git_sha="$(git_current_sha)"
branch="$(git_current_branch)"
git_dirty="$(git_is_dirty)"
environment="$(resolve_v2_environment)"
if [[ -z "${OUTPUT_DIR}" ]]; then
  OUTPUT_DIR="${ROOT_DIR}/data/release-gates/${run_id}"
fi
mkdir -p "${OUTPUT_DIR}"
started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

uat_log="${OUTPUT_DIR}/uat.log"
checklist_log="${OUTPUT_DIR}/release-checklist.log"
gate_summary_json="${OUTPUT_DIR}/gate-summary.json"
uat_output_dir="${OUTPUT_DIR}/uat"
checklist_output_dir="${OUTPUT_DIR}/checklist"
override_flags_csv="${override_flags[*]:-}"
override_active="false"
if (( ${#override_flags[@]} > 0 )); then
  override_active="true"
fi

if (( ${#override_flags[@]} > 0 )) && [[ -z "${OVERRIDE_REASON}" ]]; then
  echo "[v2-release-gate] override flags require --override-reason: ${override_flags[*]}" >&2
  exit 2
fi
if [[ "${RUN_UAT}" != "true" && -z "${UAT_SUMMARY_PATH}" ]]; then
  echo "[v2-release-gate] --skip-uat requires explicit --uat-summary" >&2
  exit 2
fi
if [[ "${ALLOW_WITHOUT_RELEASE_DRILL}" != "true" && "${WITH_RELEASE_DRILL}" != "true" && -z "${RELEASE_DRILL_REPORT_PATH}" ]]; then
  echo "[v2-release-gate] missing release drill report; pass --release-drill-report or keep release drill enabled" >&2
  exit 2
fi

if [[ "${RUN_UAT}" == "true" ]]; then
  echo "[v2-release-gate] running UAT"
  uat_args=(--output-dir "${uat_output_dir}")
  if [[ "${WITH_RELEASE_DRILL}" == "true" ]]; then
    uat_args+=(--with-release-drill)
    if [[ "${RELEASE_DRILL_WITH_E2E}" == "true" ]]; then
      uat_args+=(--release-drill-with-e2e)
    fi
    if [[ "${RELEASE_DRILL_APPLY_BACKFILL}" == "true" ]]; then
      uat_args+=(--release-drill-apply-backfill)
    fi
  fi
  if ./scripts/v2/uat.sh "${uat_args[@]}" | tee "${uat_log}"; then
    :
  else
    echo "[v2-release-gate] UAT failed; continue to assemble gate summary" >&2
  fi
  UAT_SUMMARY_PATH="${uat_output_dir}/summary.json"
  if [[ "${WITH_RELEASE_DRILL}" == "true" ]]; then
    RELEASE_DRILL_REPORT_PATH="${uat_output_dir}/release-drill/release-drill-report.json"
  fi
else
  echo "[v2-release-gate] skipping UAT"
fi

if [[ -z "${UAT_SUMMARY_PATH}" ]]; then
  echo "[v2-release-gate] UAT summary not found, pass --uat-summary explicitly" >&2
  exit 2
fi
require_readable_file "${UAT_SUMMARY_PATH}" "UAT summary"
if [[ -n "${RELEASE_DRILL_REPORT_PATH}" ]]; then
  require_readable_file "${RELEASE_DRILL_REPORT_PATH}" "release drill report"
fi

echo "[v2-release-gate] building release checklist"
checklist_args=(--uat-summary "${UAT_SUMMARY_PATH}" --output-dir "${checklist_output_dir}")
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

checklist_json="${checklist_output_dir}/release-checklist.json"
if [[ ! -f "${checklist_json}" ]]; then
  echo "[v2-release-gate] checklist json not found: ${checklist_json}" >&2
  exit 2
fi
finished_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

python3 - <<PY
import json
import sys
from pathlib import Path

checklist_path = Path("${checklist_json}")
checklist = json.loads(checklist_path.read_text(encoding="utf-8"))
ready = bool(checklist.get("ready_to_release"))
summary = {
    "run_id": "${run_id}",
    "git_sha": "${git_sha}",
    "branch": "${branch}",
    "git_dirty": "${git_dirty}" == "true",
    "started_at": "${started_at}",
    "finished_at": "${finished_at}",
    "environment": "${environment}",
    "ready_to_release": ready,
    "result": "passed" if ready else "failed",
    "parameter_summary": {
        "run_uat": "${RUN_UAT}" == "true",
        "with_release_drill": "${WITH_RELEASE_DRILL}" == "true",
        "release_drill_with_e2e": "${RELEASE_DRILL_WITH_E2E}" == "true",
        "release_drill_apply_backfill": "${RELEASE_DRILL_APPLY_BACKFILL}" == "true",
        "allow_without_release_drill": "${ALLOW_WITHOUT_RELEASE_DRILL}" == "true",
        "require_drill_apply_backfill": "${REQUIRE_DRILL_APPLY_BACKFILL}" == "true",
    },
    "override": {
        "active": "${override_active}" == "true",
        "flags": [item for item in "${override_flags_csv}".split() if item],
        "reason": "${OVERRIDE_REASON}" or None,
    },
    "release_policy": {
        "default_entrypoint": "make v2-release-gate-final",
        "bypass_run": "${override_active}" == "true",
        "override_reason_required": True,
    },
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
