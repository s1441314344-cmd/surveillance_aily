#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3
ensure_backend_env

cd "${BACKEND_DIR}"
exec python3 ./scripts/evaluate_models.py "$@"
