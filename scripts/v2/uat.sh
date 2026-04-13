#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
require_cmd pytest
require_cmd npm
require_cmd make
require_cmd date
require_cmd tee
require_cmd grep
require_cmd tail
require_cmd sed

WITH_RELEASE_DRILL="false"
RELEASE_DRILL_WITH_E2E="false"
RELEASE_DRILL_APPLY_BACKFILL="false"
OUTPUT_DIR="${V2_UAT_OUTPUT_DIR:-}"

print_usage() {
  cat <<'EOF'
Usage:
  ./scripts/v2/uat.sh [options]

Options:
  --with-release-drill      Run v2-release-drill after baseline checks
  --release-drill-with-e2e  If release drill is enabled, include E2E in preflight
  --release-drill-apply-backfill  If release drill is enabled, run backfill in apply mode
  --output-dir <dir>        Override output directory (default: data/uat-logs/<run_id>)
  --help                    Show this message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-release-drill)
      WITH_RELEASE_DRILL="true"
      shift
      ;;
    --release-drill-with-e2e)
      RELEASE_DRILL_WITH_E2E="true"
      shift
      ;;
    --release-drill-apply-backfill)
      RELEASE_DRILL_APPLY_BACKFILL="true"
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
      echo "[v2-uat] unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

timestamp="$(date +%Y%m%d-%H%M%S)"
run_id="${V2_RUN_ID:-$(build_run_id "uat" "${timestamp}")}"
git_sha="$(git_current_sha)"
branch="$(git_current_branch)"
git_dirty="$(git_is_dirty)"
environment="$(resolve_v2_environment)"
if [[ -z "${OUTPUT_DIR}" ]]; then
  OUTPUT_DIR="${ROOT_DIR}/data/uat-logs/${run_id}"
fi
mkdir -p "${OUTPUT_DIR}"
started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

backend_log="${OUTPUT_DIR}/backend-pytest.log"
frontend_lint_log="${OUTPUT_DIR}/frontend-lint.log"
frontend_unit_log="${OUTPUT_DIR}/frontend-unit.log"
frontend_build_log="${OUTPUT_DIR}/frontend-build.log"
e2e_log="${OUTPUT_DIR}/e2e.log"
security_log="${OUTPUT_DIR}/security.log"
reconcile_log="${OUTPUT_DIR}/reconcile.log"
release_drill_log="${OUTPUT_DIR}/release-drill.log"
summary_json="${OUTPUT_DIR}/summary.json"
summary_md="${OUTPUT_DIR}/summary.md"

backend_status="skipped"
frontend_lint_status="skipped"
frontend_unit_status="skipped"
frontend_build_status="skipped"
e2e_status="skipped"
security_status="skipped"
reconcile_status="skipped"
release_drill_status="skipped"
release_drill_report=""
security_summary_path=""
reconcile_summary_path=""

echo "[v2-uat] output dir: ${OUTPUT_DIR}"
echo "[v2-uat] run_id: ${run_id}"

if (
  cd "${BACKEND_DIR}"
  pytest -q
) | tee "${backend_log}"; then
  backend_status="passed"
else
  backend_status="failed"
fi

if (
  cd "${FRONTEND_DIR}"
  npm run lint
) | tee "${frontend_lint_log}"; then
  frontend_lint_status="passed"
else
  frontend_lint_status="failed"
fi

if (
  cd "${FRONTEND_DIR}"
  npm run test
) | tee "${frontend_unit_log}"; then
  frontend_unit_status="passed"
else
  frontend_unit_status="failed"
fi

if (
  cd "${FRONTEND_DIR}"
  npm run build
) | tee "${frontend_build_log}"; then
  frontend_build_status="passed"
else
  frontend_build_status="failed"
fi

if ./scripts/v2/e2e-entrypoint.sh | tee "${e2e_log}"; then
  e2e_status="passed"
else
  e2e_status="failed"
fi

if ./scripts/v2/security.sh --output-dir "${OUTPUT_DIR}/security" | tee "${security_log}"; then
  security_status="passed"
else
  security_status="failed"
fi
security_summary_path="${OUTPUT_DIR}/security/summary.json"
if ! require_readable_file "${security_summary_path}" "security summary"; then
  security_status="failed"
fi

if ./scripts/v2/reconcile.sh --output-dir "${OUTPUT_DIR}/reconcile" | tee "${reconcile_log}"; then
  reconcile_status="passed"
else
  reconcile_status="failed"
fi
reconcile_summary_path="${OUTPUT_DIR}/reconcile/summary.json"
if ! require_readable_file "${reconcile_summary_path}" "reconcile summary"; then
  reconcile_status="failed"
fi

if [[ "${WITH_RELEASE_DRILL}" == "true" ]]; then
  release_drill_args=()
  if [[ "${RELEASE_DRILL_WITH_E2E}" == "true" ]]; then
    release_drill_args+=(--with-e2e)
  fi
  if [[ "${RELEASE_DRILL_APPLY_BACKFILL}" == "true" ]]; then
    release_drill_args+=(--apply-backfill)
  fi
  release_drill_args+=(--output-dir "${OUTPUT_DIR}/release-drill")
  if ./scripts/v2/release-drill.sh "${release_drill_args[@]}" | tee "${release_drill_log}"; then
    release_drill_status="passed"
  else
    release_drill_status="failed"
  fi
  release_drill_report="${OUTPUT_DIR}/release-drill/release-drill-report.json"
  if [[ ! -r "${release_drill_report}" ]]; then
    release_drill_status="failed"
    release_drill_report=""
  fi
fi

overall_status="passed"
if [[ "${backend_status}" != "passed" || "${frontend_lint_status}" != "passed" || "${frontend_unit_status}" != "passed" || "${frontend_build_status}" != "passed" || "${e2e_status}" != "passed" || "${security_status}" != "passed" || "${reconcile_status}" != "passed" ]]; then
  overall_status="failed"
fi
if [[ "${WITH_RELEASE_DRILL}" == "true" && "${release_drill_status}" != "passed" ]]; then
  overall_status="failed"
fi
finished_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

python3 - <<PY
import json
from pathlib import Path

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
        "with_release_drill": "${WITH_RELEASE_DRILL}" == "true",
        "release_drill_with_e2e": "${RELEASE_DRILL_WITH_E2E}" == "true",
        "release_drill_apply_backfill": "${RELEASE_DRILL_APPLY_BACKFILL}" == "true",
        "output_dir": "${OUTPUT_DIR}",
    },
    "checks": {
        "backend_pytest": {"status": "${backend_status}", "log_path": "${backend_log}"},
        "frontend_lint": {"status": "${frontend_lint_status}", "log_path": "${frontend_lint_log}"},
        "frontend_unit": {"status": "${frontend_unit_status}", "log_path": "${frontend_unit_log}"},
        "frontend_build": {"status": "${frontend_build_status}", "log_path": "${frontend_build_log}"},
        "e2e": {"status": "${e2e_status}", "log_path": "${e2e_log}"},
        "security": {"status": "${security_status}", "log_path": "${security_log}", "summary_path": "${security_summary_path}"},
        "reconcile": {"status": "${reconcile_status}", "log_path": "${reconcile_log}", "summary_path": "${reconcile_summary_path}"},
        "release_drill": {
            "status": "${release_drill_status}",
            "log_path": "${release_drill_log}" if "${WITH_RELEASE_DRILL}" == "true" else None,
            "report_path": "${release_drill_report}" or None,
        },
    },
}
Path("${summary_json}").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

lines = [
    "# 智能巡检系统 V2 UAT 验收摘要",
    "",
    f"- 结果: **{summary['result'].upper()}**",
    f"- 输出目录: {summary['output_dir']}",
    "",
    "| 检查项 | 状态 | 日志 |",
    "| --- | --- | --- |",
]
for check_name in ("backend_pytest", "frontend_lint", "frontend_unit", "frontend_build", "e2e", "security", "reconcile", "release_drill"):
    check = summary["checks"][check_name]
    log_path = check.get("log_path") or "-"
    lines.append(f"| {check_name} | {check['status']} | {log_path} |")

release_drill_report = summary["checks"]["release_drill"].get("report_path")
if release_drill_report:
    lines.extend(["", f"- release drill report: {release_drill_report}"])

Path("${summary_md}").write_text("\\n".join(lines), encoding="utf-8")
PY

echo "[v2-uat] summary: ${summary_json}"
echo "[v2-uat] markdown: ${summary_md}"
if [[ "${overall_status}" != "passed" ]]; then
  echo "[v2-uat] failed, review logs under ${OUTPUT_DIR}" >&2
  exit 1
fi
echo "[v2-uat] all checks passed"
