#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd date

OUTPUT_DIR="${V2_REAL_ASYNC_TEST_OUTPUT_DIR:-}"

print_usage() {
  cat <<'EOF'
Usage:
  ./scripts/v2/real-async-test.sh [preflight options]

Description:
  Runs the managed preflight stack as the canonical real async verification path.
  This validates PostgreSQL + Redis + API + worker + scheduler instead of the
  lightweight SQLite / CELERY_DISABLED test harness.

Examples:
  make v2-real-async-test
  ./scripts/v2/real-async-test.sh --with-e2e
  ./scripts/v2/real-async-test.sh --output-dir /tmp/v2-real-async
EOF
}

if [[ "${1:-}" == "--help" ]]; then
  print_usage
  exit 0
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
run_id="${V2_RUN_ID:-$(build_run_id "real-async" "${timestamp}")}"
if [[ -z "${OUTPUT_DIR}" ]]; then
  OUTPUT_DIR="${ROOT_DIR}/data/real-async-tests/${run_id}"
fi

echo "[v2-real-async-test] output dir: ${OUTPUT_DIR}"
echo "[v2-real-async-test] verifying managed async stack via preflight"

./scripts/v2/preflight.sh --output-dir "${OUTPUT_DIR}" "$@"
