#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
require_cmd date
require_cmd tee
ensure_backend_env

RUN_PRECHECK="true"
RUN_PREFLIGHT="true"
RUN_UAT="true"
PREFLIGHT_WITH_E2E="false"
OUTPUT_DIR="${V2_VERIFY_OUTPUT_DIR:-}"

print_usage() {
  cat <<'EOF'
Usage:
  ./scripts/v2/verify.sh [options]

Options:
  --skip-precheck          Skip backend/frontend unit test stage
  --skip-preflight         Skip integration preflight stage
  --skip-uat               Skip final UAT stage
  --preflight-with-e2e     Include E2E in preflight stage
  --output-dir <dir>       Output directory (default: data/verify-logs/<run_id>)
  --help                   Show this message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-precheck)
      RUN_PRECHECK="false"
      shift
      ;;
    --skip-preflight)
      RUN_PREFLIGHT="false"
      shift
      ;;
    --skip-uat)
      RUN_UAT="false"
      shift
      ;;
    --preflight-with-e2e)
      PREFLIGHT_WITH_E2E="true"
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
      echo "[v2-verify] unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

timestamp="$(date +%Y%m%d-%H%M%S)"
run_id="${V2_RUN_ID:-$(build_run_id "verify" "${timestamp}")}"
git_sha="$(git_current_sha)"
branch="$(git_current_branch)"
git_dirty="$(git_is_dirty)"
environment="$(resolve_v2_environment)"
if [[ -z "${OUTPUT_DIR}" ]]; then
  OUTPUT_DIR="${ROOT_DIR}/data/verify-logs/${run_id}"
fi
mkdir -p "${OUTPUT_DIR}"
started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

precheck_backend_status="skipped"
precheck_frontend_status="skipped"
preflight_status="skipped"
uat_status="skipped"
overall_status="passed"

backend_test_log="${OUTPUT_DIR}/backend-test.log"
frontend_test_log="${OUTPUT_DIR}/frontend-test.log"
preflight_log="${OUTPUT_DIR}/preflight.log"
uat_log="${OUTPUT_DIR}/uat.log"
summary_json="${OUTPUT_DIR}/summary.json"
summary_md="${OUTPUT_DIR}/summary.md"

preflight_summary_path=""
uat_summary_path=""
preflight_output_dir="${OUTPUT_DIR}/preflight"
uat_output_dir="${OUTPUT_DIR}/uat"

if [[ "${RUN_PRECHECK}" == "true" ]]; then
  echo "[v2-verify] stage 1/3: precheck (backend unit tests)"
  if make v2-backend-test | tee "${backend_test_log}"; then
    precheck_backend_status="passed"
  else
    precheck_backend_status="failed"
    overall_status="failed"
  fi

  echo "[v2-verify] stage 1/3: precheck (frontend unit tests)"
  if make v2-frontend-test | tee "${frontend_test_log}"; then
    precheck_frontend_status="passed"
  else
    precheck_frontend_status="failed"
    overall_status="failed"
  fi
fi

if [[ "${RUN_PREFLIGHT}" == "true" ]]; then
  echo "[v2-verify] stage 2/3: integration preflight"
  preflight_args=()
  if [[ "${PREFLIGHT_WITH_E2E}" == "true" ]]; then
    preflight_args+=(--with-e2e)
  fi
  preflight_args+=(--output-dir "${preflight_output_dir}")
  if ./scripts/v2/preflight.sh "${preflight_args[@]}" | tee "${preflight_log}"; then
    preflight_status="passed"
  else
    preflight_status="failed"
    overall_status="failed"
  fi
  preflight_summary_path="${preflight_output_dir}/summary.json"
  if ! require_readable_file "${preflight_summary_path}" "preflight summary"; then
    preflight_status="failed"
    overall_status="failed"
  fi
fi

if [[ "${RUN_UAT}" == "true" ]]; then
  echo "[v2-verify] stage 3/3: final UAT"
  if ./scripts/v2/uat.sh --output-dir "${uat_output_dir}" | tee "${uat_log}"; then
    uat_status="passed"
  else
    uat_status="failed"
    overall_status="failed"
  fi
  uat_summary_path="${uat_output_dir}/summary.json"
  if ! require_readable_file "${uat_summary_path}" "uat summary"; then
    uat_status="failed"
    overall_status="failed"
  fi
fi

finished_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

python3 - <<PY
import json
from pathlib import Path

preflight_scheduler_cycle = None
if "${preflight_summary_path}":
    preflight_path = Path("${preflight_summary_path}")
    if preflight_path.exists():
        try:
            preflight_data = json.loads(preflight_path.read_text(encoding="utf-8"))
            preflight_scheduler_cycle = preflight_data.get("scheduler_cycle")
        except Exception:
            preflight_scheduler_cycle = None

summary = {
    "run_id": "${run_id}",
    "git_sha": "${git_sha}",
    "branch": "${branch}",
    "git_dirty": "${git_dirty}" == "true",
    "started_at": "${started_at}",
    "finished_at": "${finished_at}",
    "environment": "${environment}",
    "result": "${overall_status}",
    "output_dir": "${OUTPUT_DIR}",
    "parameter_summary": {
        "run_precheck": "${RUN_PRECHECK}" == "true",
        "run_preflight": "${RUN_PREFLIGHT}" == "true",
        "run_uat": "${RUN_UAT}" == "true",
        "preflight_with_e2e": "${PREFLIGHT_WITH_E2E}" == "true",
    },
    "stages": {
        "precheck_backend_unit": {
            "status": "${precheck_backend_status}",
            "log_path": "${backend_test_log}" if "${RUN_PRECHECK}" == "true" else None,
        },
        "precheck_frontend_unit": {
            "status": "${precheck_frontend_status}",
            "log_path": "${frontend_test_log}" if "${RUN_PRECHECK}" == "true" else None,
        },
        "integration_preflight": {
            "status": "${preflight_status}",
            "log_path": "${preflight_log}" if "${RUN_PREFLIGHT}" == "true" else None,
            "summary_path": "${preflight_summary_path}" or None,
        },
        "final_uat": {
            "status": "${uat_status}",
            "log_path": "${uat_log}" if "${RUN_UAT}" == "true" else None,
            "summary_path": "${uat_summary_path}" or None,
        },
    },
    "preflight_scheduler_cycle": preflight_scheduler_cycle,
}
Path("${summary_json}").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

lines = [
    "# 智能巡检系统 V2 验证流水线摘要",
    "",
    f"- 结果: **{summary['result'].upper()}**",
    f"- 输出目录: {summary['output_dir']}",
    "",
    "| 阶段 | 状态 | 日志 | 摘要 |",
    "| --- | --- | --- | --- |",
]
for stage_name in ("precheck_backend_unit", "precheck_frontend_unit", "integration_preflight", "final_uat"):
    stage = summary["stages"][stage_name]
    lines.append(
        f"| {stage_name} | {stage['status']} | {stage.get('log_path') or '-'} | {stage.get('summary_path') or '-'} |"
    )
cycle = summary.get("preflight_scheduler_cycle")
if isinstance(cycle, dict):
    latest = cycle.get("latest") or {}
    lines.extend(
        [
            "",
            "- preflight scheduler cycle metrics:",
            f"  - observed_count: {cycle.get('observed_count', 0)}",
            f"  - latest: {latest if latest else '-'}",
        ]
    )
Path("${summary_md}").write_text("\\n".join(lines), encoding="utf-8")
PY

echo "[v2-verify] summary: ${summary_json}"
echo "[v2-verify] markdown: ${summary_md}"
if [[ "${overall_status}" != "passed" ]]; then
  echo "[v2-verify] failed, check logs under ${OUTPUT_DIR}" >&2
  exit 1
fi
echo "[v2-verify] all stages passed"
