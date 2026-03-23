#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
require_python_module httpx

python3 "${BACKEND_DIR}/scripts/perf_submit_jobs.py" "$@"
