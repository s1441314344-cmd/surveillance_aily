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

frontend_audit_status="skipped"
backend_dependency_status="skipped"
authz_test_status="skipped"
overall_status="passed"

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

if python3 -m pip check >"${backend_dependency_log}" 2>&1; then
  backend_dependency_status="passed"
else
  backend_dependency_status="failed"
  overall_status="failed"
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
    "parameter_summary": {
        "frontend_audit_command": "npm audit --omit=dev --audit-level=high --json",
        "backend_dependency_command": "python3 -m pip check",
        "authz_test_command": "PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest backend-v2/tests/test_auth_and_users.py -q",
    },
    "checks": {
        "frontend_dependency_audit": {
            "status": "${frontend_audit_status}",
            "log_path": "${frontend_audit_log}",
        },
        "backend_dependency_check": {
            "status": "${backend_dependency_status}",
            "log_path": "${backend_dependency_log}",
        },
        "authz_regression": {
            "status": "${authz_test_status}",
            "log_path": "${authz_test_log}",
        },
    },
}
Path("${summary_json}").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

lines = [
    "# 智能巡检系统 V2 安全验证摘要",
    "",
    f"- 结果: **{summary['result'].upper()}**",
    f"- run_id: `{summary['run_id']}`",
    f"- 输出目录: `{Path('${OUTPUT_DIR}').resolve()}`",
    "",
    "| 检查项 | 状态 | 日志 |",
    "| --- | --- | --- |",
]
for check_name, payload in summary["checks"].items():
    lines.append(f"| {check_name} | {payload['status']} | {payload['log_path']} |")
Path("${summary_md}").write_text("\\n".join(lines), encoding="utf-8")
PY

echo "[v2-security] summary: ${summary_json}"
echo "[v2-security] markdown: ${summary_md}"
if [[ "${overall_status}" != "passed" ]]; then
  echo "[v2-security] failed, review logs under ${OUTPUT_DIR}" >&2
  exit 1
fi
echo "[v2-security] all checks passed"
