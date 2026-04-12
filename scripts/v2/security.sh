#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
require_cmd npm
require_cmd pytest
require_cmd date
require_cmd tee
ensure_backend_env

OUTPUT_DIR="${V2_SECURITY_OUTPUT_DIR:-}"

print_usage() {
  cat <<'EOF'
Usage:
  ./scripts/v2/security.sh [options]

Options:
  --output-dir <dir>  Override output directory (default: data/security-logs/<run_id>)
  --help              Show this message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --help)
      print_usage
      exit 0
      ;;
    *)
      echo "[v2-security] unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

timestamp="$(date +%Y%m%d-%H%M%S)"
run_id="${V2_RUN_ID:-$(build_run_id "security" "${timestamp}")}"
git_sha="$(git_current_sha)"
branch="$(git_current_branch)"
git_dirty="$(git_is_dirty)"
environment="$(resolve_v2_environment)"
if [[ -z "${OUTPUT_DIR}" ]]; then
  OUTPUT_DIR="${ROOT_DIR}/data/security-logs/${run_id}"
fi
mkdir -p "${OUTPUT_DIR}"

started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
frontend_audit_log="${OUTPUT_DIR}/frontend-npm-audit.log"
backend_dependency_log="${OUTPUT_DIR}/backend-pip-check.log"
authz_test_log="${OUTPUT_DIR}/authz-tests.log"
summary_json="${OUTPUT_DIR}/summary.json"
summary_md="${OUTPUT_DIR}/summary.md"
backend_dependency_raw_log="${OUTPUT_DIR}/backend-pip-check.raw.log"

frontend_audit_status="skipped"
backend_dependency_status="skipped"
authz_test_status="skipped"
overall_status="passed"

normalize_backend_dependency_check() {
  local raw_log="$1"
  local normalized_log="$2"
  python3 - "$raw_log" "$normalized_log" <<'PY'
from pathlib import Path
import sys

raw_log = Path(sys.argv[1])
normalized_log = Path(sys.argv[2])
ignored_suffix = " is not supported on this platform"
lines = [line.rstrip("\n") for line in raw_log.read_text(encoding="utf-8").splitlines()]
actionable_lines = [line for line in lines if line and not line.endswith(ignored_suffix)]
output_lines = actionable_lines if actionable_lines else [line for line in lines if line]
normalized_log.write_text(
    ("\n".join(output_lines) + "\n") if output_lines else "",
    encoding="utf-8",
)
sys.exit(1 if actionable_lines else 0)
PY
}

echo "[v2-security] output dir: ${OUTPUT_DIR}"
echo "[v2-security] run_id: ${run_id}"

if (
  cd "${FRONTEND_DIR}"
  npm audit --omit=dev --audit-level=high --json
) >"${frontend_audit_log}" 2>&1; then
  frontend_audit_status="passed"
else
  frontend_audit_status="failed"
  overall_status="failed"
fi

if python3 -m pip check >"${backend_dependency_raw_log}" 2>&1; then
  backend_dependency_status="passed"
  cp "${backend_dependency_raw_log}" "${backend_dependency_log}"
else
  if normalize_backend_dependency_check "${backend_dependency_raw_log}" "${backend_dependency_log}"; then
    backend_dependency_status="passed"
  else
    backend_dependency_status="failed"
    overall_status="failed"
  fi
fi

if (
  cd "${ROOT_DIR}"
  PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest \
    backend-v2/tests/test_auth_and_users.py \
    -q
) | tee "${authz_test_log}"; then
  authz_test_status="passed"
else
  authz_test_status="failed"
  overall_status="failed"
fi

finished_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

RUN_ID="${run_id}" \
GIT_SHA="${git_sha}" \
BRANCH="${branch}" \
GIT_DIRTY="${git_dirty}" \
STARTED_AT="${started_at}" \
FINISHED_AT="${finished_at}" \
ENVIRONMENT="${environment}" \
OVERALL_STATUS="${overall_status}" \
OUTPUT_DIR="${OUTPUT_DIR}" \
SUMMARY_JSON="${summary_json}" \
SUMMARY_MD="${summary_md}" \
FRONTEND_AUDIT_STATUS="${frontend_audit_status}" \
FRONTEND_AUDIT_LOG="${frontend_audit_log}" \
BACKEND_DEPENDENCY_STATUS="${backend_dependency_status}" \
BACKEND_DEPENDENCY_LOG="${backend_dependency_log}" \
AUTHZ_TEST_STATUS="${authz_test_status}" \
AUTHZ_TEST_LOG="${authz_test_log}" \
python3 - <<'PY'
import json
import os
from pathlib import Path

summary = {
    "run_id": os.environ["RUN_ID"],
    "git_sha": os.environ["GIT_SHA"],
    "branch": os.environ["BRANCH"],
    "git_dirty": os.environ["GIT_DIRTY"] == "true",
    "started_at": os.environ["STARTED_AT"],
    "finished_at": os.environ["FINISHED_AT"],
    "environment": os.environ["ENVIRONMENT"],
    "result": os.environ["OVERALL_STATUS"],
    "parameter_summary": {
        "frontend_audit_command": "npm audit --omit=dev --audit-level=high --json",
        "backend_dependency_command": "python3 -m pip check",
        "authz_test_command": "PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest backend-v2/tests/test_auth_and_users.py -q",
    },
    "checks": {
        "frontend_dependency_audit": {
            "status": os.environ["FRONTEND_AUDIT_STATUS"],
            "log_path": os.environ["FRONTEND_AUDIT_LOG"],
        },
        "backend_dependency_check": {
            "status": os.environ["BACKEND_DEPENDENCY_STATUS"],
            "log_path": os.environ["BACKEND_DEPENDENCY_LOG"],
        },
        "authz_regression": {
            "status": os.environ["AUTHZ_TEST_STATUS"],
            "log_path": os.environ["AUTHZ_TEST_LOG"],
        },
    },
}
summary_json = Path(os.environ["SUMMARY_JSON"])
summary_md = Path(os.environ["SUMMARY_MD"])
output_dir = Path(os.environ["OUTPUT_DIR"]).resolve()
summary_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

lines = [
    "# 智能巡检系统 V2 安全验证摘要",
    "",
    f"- 结果: **{summary['result'].upper()}**",
    f"- run_id: {summary['run_id']}",
    f"- 输出目录: {output_dir}",
    "",
    "| 检查项 | 状态 | 日志 |",
    "| --- | --- | --- |",
]
for check_name, payload in summary["checks"].items():
    lines.append(f"| {check_name} | {payload['status']} | {payload['log_path']} |")
summary_md.write_text("\n".join(lines), encoding="utf-8")
PY

echo "[v2-security] summary: ${summary_json}"
echo "[v2-security] markdown: ${summary_md}"
if [[ "${overall_status}" != "passed" ]]; then
  echo "[v2-security] failed, review logs under ${OUTPUT_DIR}" >&2
  exit 1
fi
echo "[v2-security] all checks passed"
