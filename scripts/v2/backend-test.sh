#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd pytest
ensure_backend_env

echo "[v2-backend-test] running backend pytest"
(
  cd "${BACKEND_DIR}"
  pytest -q
)
echo "[v2-backend-test] passed"
