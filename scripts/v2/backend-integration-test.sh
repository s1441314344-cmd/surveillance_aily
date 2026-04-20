#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd docker
require_cmd python3
require_cmd pytest
require_python_module testcontainers

ensure_backend_env

echo "[v2-backend-integration-test] running backend integration tests"
cd "${ROOT_DIR}"
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest backend-v2/integration_tests -q
echo "[v2-backend-integration-test] backend integration tests passed"
