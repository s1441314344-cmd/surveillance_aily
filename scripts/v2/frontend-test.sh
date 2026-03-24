#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd npm

echo "[v2-frontend-test] running frontend unit tests"
(
  cd "${FRONTEND_DIR}"
  npm run test
)
echo "[v2-frontend-test] passed"
